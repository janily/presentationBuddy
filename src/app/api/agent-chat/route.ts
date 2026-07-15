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
import type { AgentActionProposal, AgentChatUIMessage } from "@/src/types/agent-chat";
import type { AgentChatStatusState } from "@/src/types/agent-chat";
import { createActionProposal } from "./intent-routing";
import { NextResponse } from "next/server";
import z from "zod";
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
  isGenerating: z.boolean().optional(),
  hasFailedGeneration: z.boolean().optional(),
  draftBrief: presentationInputSchema.optional(),
  operationId: z.string().trim().min(1).optional(),
  pendingProposalId: z.string().trim().min(1).optional(),
  deckContext: z.object({
    deckId: z.string().trim().min(1),
    version: z.number().int().positive(),
    presentationBrief: presentationInputSchema,
    approvedOutline: presentationOutlineSchema,
  }).optional(),
});

export function buildFailedGenerationSystemContext(
  draftBrief?: z.infer<typeof presentationInputSchema>,
) {
  return `A previous presentation generation attempt failed and is no longer running. Do not tell the user that generation is still in progress. Treat the latest message as a new instruction for the retained draft. If the user requests a different visual style, set nextAction to "discover-styles" and populate brief from the retained draft so the UI can render style previews.${draftBrief ? `\n\nRetained draft brief:\n${JSON.stringify(draftBrief)}` : ""}`;
}

// Keep the request bounded; the agent only needs recent turns to stay coherent.
const MAX_HISTORY_MESSAGES = 20;
const AGENT_CHAT_TOTAL_TIMEOUT_MS = 90_000;
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

type DecisionGuardReason = "generation-in-progress" | "inconsistent-decision" | null;

