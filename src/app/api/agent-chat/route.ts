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
import type { AgentChatStatusState } from "@/src/types/agent-chat";
import { applyIntentGuard, createActionProposal } from "./intent-routing";
import { NextResponse } from "next/server";
import z from "zod";
import { classifyProposalConfirmation } from "@/src/utils/proposal-confirmation";
import {
  beginProposalExecution,
  getAgentProposal,
  saveAgentProposal,
} from "@/src/services/agent-proposals/proposal-store";

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
  pendingProposalId: z.string().trim().min(1).optional(),
  deckContext: z.object({
    deckId: z.string().trim().min(1),
    version: z.number().int().positive(),
    presentationBrief: presentationInputSchema,
    approvedOutline: presentationOutlineSchema,
  }).optional(),
});

// Keep the request bounded; the agent only needs recent turns to stay coherent.
const MAX_HISTORY_MESSAGES = 20;
const AGENT_CHAT_TOTAL_TIMEOUT_MS = 90_000;
const AGENT_CHAT_CLASSIFICATION_TIMEOUT_MS = 20_000;
const AGENT_CHAT_VERY_SLOW_STATUS_MS = 8_000;

type BriefDecision = z.infer<typeof briefDecisionSchema>;
type ConversationAgent = ReturnType<typeof mastra.getAgent>;

type AgentChatResultPayload = {
  reply: string;
  readyToGenerate: boolean;
  brief: BriefDecision["brief"] | null;
  nextAction: BriefDecision["nextAction"];
  revision: BriefDecision["revision"];
  styleId: BriefDecision["styleId"];
  proposal: import("@/src/types/agent-chat").AgentActionProposal | null;
  executeProposalId: string | null;
};

type AgentChatStreamEvent =
  | { type: "progress"; state: AgentChatStatusState; message: string }
  | { type: "reasoning"; delta: string; state: "start" | "delta" | "end" }
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
    controller.abort();
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

