import type { BriefDecision } from "@/src/mastra/agents/presentation-brief-conversation-agent";
import type { AgentActionProposal } from "@/src/types/agent-chat";

type IntentRoutingOptions = {
  explicitlyConfirmedGeneration: (message: string) => boolean;
};

type ActionProposalContext = {
  deckId: string;
  version: number;
  proposalId: string;
  createdAt: string;
};

export function createActionProposal(
  decision: BriefDecision,
  context: ActionProposalContext,
): AgentActionProposal | null {
  if (
    (
      decision.nextAction !== "revise-content"
      && decision.nextAction !== "revise-structure"
      && decision.nextAction !== "change-palette"
    )
    || !decision.revision?.instruction.trim()
  ) {
    return null;
  }

  return {
    proposalId: context.proposalId,
    deckId: context.deckId,
    baseVersion: context.version,
    action: decision.nextAction,
    instruction: decision.revision.instruction.trim(),
    targetSlides: decision.revision.targetSlides,
    requiresOutlineReview: decision.revision.requiresOutlineReview,
    userFacingSummary: decision.reply,
    status: "pending",
    createdAt: context.createdAt,
  };
}

export function detectExplicitAction(message: string, hasGeneratedDeck: boolean): BriefDecision["nextAction"] | null {
  if (/(更多|还有|其他|其它|再来|换一批).{0,8}(风格|样式|视觉)|(?:风格|样式|视觉).{0,8}(更多|还有|其他|其它|再来|换一批)/i.test(message)) {
    return "more-styles";
  }
  if (/(风格|样式|视觉方向|视觉系统)/i.test(message)) return "discover-styles";
  if (/(配色|颜色|色彩|色调)/i.test(message)) return "change-palette";
  if (hasGeneratedDeck && /(增加|新增|添加|删除|删掉|移除|合并|拆分|调整顺序|换顺序).{0,10}(页|章节|部分)|第.{0,4}页.{0,8}(删除|移除)/i.test(message)) {
    return "revise-structure";
  }
  if (hasGeneratedDeck && /(丰富|详细|展开|补充|精简|简洁|改写|润色|例子|案例|内容)/i.test(message)) {
    return "revise-content";
  }
  return null;
}

export function applyIntentGuard(
  decision: BriefDecision,
  lastUserMessage: string,
  hasGeneratedDeck: boolean,
  options: IntentRoutingOptions,
): BriefDecision {
  const explicitAction = detectExplicitAction(lastUserMessage, hasGeneratedDeck);
  if (!explicitAction || options.explicitlyConfirmedGeneration(lastUserMessage)) return decision;

  const actionNeedsRevision = explicitAction === "revise-content"
    || explicitAction === "revise-structure"
    || explicitAction === "change-palette";
  if (
    explicitAction === decision.nextAction
    && (!actionNeedsRevision || Boolean(decision.revision?.instruction.trim()))
  ) return decision;

  if (
    explicitAction === "revise-content"
    || explicitAction === "revise-structure"
    || explicitAction === "change-palette"
  ) {
    const requiresOutlineReview = explicitAction === "revise-structure";
    return {
      ...decision,
      reply: explicitAction === "change-palette"
        ? `明白，我会按「${lastUserMessage}」调整配色，并保持当前内容、页数和版式不变。确认后应用修改。`
        : requiresOutlineReview
          ? "明白，你想调整现有内容结构。我会先基于当前大纲整理需要增删或重排的页面，确认新版大纲后再生成。"
          : "明白，你想在保持当前视觉方向和页数的基础上丰富内容。我会结合现有大纲补充论点、示例和必要细节，确认后再应用修改。",
      readyToGenerate: false,
      nextAction: explicitAction,
      revision: { instruction: lastUserMessage, requiresOutlineReview },
      styleId: null,
    };
  }

  return {
    ...decision,
    reply: explicitAction === "more-styles"
      ? "好的，我会避开已经展示过的方案，再推荐一批不同的 frontend-slides 视觉方向。"
      : "好的，我会根据当前主题重新准备一组 frontend-slides 视觉方向供你比较。",
    readyToGenerate: false,
    nextAction: explicitAction,
    revision: null,
    styleId: null,
  };
}
