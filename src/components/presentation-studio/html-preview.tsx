"use client";

import { RotateCcw } from "lucide-react";
import PresentationPreviewPane from "./presentation-preview-pane";

interface HtmlPreviewProps {
  html: string;
  onStartOver: () => void;
}

export default function HtmlPreview({ html, onStartOver }: HtmlPreviewProps) {
  return (
    <div className="min-h-screen paper-texture">
      <header className="sticky top-0 z-20 border-b border-[var(--border-light)] bg-[var(--bg-card)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}>Generated presentation preview</h1>
            <p className="text-sm text-[var(--text-muted)]">Sandboxed HTML preview</p>
          </div>
          <button type="button" onClick={onStartOver} className="flex items-center gap-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)]"><RotateCcw className="h-4 w-4" />Start over</button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="overflow-hidden rounded-3xl border border-[var(--border-light)] bg-white shadow-lg">
          <PresentationPreviewPane step="preview" html={html} outline={[]} />
        </div>
      </main>
    </div>
  );
}