function createChildDeadline(parentSignal: AbortSignal, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const forwardAbort = () => controller.abort(parentSignal.reason);
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

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

export function explicitlyConfirmedGeneration(message: string) {
  return classifyProposalConfirmation(message) === "confirm"
    || /(^|\s)(开始|开始生成|确认|确认生成|可以|可以生成|直接生成|生成吧|就这样|就按这个|按这个|按这个生成|用这个|用第[一二三四五六七八九十123456789]|选第[一二三四五六七八九十123456789]|go ahead|yes|ok)(\s|。|！|!|$)/i.test(message);
}

export function buildRevisionConfirmationReply(decision: BriefDecision) {
  const instruction = decision.revision?.instruction.trim();
  if (instruction) {
    return `我先不直接执行。你是要应用刚才这项修改吗：${instruction}\n\n确认后我会保持当前视觉方向并开始处理。`;
  }

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
              data: { operationId, state: event.state, message: event.message },
              transient: true,
            });
            break;
          case "reasoning":
            writer.write({
              type: "data-agentReasoning",
              data: { operationId, delta: event.delta, state: event.state },
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
  abortSignal: AbortSignal,
): Promise<BriefDecision | undefined> {
  const stream = await conversationAgent.stream(history, {
    structuredOutput: {
      schema: briefDecisionSchema,
    },
    abortSignal,
  });

  try {
    const decision = await stream.object as BriefDecision | undefined;
    return decision;
  } catch (error) {
    throw error;
  }
}

async function streamConversationalReply(
  conversationAgent: ConversationAgent,
  history: ModelMessage[],
  emit: (event: AgentChatStreamEvent) => void,
  abortSignal: AbortSignal,
  requestStartedAt: number,
  operationId: string,
) {
  const stream = await conversationAgent.stream(history, { abortSignal });
  let reply = "";
  let firstReasoningDeltaAt: number | null = null;
  let firstTextDeltaAt: number | null = null;

  for await (const chunk of stream.fullStream) {
    if (chunk.type === "reasoning-start") {
      emit({ type: "reasoning", delta: "", state: "start" });
    } else if (chunk.type === "reasoning-delta" && chunk.payload.text) {
      if (!firstReasoningDeltaAt) firstReasoningDeltaAt = Date.now();
      emit({ type: "reasoning", delta: chunk.payload.text, state: "delta" });
    } else if (chunk.type === "reasoning-end") {
      emit({ type: "reasoning", delta: "", state: "end" });
    } else if (chunk.type === "text-delta" && chunk.payload.text) {
      if (!firstTextDeltaAt) firstTextDeltaAt = Date.now();
      reply += chunk.payload.text;
      emit({ type: "assistant-delta", delta: chunk.payload.text });
    }
  }

  if (firstReasoningDeltaAt) {
    console.log("agent_chat.first_reasoning_delta", {
      operationId,
      latencyMs: firstReasoningDeltaAt - requestStartedAt,
    });
  }
  if (firstTextDeltaAt) {
    console.log("agent_chat.first_text_delta", {
      operationId,
      latencyMs: firstTextDeltaAt - requestStartedAt,
    });
  }

  return reply.trim();
}

async function generateBriefDecisionFallback(
  conversationAgent: ConversationAgent,
  history: ModelMessage[],
  emit: (event: AgentChatStreamEvent) => void,
  abortSignal: AbortSignal,
  operationId: string,
): Promise<BriefDecision> {
  emit({ type: "progress", state: "retrying", message: "正在校验回复格式…" });
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
  "nextAction": "chat" | "revise-content" | "revise-structure" | "change-palette" | "discover-styles" | "more-styles" | "select-style" | "generate",
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
  const visibleReply = await streamConversationalReply(
    conversationAgent,
    history,
    emit,
    abortSignal,
    requestStartedAt,
    operationId,
  );
  const classificationHistory: ModelMessage[] = [
    ...history,
    { role: "assistant", content: visibleReply },
    {
      role: "user",
      content: "Classify the action implied by the latest user request and the assistant reply. Return the brief decision only. Do not continue the conversation.",
    },
  ];
  const classificationDeadline = createChildDeadline(abortSignal, AGENT_CHAT_CLASSIFICATION_TIMEOUT_MS);
  const chatOnlyDecision = (): BriefDecision => ({
    reply: visibleReply || "我已经理解你的要求，请继续补充你希望我执行的具体调整。",
    readyToGenerate: false,
    nextAction: "chat",
    revision: null,
    styleId: null,
    brief: null,
  });

  try {
    const decision = await generateBriefDecisionStructured(
      conversationAgent,
      classificationHistory,
      classificationDeadline.signal,
    );
    console.log("agent_chat.structured_completed", {
      operationId,
      durationMs: Date.now() - requestStartedAt,
    });
    return decision ? { ...decision, reply: visibleReply || decision.reply } : decision;
  } catch (structuredError) {
    if (abortSignal.aborted) throw structuredError;
    if (classificationDeadline.didTimeOut()) {
      console.warn("agent_chat.classification_timed_out", { operationId });
      return chatOnlyDecision();
    }

    console.warn("Presentation brief structured output failed; retrying with JSON text fallback:", {
      message: structuredError instanceof Error ? structuredError.message : String(structuredError),
    });

    try {
      const decision = await generateBriefDecisionFallback(
        conversationAgent,
        classificationHistory,
        emit,
        classificationDeadline.signal,
        operationId,
      );
      return { ...decision, reply: visibleReply || decision.reply };
    } catch (fallbackError) {
      if (abortSignal.aborted) throw fallbackError;
      if (classificationDeadline.didTimeOut()) {
        console.warn("agent_chat.classification_fallback_timed_out", { operationId });
        return chatOnlyDecision();
      }
      throw fallbackError;
    }
  } finally {
    classificationDeadline.cleanup();
  }
}

export async function POST(request: Request) {
  const requestStartedAt = Date.now();
  const body = await request.json().catch(() => null);
  const validation = agentChatRequestSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json({ error: "Invalid agent chat request" }, { status: 400 });
  }

  const { messages, hasGeneratedDeck, hasSelectedStyle, deckContext, pendingProposalId } = validation.data;
  const operationId = validation.data.operationId ?? crypto.randomUUID();

  return createAgentChatStreamResponse(operationId, async (emit) => {
    const deadline = createRequestDeadline(request.signal);
    const verySlowStatusTimer = setTimeout(() => {
      emit({ type: "progress", state: "slow-active", message: "模型仍在处理，你可以继续等待或停止本次请求。" });
    }, AGENT_CHAT_VERY_SLOW_STATUS_MS);
    const emitModelEvent = (event: AgentChatStreamEvent) => {
      if (
        event.type === "assistant-delta"
        || (event.type === "reasoning" && (event.state === "start" || (event.state === "delta" && event.delta.length > 0)))
      ) {
        clearTimeout(verySlowStatusTimer);
      }
      emit(event);
    };
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

      emit({ type: "progress", state: "connecting", message: "正在连接模型…" });
      console.log("agent_chat.first_event_written", {
        operationId,
        durationMs: Date.now() - requestStartedAt,
      });
      console.log("agent_chat.provider_call_started", { operationId });

      if (pendingProposalId && classifyProposalConfirmation(getLastUserMessage(messages)) === "confirm") {
        const storedProposal = getAgentProposal(pendingProposalId);
        if (!deckContext || !storedProposal) {
          const reply = "刚才的待执行方案已失效，请基于当前版本重新整理后再执行。";
          emit({ type: "assistant-snapshot", text: reply });
          emit({
            type: "decision",
            payload: {
              reply,
              readyToGenerate: false,
              brief: null,
              nextAction: "chat",
              revision: null,
              styleId: null,
              proposal: null,
              executeProposalId: null,
            },
          });
          return;
        }

        if (storedProposal.status === "executing" || storedProposal.status === "consumed") {
          console.log("agent_chat.proposal_confirmation_deduplicated", {
            operationId,
            proposalId: storedProposal.proposalId,
            status: storedProposal.status,
          });
          const reply = "刚才确认的方案已经在执行或已执行，不会重复启动。";
          emit({ type: "assistant-snapshot", text: reply });
          emit({
            type: "decision",
            payload: {
              reply,
              readyToGenerate: false,
              brief: null,
              nextAction: "chat",
              revision: null,
              styleId: null,
              proposal: storedProposal,
              executeProposalId: null,
            },
          });
          return;
        }

        if (
          storedProposal.status !== "pending"
          || storedProposal.deckId !== deckContext.deckId
          || storedProposal.baseVersion !== deckContext.version
        ) {
          const reply = "刚才的待执行方案已失效，请基于当前版本重新整理后再执行。";
          emit({ type: "assistant-snapshot", text: reply });
          emit({
            type: "decision",
            payload: {
              reply,
              readyToGenerate: false,
              brief: null,
              nextAction: "chat",
              revision: null,
              styleId: null,
              proposal: storedProposal,
              executeProposalId: null,
            },
          });
          return;
        }

        const proposal = beginProposalExecution(pendingProposalId, {
          deckId: deckContext.deckId,
          version: deckContext.version,
        });
        console.log("agent_chat.proposal_confirmed", {
          operationId,
          proposalId: proposal.proposalId,
          action: proposal.action,
          proposalAgeMs: Date.now() - Date.parse(proposal.createdAt),
        });
        const reply = proposal.requiresOutlineReview
          ? "已确认，正在应用刚才的大纲修改并生成新版本。"
          : "已确认，正在应用刚才的内容修改，当前视觉方向保持不变。";
        emit({ type: "assistant-snapshot", text: reply });
        emit({
          type: "decision",
          payload: {
            reply,
            readyToGenerate: false,
            brief: null,
            nextAction: "execute-proposal",
            revision: {
              instruction: proposal.instruction,
              targetSlides: proposal.targetSlides,
              requiresOutlineReview: proposal.requiresOutlineReview,
            },
            styleId: null,
            proposal,
            executeProposalId: proposal.proposalId,
          },
        });
        return;
      }

      const rawDecision = await generateBriefDecision(
        conversationAgent,
        history,
        emitModelEvent,
        deadline.signal,
        requestStartedAt,
        operationId,
      );

      const lastUserMessage = getLastUserMessage(messages);
      const decision = rawDecision
        ? applyIntentGuard(rawDecision, lastUserMessage, Boolean(hasGeneratedDeck), { explicitlyConfirmedGeneration })
        : rawDecision;

      if (!decision?.reply) {
        throw new Error("Brief agent returned no structured decision");
      }

      const shouldBlockGeneration = Boolean(
        decision.readyToGenerate
        && decision.brief
        && !explicitlyConfirmedGeneration(lastUserMessage),
      );

      const shouldDiscoverStyle = decision.nextAction === "discover-styles" || decision.nextAction === "more-styles";
      const shouldRequireInitialStyle = Boolean(
        !hasGeneratedDeck
        && decision.readyToGenerate
        && decision.brief
        && !hasSelectedStyle,
      );

      const basePayload: Omit<AgentChatResultPayload, "proposal" | "executeProposalId"> = shouldRequireInitialStyle
        ? {
          reply: "内容方向已经确认。生成前先按 frontend-slides 为你准备一组真实标题页预览，请从中选择整套演示文稿的视觉系统。",
          readyToGenerate: false,
          brief: decision.brief,
          nextAction: "discover-styles",
          revision: null,
          styleId: null,
        }
        : shouldBlockGeneration
        ? {
          reply: hasGeneratedDeck
            ? buildRevisionConfirmationReply(decision)
            : buildGenerationConfirmationReply(decision),
          readyToGenerate: false,
          brief: null,
          nextAction: "chat",
          revision: null,
          styleId: null,
        }
        : {
          reply: decision.reply,
          readyToGenerate: decision.readyToGenerate && Boolean(decision.brief),
          brief: decision.brief,
          nextAction: decision.nextAction,
          revision: decision.revision,
          styleId: decision.styleId,
        };

      const proposal = deckContext
        ? createActionProposal(decision, {
            deckId: deckContext.deckId,
            version: deckContext.version,
            proposalId: `proposal-${crypto.randomUUID()}`,
            createdAt: new Date().toISOString(),
          })
        : null;
      if (proposal) saveAgentProposal(proposal);
      const payload: AgentChatResultPayload = {
        ...basePayload,
        proposal,
        executeProposalId: null,
      };

      emit({ type: "assistant-snapshot", text: payload.reply });
      emit({ type: "decision", payload });

      console.log("agent_chat.decision_emitted", {
        operationId,
        durationMs: Date.now() - requestStartedAt,
        readyToGenerate: payload.readyToGenerate,
        hasBrief: Boolean(payload.brief),
        blockedForConfirmation: shouldBlockGeneration,
        routedToStyleDiscovery: shouldDiscoverStyle || shouldRequireInitialStyle,
        proposalAction: proposal?.action ?? null,
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
        emit({ type: "error", error: "本次处理超时，未执行任何修改。请重试。" });
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
      clearTimeout(verySlowStatusTimer);
      deadline.cleanup();
      console.log("agent_chat.stream_closed", {
        operationId,
        durationMs: Date.now() - requestStartedAt,
      });
    }
  });
}
