"use client";

import { FormEvent, useMemo, useState } from "react";
import { Send, Sparkles } from "lucide-react";

type AgentMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

interface AgentPanelProps {
  onSubmit: (message: string) => void;
  title?: string;
  subtitle?: string;
  initialMessage?: string;
  helperText?: string;
  quickPrompts?: string[];
  placeholder?: string;
}

const guidance = "告诉我你想做什么演示文稿：主题、受众、页数、风格或任何特殊要求都可以直接说。";

const defaultQuickPrompts = [
  "帮我做一份融资路演",
  "生成产品发布会 deck",
  "优化现有演示结构",
];

const makeMessageId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export default function AgentPanel({
  onSubmit,
  title = "Tell the agent what to build",
  subtitle = "Use natural language to create your first outline.",
  initialMessage = guidance,
  helperText,
  quickPrompts = defaultQuickPrompts,
  placeholder = "例如：为 SaaS 产品发布会做 8 页演示，面向企业客户，风格简洁高级，需要包含痛点、产品能力和 CTA。",
}: AgentPanelProps) {
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: "initial-guidance",
      role: "assistant",
      content: initialMessage,
    },
  ]);
  const [input, setInput] = useState("");
  const canSend = input.trim().length > 0;

  const computedHelperText = useMemo(() => {
    if (helperText) return helperText;
    if (messages.length <= 1) return "你可以先点一个快捷提示词，也可以直接输入完整需求。";
    return "我会先把你的自然语言作为主题和需求生成大纲，后续可继续细化 brief 提取逻辑。";
  }, [helperText, messages.length]);

  const sendPrompt = (prompt: string) => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;

    setMessages((current) => [
      ...current,
      { id: makeMessageId(), role: "user", content: trimmedPrompt },
      {
        id: makeMessageId(),
        role: "assistant",
        content: "收到，我会先根据这段需求生成演示文稿大纲。",
      },
    ]);
    setInput("");
    onSubmit(trimmedPrompt);
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

      <div className="min-h-72 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-[var(--accent-terracotta)] text-white" : "border border-[var(--border-light)] bg-[var(--bg-card)] text-[var(--text-secondary)]"}`}>
              {message.content}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4 border-t border-[var(--border-light)] p-4">
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
            placeholder={placeholder}
            className="input min-h-24 flex-1 resize-none"
          />
          <button
            type="submit"
            disabled={!canSend}
            className="self-end rounded-xl bg-[var(--accent-terracotta)] p-3 text-white shadow-md transition hover:bg-[var(--accent-terracotta-light)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send presentation request"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
        <p className="text-xs leading-5 text-[var(--text-muted)]">{computedHelperText}</p>
      </div>
    </section>
  );
}
