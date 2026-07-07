"use client";

import { FormEvent, useState } from "react";
import { FileText, Sparkles } from "lucide-react";

export interface PresentationBrief {
  topic: string;
  audience: string;
  slideCount: number;
  style: string;
  requirements: string;
}

interface BriefFormProps {
  onSubmit: (brief: PresentationBrief) => void;
}

export default function BriefForm({ onSubmit }: BriefFormProps) {
  const [brief, setBrief] = useState<PresentationBrief>({
    topic: "AI adoption roadmap for sales teams",
    audience: "Revenue leaders and sales managers",
    slideCount: 6,
    style: "Modern executive keynote",
    requirements: "Include a clear problem statement, phased rollout, KPIs, and a closing call to action.",
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!brief.topic.trim()) return;
    onSubmit({ ...brief, topic: brief.topic.trim(), audience: brief.audience.trim(), style: brief.style.trim(), requirements: brief.requirements.trim() });
  };

  return (
    <main className="min-h-screen paper-texture px-4 py-10">
      <section className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--border-light)] bg-[var(--bg-card)] px-4 py-2 text-sm text-[var(--text-secondary)]">
            <Sparkles className="h-4 w-4 text-[var(--accent-brass)]" />
            Presentation Generator
          </div>
          <h1 className="text-4xl font-semibold leading-tight text-[var(--text-primary)] md:text-6xl" style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}>
            Build a polished HTML presentation from a simple brief.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--text-secondary)]">
            Describe the story you need, review the proposed slide outline, then generate a ready-to-preview HTML deck.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-3xl border border-[var(--border-light)] bg-[var(--bg-card)] p-6 shadow-lg">
          <div className="mb-5 flex items-center gap-3">
            <div className="rounded-2xl bg-[var(--accent-terracotta)]/10 p-3 text-[var(--accent-terracotta)]">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-[var(--text-primary)]">Presentation brief</h2>
              <p className="text-sm text-[var(--text-muted)]">Topic, audience, length, style, and extra requirements.</p>
            </div>
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-medium text-[var(--text-secondary)]">Topic
              <input className="input mt-2 w-full" value={brief.topic} onChange={(event) => setBrief({ ...brief, topic: event.target.value })} />
            </label>
            <label className="block text-sm font-medium text-[var(--text-secondary)]">Audience
              <input className="input mt-2 w-full" value={brief.audience} onChange={(event) => setBrief({ ...brief, audience: event.target.value })} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-[var(--text-secondary)]">Pages
                <input className="input mt-2 w-full" type="number" min={3} max={12} value={brief.slideCount} onChange={(event) => setBrief({ ...brief, slideCount: Number(event.target.value) })} />
              </label>
              <label className="block text-sm font-medium text-[var(--text-secondary)]">Style
                <input className="input mt-2 w-full" value={brief.style} onChange={(event) => setBrief({ ...brief, style: event.target.value })} />
              </label>
            </div>
            <label className="block text-sm font-medium text-[var(--text-secondary)]">Additional requirements
              <textarea className="input mt-2 min-h-28 w-full" value={brief.requirements} onChange={(event) => setBrief({ ...brief, requirements: event.target.value })} />
            </label>
          </div>

          <button type="submit" className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-terracotta)] px-6 py-3.5 font-medium text-white shadow-md transition hover:bg-[var(--accent-terracotta-light)]">
            <Sparkles className="h-5 w-5" />
            Create outline
          </button>
        </form>
      </section>
    </main>
  );
}
