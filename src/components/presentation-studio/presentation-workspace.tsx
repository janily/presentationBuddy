"use client";

import { Download, FileText, MessageCircle, RotateCcw, Sparkles } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import type { HtmlGenerationStepData } from "@/src/types/presentation-workflow";
import type { PresentationBrief } from "./brief-form";

interface PresentationWorkspaceProps {
  brief: PresentationBrief | null;
  generatedHtml: string;
  previewOverlay?: ReactNode;
  agentContent?: ReactNode;
  htmlGeneration?: HtmlGenerationStepData;
  onBriefSubmit: (brief: PresentationBrief) => void;
  onStartOver: () => void;
}

const defaultBrief: PresentationBrief = {
  topic: "AI adoption roadmap for sales teams",
  audience: "Revenue leaders and sales managers",
  slideCount: 6,
  style: "Modern executive keynote",
  requirements: "Include a clear problem statement, phased rollout, KPIs, and a closing call to action.",
};

function BriefComposer({ initialBrief, onSubmit }: { initialBrief: PresentationBrief | null; onSubmit: (brief: PresentationBrief) => void }) {
  const [draft, setDraft] = useState<PresentationBrief>(initialBrief ?? defaultBrief);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.topic.trim()) return;
    onSubmit({
      ...draft,
      topic: draft.topic.trim(),
      audience: draft.audience.trim(),
      style: draft.style.trim(),
      requirements: draft.requirements.trim(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-elevated)] p-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-[var(--accent-terracotta)]/10 p-2 text-[var(--accent-terracotta)]">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-[var(--text-primary)]">Presentation brief</h2>
            <p className="text-xs text-[var(--text-muted)]">Tell the agent what to create.</p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">Topic
            <input className="input mt-2 w-full" value={draft.topic} onChange={(event) => setDraft({ ...draft, topic: event.target.value })} />
          </label>
          <label className="block text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">Audience
            <input className="input mt-2 w-full" value={draft.audience} onChange={(event) => setDraft({ ...draft, audience: event.target.value })} />
          </label>
          <div className="grid gap-3 sm:grid-cols-[0.45fr_1fr] lg:grid-cols-1 xl:grid-cols-[0.45fr_1fr]">
            <label className="block text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">Pages
              <input className="input mt-2 w-full" type="number" min={3} max={12} value={draft.slideCount} onChange={(event) => setDraft({ ...draft, slideCount: Number(event.target.value) })} />
            </label>
            <label className="block text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">Style
              <input className="input mt-2 w-full" value={draft.style} onChange={(event) => setDraft({ ...draft, style: event.target.value })} />
            </label>
          </div>
          <label className="block text-xs font-medium uppercase tracking-[0.14em] text-[var(--text-muted)]">Additional requirements
            <textarea className="input mt-2 min-h-24 w-full" value={draft.requirements} onChange={(event) => setDraft({ ...draft, requirements: event.target.value })} />
          </label>
        </div>

        <button type="submit" className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-terracotta)] px-4 py-3 font-medium text-white shadow-md transition hover:bg-[var(--accent-terracotta-light)]">
          <Sparkles className="h-5 w-5" />
          {initialBrief ? "Regenerate outline" : "Create outline"}
        </button>
      </div>
    </form>
  );
}

export default function PresentationWorkspace({ brief, generatedHtml, previewOverlay, agentContent, htmlGeneration, onBriefSubmit, onStartOver }: PresentationWorkspaceProps) {
  const progress = htmlGeneration?.progress;

  const handleDownload = () => {
    if (!generatedHtml) return;
    const blob = new Blob([generatedHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "presentation.html";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen paper-texture">
      <header className="sticky top-0 z-20 border-b border-[var(--border-light)] bg-[var(--bg-card)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}>Presentation Buddy</h1>
            <p className="text-sm text-[var(--text-muted)]">Preview and agent conversation in one workspace</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {generatedHtml ? <button type="button" onClick={handleDownload} className="flex items-center gap-2 rounded-xl bg-[var(--accent-terracotta)] px-4 py-2 text-sm font-medium text-white"><Download className="h-4 w-4" />Download HTML</button> : null}
            <button type="button" onClick={onStartOver} className="flex items-center gap-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)]"><RotateCcw className="h-4 w-4" />Start over</button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_460px]">
        <section className="relative min-h-[calc(100vh-112px)] overflow-hidden rounded-3xl border border-[var(--border-light)] bg-white shadow-lg">
          {generatedHtml ? (
            <iframe title="Generated HTML presentation" sandbox="allow-same-origin" srcDoc={generatedHtml} className="h-[calc(100vh-112px)] min-h-[620px] w-full" />
          ) : (
            <div className="flex h-[calc(100vh-112px)] min-h-[620px] items-center justify-center bg-[linear-gradient(135deg,#faf7f1_0%,#fff_52%,#f7efe5_100%)] p-8 text-center">
              <div className="max-w-xl rounded-3xl border border-dashed border-[var(--border-light)] bg-white/75 p-10 shadow-sm backdrop-blur">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-terracotta)]/10 text-[var(--accent-terracotta)]">
                  <Sparkles className="h-8 w-8" />
                </div>
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent-brass)]">Live preview</p>
                <h2 className="mt-3 text-3xl font-semibold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}>你的演示文稿将在这里实时预览</h2>
                <p className="mt-4 text-[var(--text-secondary)]">Use the agent panel to create a brief, review the outline, and generate an HTML deck without leaving this workspace.</p>
                {typeof progress === "number" ? <div className="mt-6 h-2 overflow-hidden rounded-full bg-[var(--bg-secondary)]"><div className="h-full rounded-full bg-[var(--accent-terracotta)] transition-all duration-500" style={{ width: `${progress}%` }} /></div> : null}
              </div>
            </div>
          )}
          {previewOverlay}
        </section>

        <aside className="flex min-h-[calc(100vh-112px)] flex-col gap-4 rounded-3xl border border-[var(--border-light)] bg-[var(--bg-card)] p-4 shadow-lg">
          <div className="flex items-center gap-3 border-b border-[var(--border-light)] pb-4">
            <div className="rounded-2xl bg-[var(--accent-brass)]/10 p-3 text-[var(--accent-brass)]"><MessageCircle className="h-5 w-5" /></div>
            <div>
              <h2 className="font-semibold text-[var(--text-primary)]">Agent</h2>
              <p className="text-sm text-[var(--text-muted)]">Brief, outline review, and generation controls</p>
            </div>
          </div>
          <BriefComposer initialBrief={brief} onSubmit={onBriefSubmit} />
          {agentContent}
        </aside>
      </main>
    </div>
  );
}
