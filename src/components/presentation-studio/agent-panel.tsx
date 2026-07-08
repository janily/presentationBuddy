"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";

export type AgentMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

interface AgentPanelProps {
  messages: AgentMessage[];
  isSending: boolean;
  onSend: (message: string) => void;
  title?: string;
  subtitle?: string;
  helperText?: string;
  quickPrompts?: string[];
  placeholder?: string;
}

const defaultQuickPrompts = [
  "帮我做一份融资路演",
  "生成产品发布会 deck",
  "优化现有演示结构",
];

export default function AgentPanel({
  messages,
  isSending,
  onSend,
  title = "Tell the agent what to build",
  subtitle = "Use natural language to create your first outline.",
  helperText = "直接描述需求即可，我会主动确认缺失的信息并自动开始生成。",
  quickPrompts = defaultQuickPrompts,
  placeholder = "例如：为 SaaS 产品发布会做 8 页演示，面向企业客户，风格简洁高级，需要包含痛点、产品能力和 CTA。",
}: AgentPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const canSend = input.trim().length > 0 && !isSending;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, isSending]);

  const sendPrompt = (prompt: string) => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || isSending) return;

    setInput("");
    onSend(trimmedPrompt);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendPrompt(input);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-[var(--border-light)] bg-[var(--bg-elevated)] shadow-sm">
      <div className="border-b border-[var(--border-light)] p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[var(--accent-terracotta)]/10 p-2 text-[var(--accent-terracotta)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">{title}</h3>
            <p className="text-xs text-[var(--text-muted)]">{subtitle}</p>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-[var(--accent-terracotta)] text-white" : "border border-[var(--border-light)] bg-[var(--bg-card)] text-[var(--text-secondary)]"}`}>
              {message.content}
            </div>
          </div>
        ))}
        {isSending ? (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] px-4 py-3 text-sm text-[var(--text-muted)]">
              <span className="animate-pulse">正在思考…</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 space-y-4 border-t border-[var(--border-light)] p-4">
        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => sendPrompt(prompt)}
              className="rounded-full border border-[var(--border-light)] bg-[var(--bg-card)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--accent-terracotta)] hover:text-[var(--accent-terracotta)]"
            >
              {prompt}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <label className="sr-only" htmlFor="agent-prompt">Presentation request</label>
          <textarea
            id="agent-prompt"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                sendPrompt(input);
              }
            }}
            placeholder={placeholder}
            className="input min-h-24 flex-1 resize-none"
          />
          <button
            type="submit"
            disabled={!canSend}
            className="self-end rounded-xl bg-[var(--accent-terracotta)] p-3 text-white shadow-md transition hover:bg-[var(--accent-terracotta-light)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send presentation request"
          >
            <Send className={`h-5 w-5 ${isSending ? "animate-pulse" : ""}`} />
          </button>
        </form>
        <p className="text-xs leading-5 text-[var(--text-muted)]">{helperText}</p>
      </div>
    </section>
  );
}
