"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, FileText, RefreshCcw, RotateCcw, Send, Sparkles } from "lucide-react";
import type { StudioErrorSource, StudioPhase } from "./use-studio-phase";

export type AgentMessage =
  | { id: string; role: "assistant" | "user"; kind?: "text"; content: string }
  | { id: string; role: "system"; kind: "outline-review"; slideCount: number; canGenerate: boolean; disabledReason?: string | null }
  | { id: string; role: "system"; kind: "complete"; slideCount: number; htmlUrl?: string }
  | { id: string; role: "system"; kind: "error"; message: string; retryKind: StudioErrorSource }
  | { id: string; role: "system"; kind: "generation-request"; message: string; queued?: boolean };

interface AgentPanelProps {
  messages: AgentMessage[];
  phase: StudioPhase;
  isSending: boolean;
  onSend: (message: string) => void;
  onGenerate: () => void;
  onRetry: (kind: StudioErrorSource) => void;
  onQueueAfterGeneration: (messageId: string, message: string) => void;
  onRestartWithMessage: (messageId: string, message: string) => void;
  onStartOver: () => void;
}

const phaseCopy: Record<StudioPhase, { placeholder: string; prompts: string[] }> = {
  briefing: {
    placeholder: "描述你想要的演示文稿…",
    prompts: [],
  },
  outlining: {
    placeholder: "大纲起草中，可以继续补充要求…",
    prompts: [],
  },
  reviewing: {
    placeholder: "想调整大纲？直接说…",
    prompts: ["增加一页客户案例", "语气更正式一些", "删掉第 3 页"],
  },
  generating: {
    placeholder: "有新想法？生成完成后帮你处理…",
    prompts: [],
  },
  previewing: {
    placeholder: "告诉我这份演示文稿要改哪里…",
    prompts: ["整体更简洁", "换一种视觉风格", "修改配色"],
  },
  error: {
    placeholder: "补充说明后再重试…",
    prompts: [],
  },
};

const emptyStatePrompts = [
  "帮我做一份产品发布会的演示文稿",
  "为投资人准备一份 10 页的融资路演",
  "给团队做一份季度复盘汇报",
];

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5" aria-label="助手思考中">
      {[0, 1, 2].map((item) => (
        <span
          key={item}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-muted)]"
          style={{ animationDelay: `${item * 120}ms` }}
        />
      ))}
    </div>
  );
}

function StatusRow({ text }: { text: string }) {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-2 rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] px-4 py-3">
        <TypingDots />
        <span className="text-sm text-[var(--text-muted)]">{text}</span>
      </div>
    </div>
  );
}

function EmptyState({ onPrompt }: { onPrompt: (prompt: string) => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-terracotta)]/10 text-[var(--accent-terracotta)]">
        <Sparkles className="h-7 w-7" />
      </div>
      <h3 className="text-lg font-semibold text-[var(--text-primary)]">想做什么演示文稿？</h3>
      <p className="mt-2 max-w-xs text-sm leading-6 text-[var(--text-muted)]">告诉我主题、受众和大致页数，我会先生成大纲给你确认。</p>
      <div className="mt-6 w-full max-w-xs space-y-2">
        {emptyStatePrompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPrompt(prompt)}
            className="w-full rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] px-4 py-3 text-left text-sm text-[var(--text-secondary)] transition hover:border-[var(--accent-terracotta)] hover:text-[var(--accent-terracotta)]"
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  );
}

function OutlineReviewCard({
  message,
  onGenerate,
}: {
  message: Extract<AgentMessage, { kind: "outline-review" }>;
  onGenerate: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--accent-terracotta)]/30 bg-[var(--accent-terracotta)]/10 p-4">
      <div className="flex gap-3">
        <div className="rounded-xl bg-white/70 p-2 text-[var(--accent-terracotta)]">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-[var(--text-primary)]">大纲已就绪（{message.slideCount} 页）</h4>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">确认后开始生成，或直接在下方告诉我修改意见。</p>
          <div className="mt-4">
            <button
              type="button"
              onClick={onGenerate}
              disabled={!message.canGenerate}
              className="rounded-xl bg-[var(--accent-terracotta)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-terracotta-light)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              生成演示文稿
            </button>
          </div>
          {message.disabledReason ? <p className="mt-2 text-xs text-[var(--accent-terracotta)]">{message.disabledReason}</p> : null}
        </div>
      </div>
    </div>
  );
}

function CompleteBubble({ message }: { message: Extract<AgentMessage, { kind: "complete" }> }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] px-4 py-3 text-sm leading-6 text-[var(--text-secondary)]">
        已生成 {message.slideCount} 页演示文稿，预览在左侧。想调整哪里，直接告诉我。
      </div>
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: Extract<AgentMessage, { kind: "error" }>; onRetry: (kind: StudioErrorSource) => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-950">
      <div className="flex gap-3">
        <div className="rounded-xl bg-white/80 p-2 text-red-700">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">生成遇到问题</p>
          <p className="mt-2 text-sm leading-6">{message.message}</p>
          <button
            type="button"
            onClick={() => onRetry(message.retryKind)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800"
          >
            <RefreshCcw className="h-4 w-4" />
            重试
          </button>
        </div>
      </div>
    </div>
  );
}

