"use client";

import { type ReactNode } from "react";

interface PresentationWorkspaceProps {
  previewContent: ReactNode;
  agentContent?: ReactNode;
}

export default function PresentationWorkspace({ previewContent, agentContent }: PresentationWorkspaceProps) {
  return (
    <div className="grid h-dvh grid-cols-1 grid-rows-[minmax(0,0.8fr)_minmax(0,1fr)] overflow-hidden lg:grid-rows-1 lg:grid-cols-[minmax(0,1fr)_400px]">
      <section aria-label="演示预览" className="relative h-full min-h-0 overflow-y-auto bg-white">
        {previewContent}
      </section>

      <aside aria-label="AI 助手" className="flex h-full min-h-0 flex-col overflow-hidden border-t border-[var(--border-light)] bg-[var(--bg-elevated)] lg:border-l lg:border-t-0">
        {agentContent}
      </aside>
    </div>
  );
}
