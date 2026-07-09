import { mastra } from "@/src/mastra";
import { briefDecisionSchema } from "@/src/mastra/agents/presentation-brief-conversation-agent";
import {
  isFrontendSlidesAgentConfigured,
  isFrontendSlidesRequired,
  startOrContinueFrontendSlidesSession,
} from "@/src/utils/frontend-slides-agent-runner";
import { saveHtmlToFile } from "@/src/utils/save-html-to-file";
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
  | { type: "result"; payload: AgentChatResultPayload }
  | { type: "error"; error: string };

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

  const emit = (event: AgentChatStreamEvent) => {
    controllerRef?.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
  };

  (async () => {
    try {
      await executor(emit);
    } catch (error) {
      console.error("agent-chat stream failed:", error);
      emit({ type: "error", error: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      controllerRef?.close();
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
): Promise<BriefDecision | undefined> {
  const result = await conversationAgent.generate(history, {
    structuredOutput: {
      schema: briefDecisionSchema,
    },
  });

  return result.object as BriefDecision | undefined;
}

async function generateBriefDecisionFallback(
  conversationAgent: ConversationAgent,
  history: ModelMessage[],
): Promise<BriefDecision> {
  const result = await conversationAgent.generate([
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
  ]);

  const text = typeof result.text === "string" ? result.text : "";
  const parsed = parseJsonObject(text);

  return briefDecisionSchema.parse(parsed);
}

async function generateBriefDecision(
  conversationAgent: ConversationAgent,
  history: ModelMessage[],
) {
  try {
    return await generateBriefDecisionStructured(conversationAgent, history);
  } catch (structuredError) {
    console.warn("Presentation brief structured output failed; retrying with JSON text fallback:", {
      message: structuredError instanceof Error ? structuredError.message : String(structuredError),
    });

    return generateBriefDecisionFallback(conversationAgent, history);
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const validation = agentChatRequestSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json({ error: "Invalid agent chat request" }, { status: 400 });
  }

  const { messages, hasGeneratedDeck, frontendSlidesSessionId, frontendSlidesRunId } = validation.data;

  return createNdjsonStreamResponse(async (emit) => {
    if (isFrontendSlidesAgentConfigured()) {
      const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");

      if (lastUserMessage) {
        try {
          const turn = await startOrContinueFrontendSlidesSession({
            sessionId: frontendSlidesSessionId,
            runId: frontendSlidesRunId,
            userMessage: lastUserMessage.content,
            onProgress: (message) => emit({ type: "progress", message }),
          });

          if (turn.kind === "question") {
            emit({
              type: "result",
              payload: {
                reply: turn.assistantMessage,
                readyToGenerate: false,
                brief: null,
                frontendSlidesSessionId: turn.sessionId,
                frontendSlidesRunId: turn.runId,
              },
            });
            return;
          }

          emit({ type: "progress", message: "正在保存演示文稿文件..." });
          const htmlUrl = await saveHtmlToFile(turn.html, { prefix: "presentation-deck" });

          emit({
            type: "result",
            payload: {
              reply: "已经生成好演示文稿，预览在左侧。想调整哪里，直接告诉我。",
              readyToGenerate: false,
              brief: null,
              frontendSlidesSessionId: turn.sessionId,
              frontendSlidesRunId: turn.runId,
              done: true,
              html: turn.html,
              htmlUrl,
              generator: "frontend-slides" as const,
            },
          });
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : "Unknown error";
          console.error("frontend-slides interactive session failed:", error);

          if (isFrontendSlidesRequired()) {
            emit({ type: "error", error: `frontend-slides 会话失败：${message}` });
            return;
          }

          console.warn("frontend-slides interactive session failed; falling back to the conversational brief agent:", message);
        }
      }
    }

    const conversationAgent = mastra.getAgent("presentationBriefConversationAgent");
    const history: ModelMessage[] = messages
      .slice(-MAX_HISTORY_MESSAGES)
      .map((message) => message.role === "user"
        ? { role: "user", content: message.content }
        : { role: "assistant", content: message.content });

    if (hasGeneratedDeck) {
      history.unshift({
        role: "assistant",
        content: "(context note: a deck has already been generated for this conversation; treat further requests as revisions)",
      });
    }

    try {
      emit({ type: "progress", message: "正在思考回复..." });
      const decision = await generateBriefDecision(conversationAgent, history);

      if (!decision?.reply) {
        throw new Error("Brief agent returned no structured decision");
      }

      emit({
        type: "result",
        payload: {
          reply: decision.reply,
          readyToGenerate: decision.readyToGenerate && Boolean(decision.brief),
          brief: decision.brief,
        },
      });
    } catch (error) {
      console.error("Presentation brief conversation failed:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      emit({ type: "error", error: `对话模型调用失败：${message}` });
    }
  });
}

