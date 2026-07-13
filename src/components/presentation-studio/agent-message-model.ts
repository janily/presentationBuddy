import type { StudioErrorSource } from "./use-studio-phase";
import type { AgentQuickActionDefinition } from "./agent-quick-actions";
import type { AgentActionProposal } from "@/src/types/agent-chat";

export type AgentMessage =
  | { id: string; role: "assistant" | "user"; kind?: "text"; content: string; reasoningSummary?: string; streamState?: "connecting" | "reasoning" | "answering" | "finalizing" | "done" | "cancelled" | "error"; isStreaming?: boolean }
  | { id: string; role: "system"; kind: "quick-choice"; action: AgentQuickActionDefinition }
  | { id: string; role: "system"; kind: "action-proposal"; proposal: AgentActionProposal }
  | { id: string; role: "system"; kind: "outline-review"; slideCount: number; canGenerate: boolean; disabledReason?: string | null }
  | { id: string; role: "system"; kind: "complete"; slideCount: number; htmlUrl?: string; generator?: "frontend-slides" | "backup"; fallbackReason?: string }
  | { id: string; role: "system"; kind: "error"; message: string; retryKind: StudioErrorSource }
  | { id: string; role: "system"; kind: "generation-request"; message: string; queued?: boolean };

type CompletionMessageInput = {
  artifactId: string;
  slideCount: number;
  htmlUrl?: string;
  generator?: "frontend-slides" | "backup";
  fallbackReason?: string;
};

export function appendCompletionMessage(
  messages: AgentMessage[],
  input: CompletionMessageInput,
) {
  const id = `complete-${input.artifactId}`;
  if (messages.some((message) => message.id === id)) return messages;

  return [
    ...messages,
    {
      id,
      role: "system" as const,
      kind: "complete" as const,
      slideCount: input.slideCount,
      htmlUrl: input.htmlUrl,
      generator: input.generator,
      fallbackReason: input.fallbackReason,
    },
  ];
}
