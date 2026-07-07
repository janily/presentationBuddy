"use client";

import { Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import SlideOutlineCard, { type SlideOutlineItem } from "./slide-outline-card";

interface OutlinePanelProps {
  items: SlideOutlineItem[];
  isLoading?: boolean;
  onToggle: (id: string) => void;
  onEdit: (id: string, updates: Pick<SlideOutlineItem, "title" | "notes">) => void;
  onDelete: (id: string) => void;
  onAdd: (title: string) => void;
  onGenerate: () => void;
  generateDisabledReason?: string | null;
}

export default function OutlinePanel({ items, isLoading = false, onToggle, onEdit, onDelete, onAdd, onGenerate, generateDisabledReason }: OutlinePanelProps) {
  const [newTitle, setNewTitle] = useState("");
  const selectedCount = items.filter((item) => item.selected).length;
  const isGenerateDisabled = selectedCount === 0 || isLoading || Boolean(generateDisabledReason);

  const addSlide = () => {
    if (!newTitle.trim()) return;
    onAdd(newTitle.trim());
    setNewTitle("");
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)]">
      <div className="border-b border-[var(--border-light)] p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[var(--accent-brass)]" />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}>Slide outline</h2>
        </div>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Review, select, edit, delete, or add outline items before generating HTML.</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {isLoading ? (
          [1, 2, 3, 4].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-[var(--bg-secondary)]" />)
        ) : (
          items.map((item, index) => <SlideOutlineCard key={item.id} item={item} index={index} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />)
        )}
      </div>

      <div className="border-t border-[var(--border-light)] bg-[var(--bg-elevated)] p-4">
        <div className="flex gap-2">
          <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addSlide()} className="input flex-1" placeholder="Add another slide title..." />
          <button type="button" onClick={addSlide} className="rounded-xl bg-[var(--bg-card)] px-4 text-[var(--accent-terracotta)] shadow-sm"><Plus className="h-5 w-5" /></button>
        </div>
        {generateDisabledReason ? <p className="mt-3 text-sm text-[var(--accent-terracotta)]">{generateDisabledReason}</p> : null}
        <button type="button" onClick={onGenerate} disabled={isGenerateDisabled} className="mt-4 w-full rounded-xl bg-[var(--accent-terracotta)] px-6 py-3.5 font-medium text-white shadow-md disabled:cursor-not-allowed disabled:bg-[var(--border-medium)]">
          Generate HTML presentation ({selectedCount} slides)
        </button>
      </div>
    </div>
  );
}
