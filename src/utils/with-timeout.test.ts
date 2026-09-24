import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withTimeout } from "./with-timeout";
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("bounded asynchronous operations", () => {
  it("clears the timeout after a successful stream read", async () => {
    await expect(withTimeout(Promise.resolve("chunk"), 240_000, "idle")).resolves.toBe("chunk");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("clears the timeout when the underlying operation fails", async () => {
    await expect(withTimeout(Promise.reject(new Error("provider")), 240_000, "idle")).rejects.toThrow("provider");
    expect(vi.getTimerCount()).toBe(0);
  });
  it("rejects an idle operation at its deadline", async () => {
    const task = withTimeout(new Promise<string>(() => undefined), 100, "stream idle");
    const result = expect(task).rejects.toThrow("stream idle");
    await vi.advanceTimersByTimeAsync(100);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cancels an in-flight read promptly rather than waiting for its deadline", async () => {
    const controller = new AbortController();
    const task = withTimeout(new Promise<string>(() => undefined), 240_000, "idle", controller.signal);
    const result = expect(task).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });
  it("handles an already-aborted signal and late provider rejection", async () => {
    const controller = new AbortController(); controller.abort();
    await expect(withTimeout(Promise.reject(new Error("late provider failure")), 10, "idle", controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(vi.getTimerCount()).toBe(0);
  });
});
