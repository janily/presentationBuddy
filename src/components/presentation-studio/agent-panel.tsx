"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Eye, FileText, RefreshCcw, Send, Sparkles } from "lucide-react";
import { getPhaseLabel, type StudioErrorSource, type StudioPhase } from "./use-studio-phase";

export type AgentMessage =
  | { id: string; role: "assistant" | "user"; kind?: "text"; content: string }
  | { id: string; role: "system"; kind: "outline-review"; slideCount: number; canGenerate: boolean; disabledReason?: string | null }
  | { id: string; role: "system"; kind: "progress"; message: string; progress?: number; steps?: Array<{ id: string; label: string; status: "pending" | "active" | "completed"; detail?: string }> }
  | { id: string; role: "system"; kind: "complete"; slideCount: number; htmlUrl?: string }
  | { id: string; role: "system"; kind: "error"; message: string; retryKind: StudioErrorSource }
  | { id: string; role: "system"; kind: "generation-request"; message: string; queued?: boolean };

interface AgentPanelProps {
  messages: AgentMessage[];
  phase: StudioPhase;
  isSending: boolean;
  onSend: (message: string) => void;
  onGenerate: () => void;
  onOpenOutline: () => void;
  onRetry: (kind: StudioErrorSource) => void;
  onQueueAfterGeneration: (messageId: string, message: string) => void;
  onRestartWithMessage: (messageId: string, message: string) => void;
  title?: string;
  subtitle?: string;
}

const phaseCopy: Record<StudioPhase, { subtitle: string; placeholder: string; prompts: string[] }> = {
  briefing: {
    subtitle: "Describe the deck you need; the agent will clarify and draft the outline.",
    placeholder: "Describe the presentation you want...",
    prompts: ["Investor pitch deck", "Product launch deck", "Executive strategy brief"],
  },
  outlining: {
    subtitle: "The outline is being drafted. You can add requirements while it works.",
    placeholder: "Add a requirement while the outline is being drafted...",
    prompts: [],
  },
  reviewing: {
    subtitle: "Review the outline in the conversation, then generate the HTML deck.",
    placeholder: "Want to adjust the outline? Say it here...",
    prompts: ["Add a customer example slide", "Make the tone more executive", "Use a more visual story"],
  },
  generating: {
    subtitle: "Generation is running. New requests need confirmation before changing the run.",
    placeholder: "Add a new requirement for after this run...",
    prompts: [],
  },
  previewing: {
    subtitle: "The preview is ready. Keep refining with natural language.",
    placeholder: "Tell me what to change in this deck...",
    prompts: ["Make it more concise", "Change the style", "Remove slide 3"],
  },
  error: {
    subtitle: "A workflow step needs attention. Use the retry card in the conversation.",
    placeholder: "Add context before retrying...",
    prompts: [],
  },
};

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-0.5" aria-label="Agent is thinking">
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

function OutlineReviewCard({
  message,
  onGenerate,
  onOpenOutline,
}: {
  message: Extract<AgentMessage, { kind: "outline-review" }>;
  onGenerate: () => void;
  onOpenOutline: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[var(--accent-terracotta)]/30 bg-[var(--accent-terracotta)]/10 p-4">
      <div className="flex gap-3">
        <div className="rounded-xl bg-white/70 p-2 text-[var(--accent-terracotta)]">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-brass)]">Outline ready</p>
          <h4 className="mt-1 font-semibold text-[var(--text-primary)]">{message.slideCount} slides are ready to generate.</h4>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
            Generate the HTML deck now, or open the outline editor if you need precise slide-level changes.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onGenerate}
              disabled={!message.canGenerate}
              className="rounded-xl bg-[var(--accent-terracotta)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-terracotta-light)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Generate presentation ({message.slideCount})
            </button>
            <button
              type="button"
              onClick={onOpenOutline}
              className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent-terracotta)] hover:text-[var(--accent-terracotta)]"
            >
              Edit outline
            </button>
          </div>
          {message.disabledReason ? <p className="mt-2 text-xs text-[var(--accent-terracotta)]">{message.disabledReason}</p> : null}
        </div>
      </div>
    </div>
  );
}

