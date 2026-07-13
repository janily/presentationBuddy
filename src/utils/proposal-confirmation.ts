export type ProposalConfirmationIntent = "confirm" | "amend" | "none";

const proposalConfirmationPatterns = [
  /按(?:你(?:的)?|上述|上面|刚才(?:的)?)?(?:方案|建议|大纲|方向)?(?:来)?(?:执行|生成|修改|改)/i,
  /就按(?:你(?:的)?|上述|上面|刚才(?:的)?)?(?:方案|建议|大纲|方向|这个|这样)(?:来)?(?:执行|生成|修改|改)?/i,
  /(?:可以|确认)[，,、\s]*(?:就)?(?:这么|这样)?(?:执行|生成|修改|改|应用)/i,
  /确认应用(?:这些|上述|刚才的)?修改/i,
  /^(?:执行|生成|修改|应用)(?:吧|即可|就行)?[。！!\s]*$/i,
];

const proposalAmendmentPatterns = [
  /(?:但是|但|不过|同时|另外|还要|不要|别|改成|除了|只要|保留)/i,
];

export function classifyProposalConfirmation(message: string): ProposalConfirmationIntent {
  const normalized = message.trim();
  if (!proposalConfirmationPatterns.some((pattern) => pattern.test(normalized))) return "none";
  if (proposalAmendmentPatterns.some((pattern) => pattern.test(normalized))) return "amend";
  return "confirm";
}
