"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { Sparkles, Palette, Lamp, Sofa, Flower2 } from "lucide-react";

interface ProcessingViewProps {
  imageUrl: string;
  suggestions: string[];
  onComplete: () => void;
}

const processingSteps = [
  { id: "analyze", icon: Sparkles, text: "Analyzing room structure..." },
  { id: "color", icon: Palette, text: "Identifying color palette..." },
  { id: "lighting", icon: Lamp, text: "Evaluating lighting conditions..." },
  { id: "furniture", icon: Sofa, text: "Detecting furniture arrangement..." },
  { id: "decor", icon: Flower2, text: "Finding decoration opportunities..." },
];

// Pre-compute particle positions to avoid Math.random during render
const floatingParticles = [
  { id: "p1", left: 15, top: 20 },
  { id: "p2", left: 30, top: 45 },
  { id: "p3", left: 45, top: 70 },
  { id: "p4", left: 60, top: 35 },
  { id: "p5", left: 75, top: 60 },
  { id: "p6", left: 90, top: 25 },
];

export default function ProcessingView({
  imageUrl,
  suggestions,
  onComplete,
}: ProcessingViewProps) {
  const [progress, setProgress] = useState(0);
  const [currentSuggestion, setCurrentSuggestion] = useState(0);

  // Compute derived state with useMemo instead of useEffect + setState
  const currentStep = useMemo(() => {
    if (progress < 60) {
      const stepIndex = Math.floor((progress / 60) * processingSteps.length);
      return Math.min(stepIndex, processingSteps.length - 1);
    }
    return processingSteps.length - 1;
  }, [progress]);

  const isApplyingChanges = useMemo(() => progress >= 60, [progress]);

  useEffect(() => {
    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setTimeout(onComplete, 500);
          return 100;
        }
        return prev + 1;
      });
    }, 50);

    return () => clearInterval(progressInterval);
  }, [onComplete]);

  useEffect(() => {
    // Cycle through suggestions when applying changes
    if (isApplyingChanges && suggestions.length > 0) {
      const suggestionInterval = setInterval(() => {
        setCurrentSuggestion((prev) => (prev + 1) % suggestions.length);
      }, 1500);

      return () => clearInterval(suggestionInterval);
    }
  }, [isApplyingChanges, suggestions.length]);

  const CurrentIcon = processingSteps[currentStep]?.icon || Sparkles;

  // Create suggestions with stable keys
  const suggestionsWithKeys = useMemo(
    () =>
      suggestions.map((text, index) => ({
        id: `suggestion-${index}-${text.slice(0, 20)}`,
        text,
        index,
      })),
    [suggestions],
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-6 paper-texture">
      <div className="w-full max-w-2xl animate-fade-in">
        {/* Processing Card */}
        <div className="relative bg-[var(--bg-card)] rounded-3xl border border-[var(--border-light)] overflow-hidden shadow-lg">
          {/* Image Container with Scan Effect */}
          <div className="relative aspect-[4/3] overflow-hidden bg-[var(--bg-secondary)]">
            <Image
              src={imageUrl}
              alt="Processing room"
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 600px"
            />

            {/* Dark overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />

            {/* Scanning line effect */}
            <div className="absolute inset-0 overflow-hidden">
              <div
                className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[var(--accent-terracotta)] to-transparent opacity-80"
                style={{
                  top: `${progress % 100}%`,
                  boxShadow: "0 0 20px 8px rgba(196, 86, 54, 0.4)",
                  transition: "top 0.1s linear",
                }}
              />
            </div>

            {/* Pulsing corners */}
            <div className="absolute inset-4">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[var(--accent-terracotta)] rounded-tl-lg animate-pulse-subtle" />
              <div
                className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[var(--accent-terracotta)] rounded-tr-lg animate-pulse-subtle"
                style={{ animationDelay: "200ms" }}
              />
              <div
                className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[var(--accent-terracotta)] rounded-bl-lg animate-pulse-subtle"
                style={{ animationDelay: "400ms" }}
              />
              <div
                className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[var(--accent-terracotta)] rounded-br-lg animate-pulse-subtle"
                style={{ animationDelay: "600ms" }}
              />
            </div>

            {/* Floating particles */}
            <div className="absolute inset-0 pointer-events-none">
              {floatingParticles.map((particle, i) => (
                <div
                  key={particle.id}
                  className="absolute w-1 h-1 bg-[var(--accent-brass)] rounded-full animate-float opacity-60"
                  style={{
                    left: `${particle.left}%`,
                    top: `${particle.top}%`,
                    animationDelay: `${i * 300}ms`,
                    animationDuration: `${2 + (i % 2)}s`,
                  }}
                />
              ))}
            </div>

            {/* Center icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                {/* Outer ring */}
                <div className="absolute inset-0 w-24 h-24 -m-2 rounded-full border-2 border-[var(--accent-terracotta)]/30 animate-ping" />
                {/* Middle ring */}
                <div
                  className="absolute inset-0 w-20 h-20 rounded-full border border-[var(--accent-terracotta)]/50"
                  style={{ animation: "pulse 2s ease-in-out infinite" }}
                />
                {/* Icon container */}
                <div className="relative w-20 h-20 rounded-full bg-[var(--bg-elevated)]/90 backdrop-blur-sm flex items-center justify-center shadow-xl">
                  <CurrentIcon className="w-8 h-8 text-[var(--accent-terracotta)] animate-pulse-subtle" />
                </div>
              </div>
            </div>
          </div>

          {/* Progress Section */}
          <div className="p-6">
            {/* Status Text */}
            <div className="text-center mb-6">
              <h2
                className="text-xl font-semibold text-[var(--text-primary)] mb-2"
                style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}
              >
                {isApplyingChanges
                  ? "Applying your improvements..."
                  : "Redesigning your space..."}
              </h2>
              <p className="text-sm text-[var(--text-secondary)] h-5 transition-all duration-300">
                {isApplyingChanges && suggestions.length > 0
                  ? `"${suggestions[currentSuggestion]}"`
                  : processingSteps[currentStep]?.text}
              </p>
            </div>

            {/* Progress Bar */}
            <div className="relative">
              <div className="progress-bar h-2">
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-xs text-[var(--text-muted)]">
                <span>Analyzing</span>
                <span className="font-medium text-[var(--accent-terracotta)]">
                  {progress}%
                </span>
                <span>Complete</span>
              </div>
            </div>

            {/* Step indicators */}
            <div className="flex justify-center gap-2 mt-6">
              {processingSteps.map((step, index) => {
                const StepIcon = step.icon;
                const isComplete = index < currentStep;
                const isCurrent = index === currentStep && !isApplyingChanges;

                return (
                  <div
                    key={step.id}
                    className={`
                      w-10 h-10 rounded-xl flex items-center justify-center
                      transition-all duration-300
                      ${
                        isComplete
                          ? "bg-[var(--success-bg)] text-[var(--success)]"
                          : isCurrent
                            ? "bg-[var(--accent-terracotta)] text-white scale-110 shadow-md"
                            : "bg-[var(--bg-secondary)] text-[var(--text-muted)]"
                      }
                    `}
                  >
                    <StepIcon className="w-4 h-4" />
                  </div>
                );
              })}
            </div>

            {/* Applied changes preview */}
            {isApplyingChanges && suggestions.length > 0 && (
              <div className="mt-6 p-4 rounded-xl bg-[var(--bg-secondary)] animate-fade-in">
                <p className="text-xs text-[var(--text-muted)] mb-2">
                  Changes being applied:
                </p>
                <div className="space-y-2">
                  {suggestionsWithKeys.map((suggestion) => {
                    const isApplied =
                      suggestion.index <
                      Math.floor(((progress - 60) / 40) * suggestions.length);
                    const isApplying = suggestion.index === currentSuggestion;

                    return (
                      <div
                        key={suggestion.id}
                        className={`
                          flex items-center gap-2 text-sm
                          transition-all duration-300
                          ${
                            isApplied
                              ? "text-[var(--success)]"
                              : isApplying
                                ? "text-[var(--accent-terracotta)] font-medium"
                                : "text-[var(--text-muted)]"
                          }
                        `}
                      >
                        <span
                          className={`
                          w-4 h-4 rounded-full flex items-center justify-center text-xs
                          ${
                            isApplied
                              ? "bg-[var(--success)] text-white"
                              : isApplying
                                ? "bg-[var(--accent-terracotta)] text-white animate-pulse"
                                : "bg-[var(--border-light)]"
                          }
                        `}
                        >
                          {isApplied ? "✓" : suggestion.index + 1}
                        </span>
                        <span className="truncate">{suggestion.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom hint */}
        <p className="text-center text-sm text-[var(--text-muted)] mt-6 animate-pulse-subtle">
          This may take a moment... creating something beautiful ✨
        </p>
      </div>
    </div>
  );
}
