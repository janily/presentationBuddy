/** Bound an async wait without retaining a losing timer per streamed token.
 * The caller still owns cancellation of the underlying operation/reader.
 */
export function withTimeout<T>(
  operation: PromiseLike<T>,
  ms: number,
  message: string,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => { cleanup(); reject(new Error(message)); }, ms);
    function cleanup() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
    function abort() {
      cleanup();
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    }
    // Always observe the operation, including late rejection after cancellation.
    Promise.resolve(operation).then(
      (value) => { cleanup(); resolve(value); },
      (error) => { cleanup(); reject(error); },
    );
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener("abort", abort, { once: true });
  });
}
