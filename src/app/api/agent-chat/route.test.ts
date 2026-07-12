import { describe, expect, it } from "vitest";
import type { BriefDecision } from "@/src/mastra/agents/presentation-brief-conversation-agent";
import { applyIntentGuard, detectExplicitAction } from "./intent-routing";

const baseDecision: BriefDecision = {
  reply: "正在准备视觉风格预览。",
  readyToGenerate: false,
  nextAction: "discover-styles",
  revision: null,
  styleId: null,
  brief: null,
};

describe("agent chat intent guard", () => {
  it("keeps content enrichment out of style discovery", () => {
    const result = applyIntentGuard(baseDecision, "我觉得内容还需要再丰富下", true, {
      explicitlyConfirmedGeneration: () => false,
    });

    expect(result.nextAction).toBe("revise-content");
    expect(result.revision).toMatchObject({
      instruction: "我觉得内容还需要再丰富下",
      requiresOutlineReview: false,
    });
    expect(result.reply).not.toContain("风格预览");
  });

  it("recognizes a request for another style batch", () => {
    expect(detectExplicitAction("再推荐一些其它的风格", true)).toBe("more-styles");
  });

  it("does not intercept an ordinary question", () => {
    expect(detectExplicitAction("Mastra 和 LangGraph 有什么区别？", true)).toBeNull();
  });
});
