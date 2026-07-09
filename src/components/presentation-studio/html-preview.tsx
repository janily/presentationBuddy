"use client";

import { Download } from "lucide-react";

interface HtmlPreviewProps {
  html: string;
}

function downloadHtml(html: string) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "presentation.html";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function HtmlPreview({ html }: HtmlPreviewProps) {
  return (
    <div className="flex h-full min-h-[620px] flex-col bg-white">
      <div className="flex items-center justify-end border-b border-[var(--border-light)] bg-[var(--bg-card)]/95 px-4 py-3 backdrop-blur">
        <button type="button" onClick={() => downloadHtml(html)} className="flex items-center gap-2 rounded-xl bg-[var(--accent-terracotta)] px-4 py-2 text-sm font-medium text-white shadow-md">
          <Download className="h-4 w-4" />下载 HTML
        </button>
      </div>
      <iframe title="Generated HTML presentation" sandbox="allow-scripts allow-same-origin" srcDoc={html} className="min-h-0 flex-1" />
    </div>
  );
}
