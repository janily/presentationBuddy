import { afterEach, describe, expect, it, vi } from "vitest";
import { runWithFrontendSlidesRepair, withPresentationTimeout } from "./presentation-generation-workflow";

describe("presentation stream deadlines", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("clears timers after successful stream reads instead of accumulating one per chunk", async () => {
    vi.useFakeTimers();
    for (let i = 0; i < 100; i++) {
      await expect(withPresentationTimeout(Promise.resolve(i), 240_000, "idle")).resolves.toBe(i);
    }
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the timeout when the underlying read fails", async () => {
    vi.useFakeTimers();
    await expect(withPresentationTimeout(Promise.reject(new Error("provider failed")), 240_000, "idle")).rejects.toThrow("provider failed");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects a stalled read at the configured deadline", async () => {
    vi.useFakeTimers();
    const pending = withPresentationTimeout(new Promise(() => undefined), 100, "stream idle");
    const assertion = expect(pending).rejects.toThrow("stream idle");
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("frontend-slides generation retry", () => {
  it("does not run repair after the request is cancelled", async () => {
    const controller = new AbortController();
    const repairAttempt = vi.fn();
    const initialAttempt = vi.fn(async () => {
      controller.abort();
      throw new Error("promise 'text' was not resolved or rejected when stream finished");
    });

    await expect(runWithFrontendSlidesRepair({
      abortSignal: controller.signal,
      initialAttempt,
      repairAttempt,
    })).rejects.toThrow("Presentation HTML generation was cancelled by the client");

    expect(initialAttempt).toHaveBeenCalledOnce();
    expect(repairAttempt).not.toHaveBeenCalled();
  });

  it("stops waiting for an in-flight initial attempt as soon as the request is cancelled", async () => {
    const controller = new AbortController();
    const repairAttempt = vi.fn();
    const result = runWithFrontendSlidesRepair({
      abortSignal: controller.signal,
      initialAttempt: () => new Promise<string>(() => undefined),
      repairAttempt,
    });

    controller.abort();

    await expect(result).rejects.toThrow("Presentation HTML generation was cancelled by the client");
    expect(repairAttempt).not.toHaveBeenCalled();
  });
});
