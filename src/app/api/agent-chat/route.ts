import { mastra } from "@/src/mastra";
import { briefDecisionSchema } from "@/src/mastra/agents/presentation-brief-conversation-agent";
import {
  presentationInputSchema,
  presentationOutlineSchema,
} from "@/src/mastra/workflows/presentation-generation-schemas";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type ModelMessage,
} from "ai";
import type { AgentChatUIMessage } from "@/src/types/agent-chat";
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
  hasSelectedStyle: z.boolean().optional(),
  operationId: z.string().trim().min(1).optional(),
  deckContext: z.object({
    presentationBrief: presentationInputSchema,
    approvedOutline: presentationOutlineSchema,
  }).optional(),
});

// Keep the request bounded; the agent only needs recent turns to stay coherent.
const MAX_HISTORY_MESSAGES = 20;
const AGENT_CHAT_TOTAL_TIMEOUT_MS = 30_000;
const AGENT_CHAT_SLOW_STATUS_MS = 3_000;
const AGENT_CHAT_VERY_SLOW_STATUS_MS = 8_000;

type BriefDecision = z.infer<typeof briefDecisionSchema>;
type ConversationAgent = ReturnType<typeof mastra.getAgent>;

type AgentChatResultPayload = {
  reply: string;
  readyToGenerate: boolean;
  brief: BriefDecision["brief"] | null;
  nextAction: BriefDecision["nextAction"];
};

type AgentChatStreamEvent =
  | { type: "progress"; message: string }
  | { type: "assistant-delta"; delta: string }
  | { type: "assistant-snapshot"; text: string }
  | { type: "decision"; payload: AgentChatResultPayload }
  | { type: "error"; error: string };

function getLastUserMessage(messages: z.infer<typeof chatMessageSchema>[]) {
  return [...messages].reverse().find((message) => message.role === "user")?.content.trim() ?? "";
}

function createRequestDeadline(parentSignal: AbortSignal) {
  const controller = new AbortController();
  let timedOut = false;
  const forwardAbort = () => controller.abort(parentSignal.reason);
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error("Agent chat timed out"));
  }, AGENT_CHAT_TOTAL_TIMEOUT_MS);

  parentSignal.addEventListener("abort", forwardAbort, { once: true });

  return {
    signal: controller.signal,
    didTimeOut: () => timedOut,
    cleanup: () => {
      clearTimeout(timeout);
      parentSignal.removeEventListener("abort", forwardAbort);
    },
  };
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

