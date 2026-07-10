import { describe, expect, it } from "vitest";
import { getQuickActionDefinition } from "./agent-quick-actions";

describe("presentation quick actions", () => {
  it("turns the visual-style chip into deterministic revision choices", () => {
    const action = getQuickActionDefinition("change-style");

    expect(action.userText).toBe("换一种视觉风格");
    expect(action.choices.map((choice) => choice.label)).toEqual([
      "现代清爽",
      "专业深色",
      "高对比科技",
    ]);
    expect(action.choices.every((choice) => choice.revision.kind === "style")).toBe(true);
  });

  it("provides palette swatches without asking the conversation agent", () => {
    const action = getQuickActionDefinition("change-palette");

    expect(action.userText).toBe("修改配色");
    expect(action.choices).toHaveLength(3);
    expect(action.choices.every((choice) => choice.swatches?.length === 3)).toBe(true);
    expect(action.choices.every((choice) => choice.revision.kind === "palette")).toBe(true);
  });

  it("offers a non-structural concise revision", () => {
    const action = getQuickActionDefinition("make-concise");

    expect(action.choices).toHaveLength(1);
    expect(action.choices[0].revision.requiresOutlineReview).toBe(false);
  });
});
