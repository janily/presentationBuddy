import { describe, expect, it } from "vitest";
import { requestsCancelledGenerationRetry } from "./cancelled-generation-retry";

describe("requestsCancelledGenerationRetry", () => {
  it.each([
    "重新生成下，刚不小心取消了",
    "继续刚才的生成",
    "恢复生成",
    "重试",
    "再来一次",
  ])("recognizes a retry of the cancelled generation: %s", (message) => {
    expect(requestsCancelledGenerationRetry(message)).toBe(true);
  });

  it.each([
    "换成现代科技风",
    "整体更简洁",
    "重新规划一下内容结构",
  ])("does not consume a new revision request: %s", (message) => {
    expect(requestsCancelledGenerationRetry(message)).toBe(false);
  });
});
