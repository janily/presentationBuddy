import type { AgentActionProposal } from "@/src/types/agent-chat";

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

const confirmationPatterns = [
  /按(?:你(?:的)?|上述|上面|刚才(?:的)?)?(?:方案|建议|大纲|方向)?(?:来)?(?:执行|生成|修改|改)/i,
  /就按(?:你(?:的)?|上述|上面|刚才(?:的)?)?(?:方案|建议|大纲|方向|这个|这样)(?:来)?(?:执行|生成|修改|改)?/i,
  /(?:可以|确认)[，,、\s]*(?:就)?(?:这么|这样)?(?:执行|生成|修改|改|应用)/i,
  /确认应用(?:这些|上述|刚才的)?修改/i,
  /^(?:执行|生成|修改|应用)(?:吧|即可|就行)?[。！!\s]*$/i,
];

const amendmentPatterns = [
  /(?:但是|但|不过|同时|另外|还要|不要|别|改成|除了|只要|保留)/i,
];

export function resolveProposalConfirmation(
  message: string,
  proposal: AgentActionProposal | null,
  currentArtifact: CurrentArtifactIdentity | null,
): ProposalConfirmationResolution {
  if (!proposal) return { kind: "none" };

  const normalized = message.trim();
  if (!confirmationPatterns.some((pattern) => pattern.test(normalized))) return { kind: "none" };
  if (proposal.status === "consumed" || proposal.status === "executing") return { kind: "consumed" };
  if (proposal.status !== "pending") return { kind: "none" };
  if (amendmentPatterns.some((pattern) => pattern.test(normalized))) return { kind: "amend" };

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
  const match = instruction.match(new RegExp(`(?:${verbs}).{0,8}(?:(\\d+)|([一二三四五六七八九十]))(?:页|张)`, "i"));
  if (!match) return 0;
  return match[1] ? Number(match[1]) : chineseNumbers[match[2]] ?? 0;
}

export function resolveStructureRevisionPageCount(currentCount: number, instruction: string) {
  const additions = extractSlideDelta(instruction, "增加|新增|添加|插入|补充");
  const removals = extractSlideDelta(instruction, "删除|删掉|移除|去掉");
  return Math.min(12, Math.max(3, currentCount + additions - removals));
}
