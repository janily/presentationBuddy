"use client";

import { MessageCircle, RotateCcw } from "lucide-react";
import { type ReactNode } from "react";

interface PresentationWorkspaceProps {
  previewContent: ReactNode;
  agentContent?: ReactNode;
  onStartOver: () => void;
}

export default function PresentationWorkspace({ previewContent, agentContent, onStartOver }: PresentationWorkspaceProps) {
  return (
    <div className="min-h-screen paper-texture">
      <header className="sticky top-0 z-20 border-b border-[var(--border-light)] bg-[var(--bg-card)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}>Presentation Buddy</h1>
            <p className="text-sm text-[var(--text-muted)]">Preview and agent conversation in one workspace</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onStartOver} className="flex items-center gap-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)]"><RotateCcw className="h-4 w-4" />Start over</button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_460px]">
        <section className="relative min-h-[calc(100vh-112px)] overflow-hidden rounded-3xl border border-[var(--border-light)] bg-white shadow-lg">
          {previewContent}
        </section>

        <aside className="flex min-h-[calc(100vh-112px)] flex-col gap-4 rounded-3xl border border-[var(--border-light)] bg-[var(--bg-card)] p-4 shadow-lg">
          <div className="flex items-center gap-3 border-b border-[var(--border-light)] pb-4">
            <div className="rounded-2xl bg-[var(--accent-brass)]/10 p-3 text-[var(--accent-brass)]"><MessageCircle className="h-5 w-5" /></div>
            <div>
              <h2 className="font-semibold text-[var(--text-primary)]">Agent</h2>
              <p className="text-sm text-[var(--text-muted)]">Brief, outline review, and generation controls</p>
            </div>
          </div>
          {agentContent}
        </aside>
      </main>
    </div>
  );
}