export function enforceAgentDecisionState(
  decision: BriefDecision,
  state: { isGenerating: boolean },
): { decision: BriefDecision; reason: DecisionGuardReason } {
  if (state.isGenerating) {
    const attemptsImmediateExecution = decision.readyToGenerate
      || decision.nextAction === "generate"
      || decision.nextAction === "execute-proposal";
    return {
      reason: "generation-in-progress",
      decision: attemptsImmediateExecution
        ? {
          ...decision,
          readyToGenerate: false,
          nextAction: "chat",
          revision: null,
          brief: null,
          styleId: null,
        }
        : decision,
    };
  }

  const readyWithoutGenerate = decision.readyToGenerate && decision.nextAction !== "generate";
  const invalidGenerate = decision.nextAction === "generate" && (!decision.readyToGenerate || !decision.brief);
  if (readyWithoutGenerate || invalidGenerate) {
    return {
      reason: "inconsistent-decision",
      decision: {
        ...decision,
        readyToGenerate: false,
        nextAction: "chat",
        revision: null,
        brief: null,
        styleId: null,
      },
    };
  }

  return { decision, reason: null };
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

export function buildProposalExecutionReply(proposal: AgentActionProposal) {
  if (proposal.requiresOutlineReview) {
    return "已确认，正在应用刚才的大纲修改并生成新版本。";
  }
  if (proposal.action === "change-palette") {
    return "已确认，正在应用刚才的配色修改，当前内容和版式保持不变。";
  }
  if (proposal.action === "change-style") {
    return "已确认，正在应用刚才的视觉风格修改，当前内容和大纲保持不变。";
  }
  return "已确认，正在应用刚才的内容修改，当前视觉方向保持不变。";
}

type DeckContext = { deckId: string; version: number } | undefined;

/**
 * Deterministic structural gating for proposal execution. The model already
 * decided the user wants to execute the pending proposal; the server only
 * verifies the proposal still exists, belongs to this deck, matches the current
 * version, and is still pending — no keyword/regex intent matching.
 */
export function resolveProposalExecution(
  pendingProposalId: string | undefined,
  deckContext: DeckContext,
  operationId: string,
): { payload: AgentChatResultPayload; result: string } {
  const invalid = (reply: string, proposal: AgentActionProposal | null, result: string) => ({
    result,
    payload: {
      reply,
      readyToGenerate: false,
      brief: null,
      nextAction: "chat" as const,
      revision: null,
      styleId: null,
      proposal,
      executeProposalId: null,
    },
  });

  const storedProposal = pendingProposalId ? getAgentProposal(pendingProposalId) : null;
  if (!pendingProposalId || !deckContext || !storedProposal) {
    return invalid(
      "刚才的待执行方案已失效，请基于当前版本重新整理后再执行。",
      storedProposal,
      "invalid-or-missing",
    );
  }

  if (storedProposal.status === "executing" || storedProposal.status === "consumed") {
    console.log("agent_chat.proposal_confirmation_deduplicated", {
      operationId,
      proposalId: storedProposal.proposalId,
      status: storedProposal.status,
    });
    return invalid(
      "刚才确认的方案已经在执行或已执行，不会重复启动。",
      storedProposal,
      "deduplicated",
    );
  }

  if (
    storedProposal.status !== "pending"
    || storedProposal.deckId !== deckContext.deckId
    || storedProposal.baseVersion !== deckContext.version
  ) {
    return invalid(
      "刚才的待执行方案已失效，请基于当前版本重新整理后再执行。",
      storedProposal,
      "stale-version",
    );
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
  const reply = buildProposalExecutionReply(proposal);
  return {
    result: "executed",
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
  };
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

function extractReplyText(partial: unknown): string {
  if (partial && typeof partial === "object" && "reply" in partial) {
    const reply = (partial as { reply?: unknown }).reply;
    if (typeof reply === "string") return reply;
  }
  return "";
}

/**
 * Single-pass decision: one Mastra run produces BOTH the user-facing reply
 * (streamed live from the partial structured object) AND the structured
 * intent decision. There is no second classification call and no keyword/regex
 * intent guard. The model is the single source of truth for intent.
 *
 * A JSON text fallback still exists for providers whose structured stream
 * errors out, but it is structured-only and never re-derives intent by regex.
 */
async function generateBriefDecision(
  conversationAgent: ConversationAgent,
  history: ModelMessage[],
  emit: (event: AgentChatStreamEvent) => void,
  abortSignal: AbortSignal,
  requestStartedAt: number,
  operationId: string,
): Promise<BriefDecision | undefined> {
  const stream = await conversationAgent.stream(history, {
    structuredOutput: { schema: briefDecisionSchema },
    abortSignal,
  });

  let streamedReply = "";
  let firstReasoningDeltaAt: number | null = null;
  let firstReplyDeltaAt: number | null = null;

  try {
    for await (const chunk of stream.fullStream) {
      if (chunk.type === "reasoning-start") {
        emit({ type: "reasoning", delta: "", state: "start" });
      } else if (chunk.type === "reasoning-delta" && chunk.payload.text) {
        if (!firstReasoningDeltaAt) firstReasoningDeltaAt = Date.now();
        emit({ type: "reasoning", delta: chunk.payload.text, state: "delta" });
      } else if (chunk.type === "reasoning-end") {
        emit({ type: "reasoning", delta: "", state: "end" });
      } else if (chunk.type === "object") {
        // Partial structured object: stream only the growing `reply` field to
        // the user, never raw JSON of the other decision fields.
        const nextReply = extractReplyText(chunk.object);
        if (nextReply.length > streamedReply.length && nextReply.startsWith(streamedReply)) {
          const delta = nextReply.slice(streamedReply.length);
          if (!firstReplyDeltaAt) firstReplyDeltaAt = Date.now();
          streamedReply = nextReply;
          emit({ type: "assistant-delta", delta });
        } else if (nextReply && nextReply !== streamedReply) {
          // Provider re-emitted a non-append-only reply; correct via snapshot.
          streamedReply = nextReply;
          emit({ type: "assistant-snapshot", text: nextReply });
        }
      }
    }
  } catch (streamError) {
    if (abortSignal.aborted) throw streamError;
    console.warn("agent_chat.structured_stream_failed; falling back to JSON text:", {
      operationId,
      message: streamError instanceof Error ? streamError.message : String(streamError),
    });
    return generateBriefDecisionFallback(conversationAgent, history, emit, abortSignal, operationId);
  }

  if (firstReasoningDeltaAt) {
    console.log("agent_chat.first_reasoning_delta", {
      operationId,
      latencyMs: firstReasoningDeltaAt - requestStartedAt,
    });
  }
  if (firstReplyDeltaAt) {
    console.log("agent_chat.first_text_delta", {
      operationId,
      latencyMs: firstReplyDeltaAt - requestStartedAt,
    });
  }

  let decision: BriefDecision | undefined;
  try {
    decision = await stream.object as BriefDecision | undefined;
  } catch (objectError) {
    if (abortSignal.aborted) throw objectError;
    console.warn("agent_chat.structured_object_failed; falling back to JSON text:", {
      operationId,
      message: objectError instanceof Error ? objectError.message : String(objectError),
    });
    return generateBriefDecisionFallback(conversationAgent, history, emit, abortSignal, operationId);
  }

  console.log("agent_chat.structured_completed", {
    operationId,
    durationMs: Date.now() - requestStartedAt,
  });

  if (!decision) {
    console.warn("agent_chat.structured_returned_empty", { operationId });
    // Preserve any reply the user already saw; do not invent an intent.
    return {
      reply: streamedReply || "我已经理解你的要求，请继续补充你希望我执行的具体调整。",
      readyToGenerate: false,
      nextAction: "chat",
      revision: null,
      styleId: null,
      brief: null,
    };
  }

  // The streamed reply and the final decision come from the same run, so they
  // are already consistent. Prefer the validated decision.reply as canonical.
  return decision;
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
  "nextAction": "chat" | "revise-content" | "revise-structure" | "change-palette" | "discover-styles" | "more-styles" | "select-style" | "execute-proposal" | "generate",
  "revision": null | { "instruction": "string", "targetSlides": number[], "requiresOutlineReview": boolean },
  "styleId": null | "string",
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
  const decision = briefDecisionSchema.parse(parsed);
  // Fallback JSON was internal; surface the reply as a snapshot so the user
  // sees the final wording rather than raw JSON tokens.
  emit({ type: "assistant-snapshot", text: decision.reply });
  return decision;
}

export async function POST(request: Request) {
  const requestStartedAt = Date.now();
  const body = await request.json().catch(() => null);
  const validation = agentChatRequestSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json({ error: "Invalid agent chat request" }, { status: 400 });
  }

  const {
    messages,
    hasGeneratedDeck,
    hasSelectedStyle,
    isGenerating,
    hasFailedGeneration,
    draftBrief,
    deckContext,
    pendingProposalId,
  } = validation.data;
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

    const storedPendingProposal = pendingProposalId ? getAgentProposal(pendingProposalId) : null;
    const activePendingProposal = storedPendingProposal?.status === "pending"
      && deckContext
      && storedPendingProposal.deckId === deckContext.deckId
      && storedPendingProposal.baseVersion === deckContext.version
      ? storedPendingProposal
      : null;

    if (isGenerating) {
      history.unshift({
        role: "system",
        content: `A presentation generation is currently in progress. Treat the latest request as discussion of a revision to apply after the current generation completes. Summarize the requested change as a concrete proposal and tell the user it will be confirmed after completion. Never set readyToGenerate to true, nextAction to "generate", or nextAction to "execute-proposal" in this state.`,
      });
    }

    if (hasFailedGeneration && !isGenerating) {
      history.unshift({
        role: "system",
        content: buildFailedGenerationSystemContext(draftBrief),
      });
    }

    if (hasGeneratedDeck) {
      const proposalContext = activePendingProposal
        ? `\n\nThere is a PENDING action proposal awaiting the user's confirmation. If the latest user message means "confirm / go ahead / apply it" (in any wording), set nextAction to "execute-proposal". If the user changes the request, propose a new plan instead. Pending proposal:\n${JSON.stringify({
            action: activePendingProposal.action,
            instruction: activePendingProposal.instruction,
            targetSlides: activePendingProposal.targetSlides,
            requiresOutlineReview: activePendingProposal.requiresOutlineReview,
            summary: activePendingProposal.userFacingSummary,
          })}`
        : "";
      history.unshift({
        role: "system",
        content: `A deck has already been generated. Treat new user requests as revision discussion. Do not start generation unless the latest user message confirms it or selects a proposed option.${deckContext ? `\n\nCurrent deck context:\n${JSON.stringify(deckContext)}` : ""}${proposalContext}`,
      });
    }

    try {
      console.log("agent_chat.request_received", {
        operationId,
        messageCount: messages.length,
        hasGeneratedDeck: Boolean(hasGeneratedDeck),
        isGenerating: Boolean(isGenerating),
      });

      emit({ type: "progress", state: "connecting", message: "正在连接模型…" });
      console.log("agent_chat.first_event_written", {
        operationId,
        durationMs: Date.now() - requestStartedAt,
      });
      console.log("agent_chat.provider_call_started", { operationId });

      const generatedDecision = await generateBriefDecision(
        conversationAgent,
        history,
        emitModelEvent,
        deadline.signal,
        requestStartedAt,
        operationId,
      );

      if (!generatedDecision?.reply) {
        throw new Error("Brief agent returned no structured decision");
      }

      const guarded = enforceAgentDecisionState(generatedDecision, {
        isGenerating: Boolean(isGenerating),
      });
      const decision = guarded.decision;
      if (guarded.reason) {
        console.warn("agent_chat.decision_downgraded", {
          operationId,
          reason: guarded.reason,
          originalNextAction: generatedDecision.nextAction,
          originalReadyToGenerate: generatedDecision.readyToGenerate,
        });
      }

      // The model is the single source of truth for intent. When it decides to
      // execute a previously proposed action, the server only performs
      // DETERMINISTIC structural gating (proposal exists, belongs to this deck,
      // version matches, still pending) — never keyword/regex intent matching.
      if (decision.nextAction === "execute-proposal") {
        const outcome = resolveProposalExecution(pendingProposalId, deckContext, operationId);
        emit({ type: "assistant-snapshot", text: outcome.payload.reply });
        emit({ type: "decision", payload: outcome.payload });
        console.log("agent_chat.decision_emitted", {
          operationId,
          durationMs: Date.now() - requestStartedAt,
          readyToGenerate: outcome.payload.readyToGenerate,
          hasBrief: Boolean(outcome.payload.brief),
          proposalExecution: outcome.result,
          proposalAction: outcome.payload.proposal?.action ?? null,
        });
        return;
      }

      // New-deck flow only: if the model is ready to generate but no visual
      // system has been chosen yet, route to style discovery first. This is a
      // product-state-machine gate keyed on hasSelectedStyle, NOT an intent
      // guess about what the user said.
      const shouldRequireInitialStyle = Boolean(
        !hasGeneratedDeck
        && decision.readyToGenerate
        && decision.brief
        && !hasSelectedStyle,
      );

      const shouldDiscoverStyle = decision.nextAction === "discover-styles" || decision.nextAction === "more-styles";

      const basePayload: Omit<AgentChatResultPayload, "proposal" | "executeProposalId"> = shouldRequireInitialStyle
        ? {
          reply: "内容方向已经确认。生成前先按 frontend-slides 为你准备一组真实标题页预览，请从中选择整套演示文稿的视觉系统。",
          readyToGenerate: false,
          brief: decision.brief,
          nextAction: "discover-styles",
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

      const proposal = deckContext && guarded.reason !== "generation-in-progress"
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
