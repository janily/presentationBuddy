import { mastra } from "@/src/mastra";
import { briefDecisionSchema } from "@/src/mastra/agents/presentation-brief-conversation-agent";
import type { ModelMessage } from "ai";
import { NextResponse } from "next/server";
import z from "zod";

export const maxDuration = 300;

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1),
});

const agentChatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
  hasGeneratedDeck: z.boolean().optional(),
  // Backward-compatible request fields from the former Claude Agent SDK session path.
  // Mastra owns agent state after the migration, so these are intentionally ignored.
  frontendSlidesSessionId: z.string().optional(),
  frontendSlidesRunId: z.string().optional(),
});

// Keep the request bounded; the agent only needs recent turns to stay coherent.
const MAX_HISTORY_MESSAGES = 20;

type BriefDecision = z.infer<typeof briefDecisionSchema>;
type ConversationAgent = ReturnType<typeof mastra.getAgent>;

type AgentChatResultPayload = {
  reply: string;
  readyToGenerate: boolean;
  brief: BriefDecision["brief"] | null;
  frontendSlidesSessionId?: string;
  frontendSlidesRunId?: string;
  done?: boolean;
  html?: string;
  htmlUrl?: string;
  generator?: "frontend-slides";
};

// NDJSON stream event: one JSON object per line. "progress" lines can arrive any
// number of times before the single terminal "result" or "error" line closes the
// stream — this is what lets the UI show live activity instead of a silent wait.
type AgentChatStreamEvent =
  | { type: "progress"; message: string }
  | { type: "assistant-delta"; delta: string }
  | { type: "assistant-snapshot"; text: string }
  | { type: "decision"; payload: AgentChatResultPayload }
  | { type: "result"; payload: AgentChatResultPayload }
  | { type: "error"; error: string };

function getLastUserMessage(messages: z.infer<typeof chatMessageSchema>[]) {
  return [...messages].reverse().find((message) => message.role === "user")?.content.trim() ?? "";
}

function explicitlyConfirmedGeneration(message: string) {
  return /(^|\s)(开始|开始生成|确认|确认生成|可以|可以生成|直接生成|生成吧|就这样|就按这个|按这个|按这个生成|用这个|用第[一二三四五六七八九十123456789]|选第[一二三四五六七八九十123456789]|go ahead|yes|ok)(\s|。|！|!|$)/i.test(message);
}

function buildRevisionConfirmationReply(decision: BriefDecision) {
  const style = decision.brief?.style?.trim();

  if (style) {
    return `我先不直接生成。你是想把这份演示文稿改成「${style}」这个方向吗？确认后我再开始重生成。`;
  }

  return "我先不直接生成。你想换成哪类方向？比如：1. 现代清爽 2. 专业深色 3. 更有视觉冲击。你选一个，我确认后再开始生成。";
}

function buildGenerationConfirmationReply(decision: BriefDecision) {
  const brief = decision.brief;
  if (!brief) {
    return "我先不直接生成。我们先把主题、受众、页数和风格确认清楚，你确认后我再开始。";
  }

  return [
    "我先不直接生成，先和你确认一下理解是否正确：",
    `主题：${brief.topic}`,
    `受众：${brief.audience}`,
    `页数：约 ${brief.pageCount} 页`,
    `风格：${brief.style}`,
    brief.requirements ? `补充要求：${brief.requirements}` : null,
    "如果没问题，回复“确认生成”或“开始生成”，我再正式生成。",
  ].filter(Boolean).join("\n");
}

function createNdjsonStreamResponse(
  executor: (emit: (event: AgentChatStreamEvent) => void) => Promise<void>,
) {
  const encoder = new TextEncoder();
  // ReadableStream's `start` callback runs synchronously during construction, so
  // controllerRef is always assigned before the IIFE below reads it.
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
    },
  });

  let isClosed = false;

  const emit = (event: AgentChatStreamEvent) => {
    if (isClosed) return;

    try {
      controllerRef?.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
    } catch {
      isClosed = true;
    }
  };

  (async () => {
    try {
      await executor(emit);
    } catch (error) {
      console.error("agent-chat stream failed:", error);
      emit({ type: "error", error: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      if (!isClosed) {
        isClosed = true;
        controllerRef?.close();
      }
    }
  })();

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const objectMatch = candidate.match(/\{[\s\S]*\}/);
    if (!objectMatch?.[0]) {
      throw new Error("Model did not return a JSON object");
    }

    return JSON.parse(objectMatch[0]);
  }
}