function GenerationRequestCard({
  message,
  onQueueAfterGeneration,
  onRestartWithMessage,
}: {
  message: Extract<AgentMessage, { kind: "generation-request" }>;
  onQueueAfterGeneration: (messageId: string, message: string) => void;
  onRestartWithMessage: (messageId: string, message: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] p-4">
      <p className="text-sm font-semibold text-[var(--text-primary)]">正在生成中。</p>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">新请求：「{message.message}」</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onQueueAfterGeneration(message.id, message.message)}
          disabled={message.queued}
          className="rounded-xl bg-[var(--accent-terracotta)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-terracotta-light)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {message.queued ? "将在完成后应用" : "完成后应用"}
        </button>
        <button
          type="button"
          onClick={() => onRestartWithMessage(message.id, message.message)}
          className="rounded-xl border border-[var(--border-light)] bg-white px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent-terracotta)] hover:text-[var(--accent-terracotta)]"
        >
          停止并重新开始
        </button>
      </div>
    </div>
  );
}

export default function AgentPanel({
  messages,
  phase,
  isSending,
  onSend,
  onGenerate,
  onRetry,
  onQueueAfterGeneration,
  onRestartWithMessage,
  onStartOver,
}: AgentPanelProps) {
  const [input, setInput] = useState("");
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const phaseConfig = phaseCopy[phase];
  const canSend = input.trim().length > 0 && !isSending;
  const prompts = useMemo(() => phaseConfig.prompts, [phaseConfig.prompts]);
  const isEmpty = phase === "briefing" && messages.length === 0;
  const statusText = phase === "outlining" ? "正在生成大纲…" : phase === "generating" ? "正在生成演示文稿…" : null;

  useEffect(() => {
    if (!isPinnedToBottom) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, isSending, isPinnedToBottom]);

  const handleScroll = () => {
    const element = scrollRef.current;
    if (!element) return;

    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    setIsPinnedToBottom(distanceFromBottom < 48);
  };

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
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-light)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--accent-terracotta)]" />
          <h2 className="font-semibold text-[var(--text-primary)]">Presentation Buddy</h2>
        </div>
        <button
          type="button"
          onClick={onStartOver}
          aria-label="重新开始"
          title="重新开始"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--bg-card)] hover:text-[var(--text-primary)]"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {isEmpty ? (
        <EmptyState onPrompt={sendPrompt} />
      ) : (
        <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-5">
          {messages.map((message) => {
            if (message.kind === "outline-review") {
              return <OutlineReviewCard key={message.id} message={message} onGenerate={onGenerate} />;
            }

            if (message.kind === "complete") {
              return <CompleteBubble key={message.id} message={message} />;
            }

            if (message.kind === "error") {
              return <ErrorCard key={message.id} message={message} onRetry={onRetry} />;
            }

            if (message.kind === "generation-request") {
              return (
                <GenerationRequestCard
                  key={message.id}
                  message={message}
                  onQueueAfterGeneration={onQueueAfterGeneration}
                  onRestartWithMessage={onRestartWithMessage}
                />
              );
            }

            return (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "bg-[var(--accent-terracotta)] text-white" : "border border-[var(--border-light)] bg-[var(--bg-card)] text-[var(--text-secondary)]"}`}>
                  {message.content}
                </div>
              </div>
            );
          })}

          {statusText ? <StatusRow text={statusText} /> : null}

          {isSending ? (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] px-4 py-3">
                <TypingDots />
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className="shrink-0 space-y-3 border-t border-[var(--border-light)] p-4">
        {prompts.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {prompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => sendPrompt(prompt)}
                disabled={isSending}
                className="rounded-full border border-[var(--border-light)] bg-[var(--bg-card)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] transition hover:border-[var(--accent-terracotta)] hover:text-[var(--accent-terracotta)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <label className="sr-only" htmlFor="agent-prompt">演示文稿请求</label>
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
            placeholder={phaseConfig.placeholder}
            className="input min-h-20 flex-1 resize-none"
          />
          <button
            type="submit"
            disabled={!canSend}
            className="self-end rounded-xl bg-[var(--accent-terracotta)] p-3 text-white shadow-md transition hover:bg-[var(--accent-terracotta-light)] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="发送演示文稿请求"
          >
            <Send className={`h-5 w-5 ${isSending ? "animate-pulse" : ""}`} />
          </button>
        </form>
        <p className="text-xs text-[var(--text-muted)]">Enter 发送 · Shift+Enter 换行</p>
      </div>
    </section>
  );
}
