import { describe, expect, it, vi } from "vitest";
import { runWithFrontendSlidesRepair } from "./presentation-generation-workflow";

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
