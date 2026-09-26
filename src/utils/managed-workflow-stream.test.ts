import { afterEach, describe, expect, it, vi } from "vitest";
import { createManagedWorkflowStream } from "./managed-workflow-stream";

type Options = Parameters<typeof createManagedWorkflowStream<string>>[0];
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
async function collect<T>(stream: ReadableStream<T>) {
  const chunks: T[] = [];
  const reader = stream.getReader();
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) return chunks;
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
}
function setup(extra: Partial<Options> = {}) {
  const abort = new AbortController();
  const cancelWorkflow = vi.fn();
  const createStream = vi.fn(() => new ReadableStream<string>({ start(c) { c.enqueue("value"); c.close(); } }));
  return { abort, cancelWorkflow, createStream,
    options: { signal: abort.signal, createStream, cancelWorkflow, ...extra } satisfies Options };
}
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe("managed workflow response lifetime", () => {
  it("preserves ordered prelude and source chunks without cancelling on EOF", async () => {
    const state = setup({ initialChunks: ["run"] });
    expect(await collect(createManagedWorkflowStream(state.options))).toEqual(["run", "value"]);
    state.abort.abort();
    expect(state.cancelWorkflow).not.toHaveBeenCalled();
  });
  it("does not start a source for a pre-aborted request", async () => {
    const state = setup(); state.abort.abort();
    await expect(collect(createManagedWorkflowStream(state.options))).rejects.toMatchObject({ name: "AbortError" });
    expect(state.createStream).not.toHaveBeenCalled();
    expect(state.cancelWorkflow).toHaveBeenCalledTimes(1);
  });
  it("does not start a source after the absolute request deadline", async () => {
    const state = setup({ deadline: Date.now() - 1 });
    await expect(collect(createManagedWorkflowStream(state.options))).rejects.toMatchObject({ name: "TimeoutError" });
    expect(state.createStream).not.toHaveBeenCalled();
    expect(state.cancelWorkflow).toHaveBeenCalledTimes(1);
  });
  it("turns upstream errors into one safe terminal chunk", async () => {
    const state = setup({ createStream: () => new ReadableStream({ start(c) { c.error(new Error("private provider detail")); } }), onError: () => "safe-error" });
    expect(await collect(createManagedWorkflowStream(state.options))).toEqual(["safe-error"]);
    expect(state.cancelWorkflow).toHaveBeenCalledTimes(1);
  });
  it("cleans up when the stream factory throws", async () => {
    const state = setup({ createStream: () => { throw new Error("setup failed"); } });
    await expect(collect(createManagedWorkflowStream(state.options))).rejects.toThrow("setup failed");
    expect(state.cancelWorkflow).toHaveBeenCalledTimes(1);
  });
  it("aborts pending reads and releases the source lock", async () => {
    const cancel = vi.fn(); const source = new ReadableStream<string>({ cancel });
    const state = setup({ createStream: () => source });
    const reader = createManagedWorkflowStream(state.options).getReader();
    const rejected = expect(reader.read()).rejects.toMatchObject({ name: "AbortError" });
    await tick(); state.abort.abort(); await rejected; await tick();
    expect(source.locked).toBe(false);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(state.cancelWorkflow).toHaveBeenCalledTimes(1);
    reader.releaseLock();
  });
  it("does not wait for uncooperative cancellation promises", async () => {
    const cancelWorkflow = vi.fn(() => new Promise<void>(() => {}));
    const source = new ReadableStream<string>({ cancel: () => new Promise<void>(() => {}) });
    const state = setup({ createStream: () => source, cancelWorkflow });
    await createManagedWorkflowStream(state.options).cancel("left");
    expect(source.locked).toBe(false);
    expect(cancelWorkflow).toHaveBeenCalledTimes(1);
  });
  it("handles both synchronous and asynchronous cancellation failures", async () => {
    for (const cancelWorkflow of [() => { throw new Error("sync"); }, () => Promise.reject(new Error("async"))]) {
      const onCancelError = vi.fn(); const state = setup({ cancelWorkflow, onCancelError });
      await createManagedWorkflowStream(state.options).cancel(); await tick();
      expect(onCancelError).toHaveBeenCalledTimes(1);
    }
  });
  it("does not leak an unhandled rejection when the cleanup logger also throws", async () => {
    const state = setup({ cancelWorkflow: () => Promise.reject(new Error("cancel")), onCancelError: () => { throw new Error("logger"); } });
    await createManagedWorkflowStream(state.options).cancel(); await tick();
  });
  it("releases a reader acquired after a synchronous abort inside the factory", async () => {
    const cancel = vi.fn(); const source = new ReadableStream<string>({ cancel });
    const state = setup(); state.options.createStream = () => { state.abort.abort(); return source; };
    await expect(collect(createManagedWorkflowStream(state.options))).rejects.toMatchObject({ name: "AbortError" });
    await tick(); expect(source.locked).toBe(false); expect(cancel).toHaveBeenCalledTimes(1);
    expect(state.cancelWorkflow).toHaveBeenCalledTimes(1);
  });
  it("ends a stalled stream before its deadline and releases the lock", async () => {
    vi.useFakeTimers();
    const source = new ReadableStream<string>();
    const state = setup({ createStream: () => source, deadline: Date.now() + 100, onError: () => "timeout" });
    const result = collect(createManagedWorkflowStream(state.options));
    await vi.advanceTimersByTimeAsync(100);
    expect(await result).toEqual(["timeout"]);
    expect(source.locked).toBe(false); expect(state.cancelWorkflow).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("clears the deadline and removes the abort listener after successful EOF", async () => {
    vi.useFakeTimers(); const state = setup({ deadline: Date.now() + 100 });
    const add = vi.spyOn(state.abort.signal, "addEventListener");
    const remove = vi.spyOn(state.abort.signal, "removeEventListener");
    await collect(createManagedWorkflowStream(state.options));
    expect(remove).toHaveBeenCalledWith("abort", add.mock.calls[0][1]);
    expect(vi.getTimerCount()).toBe(0); state.abort.abort();
    expect(state.cancelWorkflow).not.toHaveBeenCalled();
  });
  it("does not eagerly drain the upstream into an intermediate queue", async () => {
    let reads = 0;
    const source = new ReadableStream<string>({ pull(c) { reads++; c.enqueue(String(reads)); } }, { highWaterMark: 0 });
    const state = setup({ createStream: () => source });
    const managed = createManagedWorkflowStream(state.options);
    await tick(); expect(reads).toBe(0);
    const reader = managed.getReader(); expect((await reader.read()).value).toBe("1");
    await tick(); expect(reads).toBe(1); await reader.cancel(); reader.releaseLock();
  });
});
