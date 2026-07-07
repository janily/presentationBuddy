"use client";

import { Check, GripVertical, Pencil, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export interface SlideOutlineItem {
  id: string;
  title: string;
  notes: string;
  selected: boolean;
  purpose?: string;
  keyPoints?: string[];
  designSuggestion?: string;
  originalNotes?: string;
}

interface SlideOutlineCardProps {
  item: SlideOutlineItem;
  index: number;
  onToggle: (id: string) => void;
  onEdit: (id: string, updates: Pick<SlideOutlineItem, "title" | "notes">) => void;
  onDelete: (id: string) => void;
}

export default function SlideOutlineCard({
  item,
  index,
  onToggle,
  onEdit,
  onDelete,
}: SlideOutlineCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [notes, setNotes] = useState(item.notes);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      titleRef.current?.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (!title.trim()) return;
    onEdit(item.id, { title: title.trim(), notes: notes.trim() });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTitle(item.title);
    setNotes(item.notes);
    setIsEditing(false);
  };

  return (
    <article
      className="group animate-slide-in-right"
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: "backwards" }}
    >
      <div
        className={`relative flex gap-3 rounded-2xl border p-4 transition-all duration-200 ${
          item.selected
            ? "border-[var(--accent-terracotta)]/30 bg-[var(--bg-elevated)] shadow-sm"
            : "border-[var(--border-light)] bg-[var(--bg-card)]"
        }`}
      >
        <GripVertical className="mt-1 h-4 w-4 shrink-0 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
        <button
          type="button"
          onClick={() => onToggle(item.id)}
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all ${
            item.selected
              ? "border-[var(--accent-terracotta)] bg-[var(--accent-terracotta)]"
              : "border-[var(--border-medium)] bg-[var(--bg-elevated)]"
          }`}
          aria-label={item.selected ? "Exclude slide" : "Include slide"}
        >
          {item.selected && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
        </button>

        <div className="min-w-0 flex-1">
          {isEditing ? (
            <div className="space-y-2">
              <input
                ref={titleRef}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="input w-full py-2 text-sm font-medium"
                placeholder="Slide title"
              />
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="input min-h-20 w-full py-2 text-sm"
                placeholder="Key points or speaker notes"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={handleCancel} className="rounded-lg bg-[var(--bg-secondary)] p-2 text-[var(--text-secondary)]">
                  <X className="h-4 w-4" />
                </button>
                <button type="button" onClick={handleSave} className="rounded-lg bg-[var(--accent-terracotta)] p-2 text-white">
                  <Check className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--accent-brass)]">Slide {index + 1}</p>
              <h3 className="mt-1 font-semibold text-[var(--text-primary)]">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{item.notes}</p>
            </>
          )}
        </div>

        {!isEditing && (
          <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button type="button" onClick={() => setIsEditing(true)} className="h-9 w-9 rounded-lg text-[var(--text-muted)] hover:bg-[var(--accent-terracotta)]/10 hover:text-[var(--accent-terracotta)]" aria-label="Edit slide">
              <Pencil className="mx-auto h-4 w-4" />
            </button>
            <button type="button" onClick={() => onDelete(item.id)} className="h-9 w-9 rounded-lg text-[var(--text-muted)] hover:bg-[var(--error)]/10 hover:text-[var(--error)]" aria-label="Delete slide">
              <Trash2 className="mx-auto h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
