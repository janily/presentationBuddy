import type { AgentChatResponse } from "@/src/types/agent-chat";
import type { StudioPhase } from "./use-studio-phase";

const DEFERRED_DURING_GENERATION = new Set<NonNullable<AgentChatResponse["nextAction"]>>([
  "revise-content",
  "revise-structure",
  "change-palette",
  "discover-styles",
  "more-styles",
  "select-style",
  "execute-proposal",
  "generate",
]);

export function shouldDeferAgentAction(
  phase: StudioPhase,
  decision: Pick<AgentChatResponse, "readyToGenerate" | "nextAction">,
) {
  if (phase !== "generating") return false;
  return Boolean(
    decision.readyToGenerate
    || (decision.nextAction && DEFERRED_DURING_GENERATION.has(decision.nextAction)),
  );
}

export function shouldAppendReplayMessage(
  lastMessage: { role: "user" | "assistant"; content: string } | undefined,
  replayMessage: string,
) {
  return lastMessage?.role !== "user" || lastMessage.content !== replayMessage;
}
