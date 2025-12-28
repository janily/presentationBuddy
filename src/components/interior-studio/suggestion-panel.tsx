"use client";

import { useState } from "react";
import { Plus, Sparkles, Shuffle, Lightbulb } from "lucide-react";
import SuggestionCard, { type Suggestion } from "./suggestion-card";

interface SuggestionPanelProps {
  suggestions: Suggestion[];
  onToggle: (id: string) => void;
  onEdit: (id: string, newText: string) => void;
  onDelete: (id: string) => void;
  onAdd: (text: string, zone?: string) => void;
  onHoverZone?: (zone: string | null) => void;
  onGenerate: () => void;
  isGenerating?: boolean;
  isLoading?: boolean;
}

const quickChips = [
  { id: "chip-1", text: "Better lighting", icon: "💡" },
  { id: "chip-2", text: "Add plants", icon: "🌿" },
  { id: "chip-3", text: "Modern furniture", icon: "🛋️" },
  { id: "chip-4", text: "Add artwork", icon: "🖼️" },
  { id: "chip-5", text: "Declutter", icon: "✨" },
  { id: "chip-6", text: "Change wall color", icon: "🎨" },
];

export default function SuggestionPanel({
  suggestions,
  onToggle,
  onEdit,
  onDelete,
  onAdd,
  onHoverZone,
  onGenerate,
  isGenerating = false,
  isLoading = false,
}: SuggestionPanelProps) {
  const [newSuggestion, setNewSuggestion] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);

  const selectedCount = suggestions.filter((s) => s.selected).length;

  const handleAddSuggestion = () => {
    if (newSuggestion.trim()) {
      onAdd(newSuggestion.trim());
      setNewSuggestion("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddSuggestion();
    }
  };

  const handleQuickChipClick = (text: string) => {
    onAdd(text);
  };

  const handleSurpriseMe = () => {
    suggestions.forEach((suggestion) => {
      if (Math.random() > 0.5) {
        onToggle(suggestion.id);
      }
    });
  };

  return (
    <div className="h-full flex flex-col bg-[var(--bg-card)] rounded-2xl border border-[var(--border-light)] overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-[var(--border-light)]">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[var(--accent-brass)]" />
            <h2
              className="text-lg font-semibold text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}
            >
              AI Suggestions
            </h2>
          </div>
          <button
            type="button"
            onClick={handleSurpriseMe}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full
                       bg-[var(--bg-secondary)] text-[var(--text-secondary)]
                       hover:bg-[var(--accent-brass)]/10 hover:text-[var(--accent-brass)]
                       transition-all duration-200"
          >
            <Shuffle className="w-3.5 h-3.5" />
            Surprise me
          </button>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          Select the changes you&apos;d like to apply
        </p>
      </div>

      {/* Suggestions List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="space-y-3">
            {/* Skeleton loading cards */}
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="p-4 rounded-xl border border-[var(--border-light)] bg-[var(--bg-secondary)]/50 animate-pulse"
              >
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded bg-[var(--border-light)]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-[var(--border-light)] rounded w-3/4" />
                    <div className="h-4 bg-[var(--border-light)] rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
            <p className="text-center text-sm text-[var(--text-muted)] mt-4">
              Analyzing your space...
            </p>
          </div>
        ) : suggestions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--bg-secondary)] flex items-center justify-center mb-4">
              <Lightbulb className="w-8 h-8 text-[var(--text-muted)]" />
            </div>
            <p className="text-[var(--text-secondary)] mb-2">
              No suggestions yet
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              Add your own ideas below
            </p>
          </div>
        ) : (
          suggestions.map((suggestion, index) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              index={index}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
              onHoverZone={onHoverZone}
            />
          ))
        )}
      </div>

      {/* Add Custom Suggestion */}
      <div className="p-4 border-t border-[var(--border-light)] bg-[var(--bg-elevated)]">
        {/* Input */}
        <div
          className={`
            flex items-center gap-2 p-2 rounded-xl border-2
            transition-all duration-200
            ${
              isInputFocused
                ? "border-[var(--accent-terracotta)] bg-white shadow-sm"
                : "border-[var(--border-light)] bg-[var(--bg-card)]"
            }
          `}
        >
          <div
            className={`
              p-2 rounded-lg transition-colors duration-200
              ${isInputFocused ? "bg-[var(--accent-terracotta)]/10" : "bg-[var(--bg-secondary)]"}
            `}
          >
            <Plus
              className={`w-4 h-4 transition-colors duration-200 ${
                isInputFocused
                  ? "text-[var(--accent-terracotta)]"
                  : "text-[var(--text-muted)]"
              }`}
            />
          </div>
          <input
            type="text"
            value={newSuggestion}
            onChange={(e) => setNewSuggestion(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            placeholder="Add your own idea..."
            className="flex-1 bg-transparent border-none outline-none text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
          />
          {newSuggestion && (
            <button
              type="button"
              onClick={handleAddSuggestion}
              className="px-3 py-1.5 text-xs font-medium rounded-lg
                         bg-[var(--accent-terracotta)] text-white
                         hover:bg-[var(--accent-terracotta-light)]
                         transition-colors duration-200"
            >
              Add
            </button>
          )}
        </div>

        {/* Quick Chips */}
        <div className="mt-3">
          <p className="text-xs text-[var(--text-muted)] mb-2">
            Popular ideas:
          </p>
          <div className="flex flex-wrap gap-2">
            {quickChips.map((chip) => (
              <button
                type="button"
                key={chip.id}
                onClick={() => handleQuickChipClick(chip.text)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs
                           rounded-full border border-[var(--border-light)]
                           bg-[var(--bg-card)] text-[var(--text-secondary)]
                           hover:border-[var(--accent-terracotta)] hover:text-[var(--accent-terracotta)]
                           hover:bg-[var(--accent-terracotta)]/5
                           transition-all duration-200"
              >
                <span>{chip.icon}</span>
                <span>{chip.text}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer / Generate Button */}
      <div className="p-4 border-t border-[var(--border-light)] bg-[var(--bg-secondary)]/50">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-[var(--text-secondary)]">
            Selected:{" "}
            <span className="font-medium text-[var(--text-primary)]">
              {selectedCount}
            </span>{" "}
            of {suggestions.length}
          </span>
          {selectedCount > 0 && (
            <span className="text-xs text-[var(--accent-sage)] font-medium">
              Ready to generate
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={selectedCount === 0 || isGenerating}
          className={`
            w-full py-3.5 px-6 rounded-xl font-medium
            flex items-center justify-center gap-2
            transition-all duration-300
            ${
              selectedCount > 0 && !isGenerating
                ? "bg-[var(--accent-terracotta)] text-white hover:bg-[var(--accent-terracotta-light)] shadow-md hover:shadow-lg hover:-translate-y-0.5 animate-glow"
                : "bg-[var(--bg-secondary)] text-[var(--text-muted)] cursor-not-allowed"
            }
          `}
        >
          {isGenerating ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>Generate Improvements</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
