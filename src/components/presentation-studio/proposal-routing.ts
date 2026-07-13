import type { AgentActionProposal } from "@/src/types/agent-chat";
import { classifyProposalConfirmation } from "@/src/utils/proposal-confirmation";

type CurrentArtifactIdentity = {
  deckId: string;
  version: number;
};

export type ProposalConfirmationResolution =
  | { kind: "execute"; proposal: AgentActionProposal }
  | { kind: "amend" }
  | { kind: "stale" }
  | { kind: "consumed" }
  | { kind: "none" };

export function resolveProposalConfirmation(
  message: string,
  proposal: AgentActionProposal | null,
  currentArtifact: CurrentArtifactIdentity | null,
): ProposalConfirmationResolution {
  if (!proposal) return { kind: "none" };

  const confirmationIntent = classifyProposalConfirmation(message);
  if (confirmationIntent === "none") return { kind: "none" };
  if (proposal.status === "consumed" || proposal.status === "executing") return { kind: "consumed" };
  if (proposal.status !== "pending") return { kind: "none" };
  if (confirmationIntent === "amend") return { kind: "amend" };

  if (
    !currentArtifact
    || currentArtifact.deckId !== proposal.deckId
    || currentArtifact.version !== proposal.baseVersion
  ) {
    return { kind: "stale" };
  }

  return { kind: "execute", proposal };
}

const chineseNumbers: Record<string, number> = {
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

function extractSlideDelta(instruction: string, verbs: string) {
  const normalizedInstruction = instruction.replace(/第\s+(?=[一二三四五六七八九十\d])/g, "第");
  const match = normalizedInstruction.match(new RegExp(`(?:${verbs}).{0,16}(?<![第\\d])(?:(\\d+)|([一二三四五六七八九十]))(?:个|张)?(?:.{0,12})?(?:页|页面|幻灯片|slide)`, "i"));
  if (match) return match[1] ? Number(match[1]) : chineseNumbers[match[2]] ?? 0;
  return new RegExp(`(?:${verbs}).{0,24}(?:页|页面|幻灯片|slide)`, "i").test(normalizedInstruction) ? 1 : 0;
}

export function resolveStructureRevisionPageCount(currentCount: number, instruction: string) {
  const additions = extractSlideDelta(instruction, "增加|新增|添加|插入|补充");
  const removals = extractSlideDelta(instruction, "删除|删掉|移除|去掉");
  return Math.min(12, Math.max(3, currentCount + additions - removals));
}