async function generateBriefDecisionStructured(
  conversationAgent: ConversationAgent,
  history: ModelMessage[],
  emit: (event: AgentChatStreamEvent) => void,
  abortSignal: AbortSignal,
  requestStartedAt: number,
): Promise<BriefDecision | undefined> {
  const stream = await conversationAgent.stream(history, {
    structuredOutput: {
      schema: briefDecisionSchema,
    },
    abortSignal,
  });

  let streamedReply = "";
  let firstDeltaAt: number | null = null;

  const partialReader = (async () => {
    for await (const partial of stream.objectStream) {
      const reply = typeof partial?.reply === "string" ? partial.reply : "";
      if (!reply || reply.length <= streamedReply.length) continue;

      const delta = reply.slice(streamedReply.length);
      streamedReply = reply;

      if (!firstDeltaAt) {
        firstDeltaAt = Date.now();
        console.log("agent-chat first assistant delta", {
          firstDeltaLatencyMs: firstDeltaAt - requestStartedAt,
        });
      }

      emit({ type: "assistant-delta", delta });
    }
  })();

  try {
    const decision = await stream.object as BriefDecision | undefined;
    await partialReader.catch((error) => {
      console.warn("agent-chat structured partial stream ended with an error:", {
        message: error instanceof Error ? error.message : String(error),
      });
    });

    return decision;
  } catch (error) {
    await partialReader.catch(() => undefined);
    throw error;
  }
}

async function generateBriefDecisionFallback(
  conversationAgent: ConversationAgent,
  history: ModelMessage[],
  emit: (event: AgentChatStreamEvent) => void,
  abortSignal: AbortSignal,
): Promise<BriefDecision> {
  emit({ type: "assistant-snapshot", text: "" });
  emit({ type: "progress", message: "结构化回复失败，正在重试普通文本解析..." });

  const stream = await conversationAgent.stream([
    ...history,
    {
      role: "user",
      content: `Return the next assistant decision as strict JSON only. Do not wrap it in Markdown.

The JSON shape must be:
{
  "reply": "string shown to the user",
  "readyToGenerate": boolean,
  "brief": null | {
    "topic": "string",
    "audience": "string",
    "pageCount": number,
    "style": "string",
    "requirements": "string"
  }
}`,
    },
  ], {
    abortSignal,
  });

  let text = "";
  for await (const delta of stream.textStream) {
    text += delta;
  }

  const parsed = parseJsonObject(text);

  return briefDecisionSchema.parse(parsed);
}

async function generateBriefDecision(
  conversationAgent: ConversationAgent,
  history: ModelMessage[],
  emit: (event: AgentChatStreamEvent) => void,
  abortSignal: AbortSignal,
  requestStartedAt: number,
) {
  try {
    return await generateBriefDecisionStructured(conversationAgent, history, emit, abortSignal, requestStartedAt);
  } catch (structuredError) {
    console.warn("Presentation brief structured output failed; retrying with JSON text fallback:", {
      message: structuredError instanceof Error ? structuredError.message : String(structuredError),
    });

    return generateBriefDecisionFallback(conversationAgent, history, emit, abortSignal);
  }
}

export async function POST(request: Request) {
  const requestStartedAt = Date.now();
  const body = await request.json().catch(() => null);
  const validation = agentChatRequestSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json({ error: "Invalid agent chat request" }, { status: 400 });
  }

  const { messages, hasGeneratedDeck } = validation.data;

  return createNdjsonStreamResponse(async (emit) => {
    const conversationAgent = mastra.getAgent("presentationBriefConversationAgent");
    const history: ModelMessage[] = messages
      .slice(-MAX_HISTORY_MESSAGES)
      .map((message) => message.role === "user"
        ? { role: "user", content: message.content }
        : { role: "assistant", content: message.content });

    if (hasGeneratedDeck) {
      history.unshift({
        role: "system",
        content: "A deck has already been generated. Treat new user requests as revision discussion. Do not start generation unless the latest user message explicitly confirms generation or selects a proposed option.",
      });
    }

    try {
      console.log("agent-chat request started", {
        messageCount: messages.length,
        hasGeneratedDeck: Boolean(hasGeneratedDeck),
      });

      emit({ type: "progress", message: "正在思考回复..." });
      const decision = await generateBriefDecision(conversationAgent, history, emit, request.signal, requestStartedAt);

      if (!decision?.reply) {
        throw new Error("Brief agent returned no structured decision");
      }

      const lastUserMessage = getLastUserMessage(messages);
      const shouldBlockGeneration = Boolean(
        decision.readyToGenerate
        && decision.brief
        && !explicitlyConfirmedGeneration(lastUserMessage),
      );

      const payload: AgentChatResultPayload = shouldBlockGeneration
        ? {
          reply: hasGeneratedDeck
            ? buildRevisionConfirmationReply(decision)
            : buildGenerationConfirmationReply(decision),
          readyToGenerate: false,
          brief: null,
        }
        : {
          reply: decision.reply,
          readyToGenerate: decision.readyToGenerate && Boolean(decision.brief),
          brief: decision.brief,
        };

      emit({ type: "assistant-snapshot", text: payload.reply });
      emit({ type: "decision", payload });
      emit({ type: "result", payload });

      console.log("agent-chat final decision emitted", {
        durationMs: Date.now() - requestStartedAt,
        readyToGenerate: payload.readyToGenerate,
        hasBrief: Boolean(payload.brief),
        blockedForConfirmation: shouldBlockGeneration,
      });
    } catch (error) {
      if (request.signal.aborted) {
        console.log("agent-chat request aborted", {
          durationMs: Date.now() - requestStartedAt,
        });
        return;
      }

      console.error("Presentation brief conversation failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      emit({ type: "error", error: `对话模型调用失败：${message}` });
    }
  });
}