function ProgressCard({ message }: { message: Extract<AgentMessage, { kind: "progress" }> }) {
  const visibleSteps = message.steps ?? [];

  return (
    <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] p-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-[var(--accent-brass)]/10 p-2 text-[var(--accent-brass)]">
          <Sparkles className="h-5 w-5 animate-pulse" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{message.message}</p>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-[var(--bg-secondary)]">
            <div className="h-full rounded-full bg-[var(--accent-terracotta)] transition-all duration-500" style={{ width: `${message.progress ?? 35}%` }} />
          </div>
        </div>
      </div>
      {visibleSteps.length > 0 ? (
        <div className="mt-4 space-y-2">
          {visibleSteps.map((step) => (
            <div key={step.id} className="flex items-start gap-2 text-xs leading-5">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                step.status === "completed"
                  ? "bg-emerald-500"
                  : step.status === "active"
                    ? "animate-pulse bg-[var(--accent-terracotta)]"
                    : "bg-[var(--border-medium)]"
              }`} />
              <div className="min-w-0">
                <p className={step.status === "pending" ? "text-[var(--text-muted)]" : "font-medium text-[var(--text-secondary)]"}>
                  {step.label}
                </p>
                {step.detail && step.status === "active" ? (
                  <p className="truncate text-[var(--text-muted)]">{step.detail}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CompleteCard({ message, onOpenOutline }: { message: Extract<AgentMessage, { kind: "complete" }>; onOpenOutline: () => void }) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
      <div className="flex gap-3">
        <div className="rounded-xl bg-white/80 p-2 text-emerald-700">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Preview ready</p>
          <h4 className="mt-1 font-semibold">{message.slideCount} slides generated.</h4>
          <p className="mt-1 text-sm leading-6 text-emerald-900">Tell me what to change next, or download the generated HTML.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {message.htmlUrl ? (
              <a
                href={message.htmlUrl}
                download
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
              >
                <Download className="h-4 w-4" />
                Download HTML
              </a>
            ) : null}
            <button
              type="button"
              onClick={onOpenOutline}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:border-emerald-400"
            >
              <Eye className="h-4 w-4" />
              View outline
            </button>
          </div>
        </div>
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
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">Generation issue</p>
          <p className="mt-2 text-sm leading-6">{message.message}</p>
          <button
            type="button"
            onClick={() => onRetry(message.retryKind)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800"
          >
            <RefreshCcw className="h-4 w-4" />
            Retry
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
      <p className="text-sm font-semibold text-[var(--text-primary)]">Generation is already running.</p>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">New request: &ldquo;{message.message}&rdquo;</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onQueueAfterGeneration(message.id, message.message)}
          disabled={message.queued}
          className="rounded-xl bg-[var(--accent-terracotta)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-terracotta-light)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {message.queued ? "Will apply after completion" : "Apply after completion"}
        </button>
        <button
          type="button"
          onClick={() => onRestartWithMessage(message.id, message.message)}
          className="rounded-xl border border-[var(--border-light)] bg-white px-4 py-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent-terracotta)] hover:text-[var(--accent-terracotta)]"
        >
          Stop and restart
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
  onOpenOutline,
  onRetry,
  onQueueAfterGeneration,
  onRestartWithMessage,
  title = "Agent",
  subtitle,
}: AgentPanelProps) {
  const [input, setInput] = useState("");
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const phaseConfig = phaseCopy[phase];
  const canSend = input.trim().length > 0 && !isSending;
  const prompts = useMemo(() => phaseConfig.prompts, [phaseConfig.prompts]);

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
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--border-light)] bg-[var(--bg-elevated)] shadow-sm">
      <div className="shrink-0 border-b border-[var(--border-light)] p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[var(--accent-terracotta)]/10 p-2 text-[var(--accent-terracotta)]">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-[var(--text-primary)]">{title}</h3>
              <span className="rounded-full border border-[var(--border-light)] bg-[var(--bg-card)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-brass)]">
                {getPhaseLabel(phase)}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{subtitle ?? phaseConfig.subtitle}</p>
          </div>
        </div>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-5">
        {messages.map((message) => {
          if (message.kind === "outline-review") {
            return <OutlineReviewCard key={message.id} message={message} onGenerate={onGenerate} onOpenOutline={onOpenOutline} />;
          }

          if (message.kind === "progress") {
            return <ProgressCard key={message.id} message={message} />;
          }

          if (message.kind === "complete") {
            return <CompleteCard key={message.id} message={message} onOpenOutline={onOpenOutline} />;
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

        {isSending ? (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] px-4 py-3">
              <TypingDots />
            </div>
          </div>
        ) : null}
      </div>

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
            placeholder={phaseConfig.placeholder}
            className="input min-h-20 flex-1 resize-none"
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
      </div>
    </section>
  );
}
