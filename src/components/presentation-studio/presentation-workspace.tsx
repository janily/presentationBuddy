"use client";

import { type ReactNode } from "react";

interface PresentationWorkspaceProps {
  previewContent: ReactNode;
  agentContent?: ReactNode;
}

export default function PresentationWorkspace({ previewContent, agentContent }: PresentationWorkspaceProps) {
  return (
    <div className="grid h-screen grid-cols-1 lg:grid-cols-[minmax(0,1fr)_400px]">
      <section className="relative h-full min-h-0 overflow-y-auto bg-white">
        {previewContent}
      </section>

      <aside className="flex h-full min-h-0 flex-col overflow-hidden border-t border-[var(--border-light)] bg-[var(--bg-elevated)] lg:border-l lg:border-t-0">
        {agentContent}
      </aside>
    </div>
  );
}
