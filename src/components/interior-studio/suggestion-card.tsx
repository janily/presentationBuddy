"use client";

import { useState, useRef, useEffect } from "react";
import { Check, Pencil, Trash2, GripVertical, X } from "lucide-react";

export interface Suggestion {
  id: string;
  text: string;
  selected: boolean;
  zone?: string;
}

interface SuggestionCardProps {
  suggestion: Suggestion;
  index: number;
  onToggle: (id: string) => void;
  onEdit: (id: string, newText: string) => void;
  onDelete: (id: string) => void;
  onHoverZone?: (zone: string | null) => void;
}

export default function SuggestionCard({
  suggestion,
  index,
  onToggle,
  onEdit,
  onDelete,
  onHoverZone,
}: SuggestionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(suggestion.text);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSaveEdit = () => {
    if (editText.trim()) {
      onEdit(suggestion.id, editText.trim());
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditText(suggestion.text);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  const handleDelete = () => {
    setIsDeleting(true);
    setTimeout(() => {
      onDelete(suggestion.id);
    }, 300);
  };

  return (
    <article
      className={`
        group relative
        animate-slide-in-right
        transition-all duration-300 ease-out
        ${isDeleting ? "opacity-0 scale-95 -translate-x-4" : "opacity-100 scale-100"}
      `}
      style={{
        animationDelay: `${index * 75}ms`,
        animationFillMode: "backwards",
      }}
      onMouseEnter={() => {
        setIsHovered(true);
        if (suggestion.zone) onHoverZone?.(suggestion.zone);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        onHoverZone?.(null);
      }}
    >
      <div
        className={`
          relative flex items-start gap-3 p-4 rounded-xl
          border transition-all duration-200
          ${
            suggestion.selected
              ? "bg-[var(--bg-elevated)] border-[var(--accent-terracotta)]/30 shadow-sm"
              : "bg-[var(--bg-card)] border-[var(--border-light)] hover:border-[var(--border-medium)]"
          }
          ${isHovered ? "shadow-md" : ""}
        `}
      >
        {/* Drag Handle */}
        <div
          className={`
            shrink-0 pt-0.5 cursor-grab active:cursor-grabbing
            text-[var(--text-muted)] opacity-0 group-hover:opacity-100
            transition-opacity duration-200
          `}
          aria-hidden="true"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Checkbox */}
        <button
          type="button"
          onClick={() => onToggle(suggestion.id)}
          className={`
            shrink-0 w-6 h-6 rounded-lg border-2
            flex items-center justify-center
            transition-all duration-200
            ${
              suggestion.selected
                ? "bg-[var(--accent-terracotta)] border-[var(--accent-terracotta)]"
                : "bg-[var(--bg-elevated)] border-[var(--border-medium)] hover:border-[var(--accent-terracotta)]"
            }
          `}
          aria-label={
            suggestion.selected ? "Deselect suggestion" : "Select suggestion"
          }
          aria-pressed={suggestion.selected}
        >
          {suggestion.selected && (
            <Check
              className="w-3.5 h-3.5 text-white animate-scale-in"
              strokeWidth={3}
            />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={handleKeyDown}
                className="input flex-1 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleSaveEdit}
                className="p-2 rounded-lg bg-[var(--accent-terracotta)] text-white hover:bg-[var(--accent-terracotta-light)] transition-colors"
                aria-label="Save edit"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="p-2 rounded-lg bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--border-medium)] transition-colors"
                aria-label="Cancel edit"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <p
              className={`
                text-sm leading-relaxed transition-colors duration-200
                ${suggestion.selected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}
              `}
            >
              {suggestion.text}
            </p>
          )}

          {/* Zone badge */}
          {suggestion.zone && !isEditing && (
            <span
              className={`
                inline-block mt-2 px-2 py-0.5 text-xs rounded-full
                transition-colors duration-200
                ${
                  isHovered
                    ? "bg-[var(--accent-terracotta)]/10 text-[var(--accent-terracotta)]"
                    : "bg-[var(--bg-secondary)] text-[var(--text-muted)]"
                }
              `}
            >
              {suggestion.zone}
            </span>
          )}
        </div>

        {/* Actions */}
        {!isEditing && (
          <div
            className={`
              flex items-center gap-1 shrink-0
              opacity-0 group-hover:opacity-100 transition-opacity duration-200
            `}
          >
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent-terracotta)] hover:bg-[var(--accent-terracotta)]/10 transition-all duration-200"
              aria-label="Edit suggestion"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-all duration-200"
              aria-label="Delete suggestion"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Selection indicator line */}
        <div
          className={`
            absolute left-0 top-3 bottom-3 w-1 rounded-r-full
            transition-all duration-300
            ${suggestion.selected ? "bg-[var(--accent-terracotta)]" : "bg-transparent"}
          `}
        />
      </div>
    </article>
  );
}