function createAgentChatStreamResponse(
  operationId: string,
  executor: (emit: (event: AgentChatStreamEvent) => void) => Promise<void>,
) {
  const textPartId = `assistant-${operationId}`;
  const stream = createUIMessageStream<AgentChatUIMessage>({
    execute: async ({ writer }) => {
      let textStarted = false;
      const emit = (event: AgentChatStreamEvent) => {
        switch (event.type) {
          case "progress":
            writer.write({
              type: "data-agentStatus",
              data: { operationId, message: event.message },
              transient: true,
            });
            break;
          case "assistant-delta":
            if (!textStarted) {
              textStarted = true;
              writer.write({ type: "text-start", id: textPartId });
            }
            writer.write({ type: "text-delta", id: textPartId, delta: event.delta });
            break;
          case "assistant-snapshot":
            writer.write({
              type: "data-assistantSnapshot",
              data: { operationId, text: event.text },
            });
            break;
          case "decision":
            writer.write({
              type: "data-agentDecision",
              data: { operationId, payload: event.payload },
            });
            break;
          case "error":
            writer.write({ type: "error", errorText: event.error });
            break;
        }
      };

      try {
        await executor(emit);
      } finally {
        if (textStarted) writer.write({ type: "text-end", id: textPartId });
      }
    },
    onError: (error) => {
      console.error("agent-chat UI stream failed:", error);
      return error instanceof Error ? error.message : "Unknown error";
    },
  });

  return createUIMessageStreamResponse({ stream });
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
  operationId: string,
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
        console.log("agent_chat.first_model_delta", {
          operationId,
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
  operationId: string,
): Promise<BriefDecision> {
  emit({ type: "assistant-snapshot", text: "" });
  emit({ type: "progress", message: "结构化回复失败，正在重试普通文本解析..." });
  console.warn("agent_chat.fallback_started", { operationId });

  const stream = await conversationAgent.stream([
    ...history,
    {
      role: "user",
      content: `Return the next assistant decision as strict JSON only. Do not wrap it in Markdown.

The JSON shape must be:
{
  "reply": "string shown to the user",
  "readyToGenerate": boolean,
  "nextAction": "chat" | "discover-styles" | "generate",
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
  operationId: string,
) {
  try {
    const decision = await generateBriefDecisionStructured(
      conversationAgent,
      history,
      emit,
      abortSignal,
      requestStartedAt,
      operationId,
    );
    console.log("agent_chat.structured_completed", {
      operationId,
      durationMs: Date.now() - requestStartedAt,
    });
    return decision;
  } catch (structuredError) {
    if (abortSignal.aborted) throw structuredError;

    console.warn("Presentation brief structured output failed; retrying with JSON text fallback:", {
      message: structuredError instanceof Error ? structuredError.message : String(structuredError),
    });

    return generateBriefDecisionFallback(conversationAgent, history, emit, abortSignal, operationId);
  }
}

export async function POST(request: Request) {
  const requestStartedAt = Date.now();
  const body = await request.json().catch(() => null);
  const validation = agentChatRequestSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json({ error: "Invalid agent chat request" }, { status: 400 });
  }

  const { messages, hasGeneratedDeck, hasSelectedStyle, deckContext } = validation.data;
  const operationId = validation.data.operationId ?? crypto.randomUUID();

  return createAgentChatStreamResponse(operationId, async (emit) => {
    const deadline = createRequestDeadline(request.signal);
    const slowStatusTimer = setTimeout(() => {
      emit({ type: "progress", message: "仍在组织回复，已等待 3 秒…" });
    }, AGENT_CHAT_SLOW_STATUS_MS);
    const verySlowStatusTimer = setTimeout(() => {
      emit({ type: "progress", message: "模型响应较慢，可取消后重试。" });
    }, AGENT_CHAT_VERY_SLOW_STATUS_MS);
    const conversationAgent = mastra.getAgent("presentationBriefConversationAgent");
    const history: ModelMessage[] = messages
      .slice(-MAX_HISTORY_MESSAGES)
      .map((message) => message.role === "user"
        ? { role: "user", content: message.content }
        : { role: "assistant", content: message.content });

    if (hasGeneratedDeck) {
      history.unshift({
        role: "system",
        content: `A deck has already been generated. Treat new user requests as revision discussion. Do not start generation unless the latest user message explicitly confirms generation or selects a proposed option.${deckContext ? `\n\nCurrent deck context:\n${JSON.stringify(deckContext)}` : ""}`,
      });
    }

    try {
      console.log("agent_chat.request_received", {
        operationId,
        messageCount: messages.length,
        hasGeneratedDeck: Boolean(hasGeneratedDeck),
      });

      emit({ type: "progress", message: "正在思考回复..." });
      console.log("agent_chat.first_event_written", {
        operationId,
        durationMs: Date.now() - requestStartedAt,
      });
      console.log("agent_chat.provider_call_started", { operationId });
      const decision = await generateBriefDecision(
        conversationAgent,
        history,
        emit,
        deadline.signal,
        requestStartedAt,
        operationId,
      );

      if (!decision?.reply) {
        throw new Error("Brief agent returned no structured decision");
      }

      const lastUserMessage = getLastUserMessage(messages);
      const shouldBlockGeneration = Boolean(
        decision.readyToGenerate
        && decision.brief
        && !explicitlyConfirmedGeneration(lastUserMessage),
      );

      const shouldDiscoverStyle = Boolean(
        decision.readyToGenerate
        && decision.brief
        && !hasSelectedStyle,
      );

      const payload: AgentChatResultPayload = shouldDiscoverStyle
        ? {
          reply: "内容方向已经确认。生成前先按 frontend-slides 为你准备三个真实标题页预览，请从中选择整套演示文稿的视觉系统。",
          readyToGenerate: false,
          brief: decision.brief,
          nextAction: "discover-styles",
        }
        : shouldBlockGeneration
        ? {
          reply: hasGeneratedDeck
            ? buildRevisionConfirmationReply(decision)
            : buildGenerationConfirmationReply(decision),
          readyToGenerate: false,
          brief: null,
          nextAction: "chat",
        }
        : {
          reply: decision.reply,
          readyToGenerate: decision.readyToGenerate && Boolean(decision.brief),
          brief: decision.brief,
          nextAction: decision.nextAction,
        };

      emit({ type: "assistant-snapshot", text: payload.reply });
      emit({ type: "decision", payload });

      console.log("agent_chat.decision_emitted", {
        operationId,
        durationMs: Date.now() - requestStartedAt,
        readyToGenerate: payload.readyToGenerate,
        hasBrief: Boolean(payload.brief),
        blockedForConfirmation: shouldBlockGeneration,
        routedToStyleDiscovery: shouldDiscoverStyle,
      });
    } catch (error) {
      if (request.signal.aborted) {
        console.log("agent_chat.request_aborted", {
          operationId,
          durationMs: Date.now() - requestStartedAt,
        });
        return;
      }

      if (deadline.didTimeOut()) {
        emit({ type: "error", error: "对话响应超时，请重试。" });
        console.warn("agent_chat.request_timed_out", {
          operationId,
          durationMs: Date.now() - requestStartedAt,
        });
        return;
      }

      console.error("Presentation brief conversation failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      emit({ type: "error", error: `对话模型调用失败：${message}` });
    } finally {
      clearTimeout(slowStatusTimer);
      clearTimeout(verySlowStatusTimer);
      deadline.cleanup();
      console.log("agent_chat.stream_closed", {
        operationId,
        durationMs: Date.now() - requestStartedAt,
      });
    }
  });
}

