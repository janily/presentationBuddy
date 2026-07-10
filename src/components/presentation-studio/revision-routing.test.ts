import { describe, expect, it } from "vitest";
import { isStructureChangingRevision } from "./revision-routing";

describe("revision routing", () => {
  it.each([
    "增加一页客户案例",
    "删掉第 3 页",
    "把最后两页调换顺序",
    "add one slide for pricing",
  ])("requires outline review for structural request: %s", (message) => {
    expect(isStructureChangingRevision(message)).toBe(true);
  });

  it.each([
    "换成专业深色风格",
    "修改配色",
    "精简每页文案",
  ])("reuses the approved outline for non-structural request: %s", (message) => {
    expect(isStructureChangingRevision(message)).toBe(false);
  });
});
