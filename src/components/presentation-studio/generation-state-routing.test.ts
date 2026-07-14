import { describe, expect, it } from "vitest";
import {
  shouldAppendReplayMessage,
  shouldDeferAgentAction,
} from "./generation-state-routing";

describe("generation state routing", () => {
  it("defers expensive agent actions while generation is in progress", () => {
    expect(shouldDeferAgentAction("generating", {
      readyToGenerate: true,
      nextAction: "generate",
    })).toBe(true);
    expect(shouldDeferAgentAction("generating", {
      readyToGenerate: false,
      nextAction: "execute-proposal",
    })).toBe(true);
  });

  it("allows non-executing chat decisions and actions outside generation", () => {
    expect(shouldDeferAgentAction("generating", {
      readyToGenerate: false,
      nextAction: "chat",
    })).toBe(false);
    expect(shouldDeferAgentAction("previewing", {
      readyToGenerate: true,
      nextAction: "generate",
    })).toBe(false);
  });
});

describe("queued request replay", () => {
  it("reuses an identical latest user turn instead of duplicating it", () => {
    expect(shouldAppendReplayMessage(
      { role: "user", content: "增加一页框架对比" },
      "增加一页框架对比",
    )).toBe(false);
  });

  it("re-appends the request when an assistant reply followed the original turn", () => {
    expect(shouldAppendReplayMessage(
      { role: "assistant", content: "生成完成后再确认。" },
      "增加一页框架对比",
    )).toBe(true);
  });
});
