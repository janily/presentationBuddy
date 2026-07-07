"use client";

import { Download, RotateCcw } from "lucide-react";

interface HtmlPreviewProps {
  html: string;
  onStartOver: () => void;
}

export default function HtmlPreview({ html, onStartOver }: HtmlPreviewProps) {
  const srcDoc = html;

  const handleDownload = () => {
    const blob = new Blob([html], { type: "text/html" });
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
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}>Generated presentation preview</h1>
            <p className="text-sm text-[var(--text-muted)]">Sandboxed HTML preview</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleDownload} className="flex items-center gap-2 rounded-xl bg-[var(--accent-terracotta)] px-4 py-2 text-sm font-medium text-white"><Download className="h-4 w-4" />Download HTML</button>
            <button type="button" onClick={onStartOver} className="flex items-center gap-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)]"><RotateCcw className="h-4 w-4" />Start over</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 md:p-6">
        <div className="overflow-hidden rounded-3xl border border-[var(--border-light)] bg-white shadow-lg">
          <iframe title="Generated HTML presentation" sandbox="allow-same-origin" srcDoc={srcDoc} className="h-[calc(100vh-140px)] w-full" />
        </div>
      </main>
    </div>
  );
}
