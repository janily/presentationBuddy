import type { UIMessageChunk } from "ai";
import type { AgentChatResponse, AgentChatUIChunk } from "@/src/types/agent-chat";
import { dispatchAgentChatUIChunk, type AgentChatStreamCallbacks } from "./agent-chat-ui-stream";

export async function consumeAgentStream(
  stream: ReadableStream<UIMessageChunk>,
  callbacks: AgentChatStreamCallbacks,
): Promise<AgentChatResponse> {
  const reader = stream.getReader();
  let result: AgentChatResponse | undefined;
  const cancel = () => { void reader.cancel(callbacks.signal.reason).catch(() => undefined); };
  callbacks.signal.addEventListener("abort", cancel, { once: true });

  try {
    callbacks.signal.throwIfAborted();
    while (true) {
      const { done, value } = await reader.read();
      callbacks.signal.throwIfAborted();
      if (done) break;
      // The SDK validates standard framing but erases application data-part
      // generics on its transport return type. Our route owns those data parts.
      const dispatched = dispatchAgentChatUIChunk(value as AgentChatUIChunk, callbacks);
      if (dispatched.error) throw new Error(dispatched.error);
      if (dispatched.result) result = dispatched.result;
    }
    if (!result?.reply) throw new Error("Agent chat stream ended without a result");
    return result;
  } finally {
    callbacks.signal.removeEventListener("abort", cancel);
    // Cancel releases a still-open source on errors/callback exceptions; after
    // normal EOF it is a no-op. Never retain a lock after any exit path.
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
