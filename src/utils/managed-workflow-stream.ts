interface ManagedWorkflowStreamOptions<T> {
  signal: AbortSignal;
  createStream: () => ReadableStream<T>;
  cancelWorkflow: () => unknown;
  initialChunks?: T[];
  /** Absolute request deadline, including time spent allocating the run. */
  deadline?: number;
  onError?: (error: unknown) => T;
  onCancelError?: (error: unknown) => void;
}

/** Own the response, upstream reader and workflow cancellation as one lifetime. */
export function createManagedWorkflowStream<T>(options: ManagedWorkflowStreamOptions<T>): ReadableStream<T> {
  const { signal, createStream, cancelWorkflow, initialChunks = [], deadline, onError, onCancelError } = options;
  let reader: ReadableStreamDefaultReader<T> | undefined;
  let controller: ReadableStreamDefaultController<T>;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let settled = false;
  let cancellationRequested = false;

  const reportCancellationError = (error: unknown) => {
    try { onCancelError?.(error); } catch { /* A logger must not reject cleanup. */ }
  };
  const bestEffort = (operation: () => unknown) => {
    try { void Promise.resolve(operation()).catch(reportCancellationError); }
    catch (error) { reportCancellationError(error); }
  };
  const releaseReader = (cancel: boolean, reason?: unknown) => {
    const activeReader = reader;
    reader = undefined;
    if (!activeReader) return;
    if (cancel) bestEffort(() => activeReader.cancel(reason));
    // Do not wait for an upstream cancel promise that may never settle.
    try { activeReader.releaseLock(); } catch { /* Already released. */ }
  };
  const cleanup = () => {
    if (timer !== undefined) clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  };
  const terminate = (error: unknown, notifyClient = true) => {
    if (settled) return;
    settled = true;
    cleanup();
    releaseReader(true, error);
    if (!cancellationRequested) {
      cancellationRequested = true;
      bestEffort(cancelWorkflow);
    }
    if (!notifyClient) return;
    try {
      if (onError) {
        controller.enqueue(onError(error));
        controller.close();
      } else {
        controller.error(error);
      }
    } catch (formatError) {
      controller.error(formatError);
    }
  };
  const onAbort = () => terminate(new DOMException("Presentation generation was cancelled", "AbortError"));
  const onTimeout = () => terminate(new DOMException("Presentation generation exceeded the request time limit", "TimeoutError"));

  return new ReadableStream<T>({
    start(streamController) {
      controller = streamController;
      // Register before invoking the source factory, not after model work starts.
      if (signal.aborted) { onAbort(); return; }
      if (deadline !== undefined && deadline <= Date.now()) { onTimeout(); return; }
      signal.addEventListener("abort", onAbort, { once: true });
      if (deadline !== undefined) timer = setTimeout(onTimeout, Math.max(0, deadline - Date.now()));
      try {
        for (const chunk of initialChunks) controller.enqueue(chunk);
        reader = createStream().getReader();
        // The factory can synchronously trigger an abort before assigning reader.
        if (settled) releaseReader(true, signal.reason);
      } catch (error) {
        terminate(error);
      }
    },
    async pull() {
      if (settled || !reader) return;
      try {
        const result = await reader.read();
        if (settled) return;
        if (result.done) {
          settled = true;
          cleanup();
          releaseReader(false);
          controller.close();
        } else {
          controller.enqueue(result.value);
        }
      } catch (error) {
        terminate(error);
      }
    },
    cancel(reason) {
      terminate(reason, false);
    },
  }, { highWaterMark: 0 });
}
