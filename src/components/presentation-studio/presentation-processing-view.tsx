"use client";

import { Code2, FileCode2, LayoutTemplate, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { HtmlGenerationStepData } from "@/src/types/presentation-workflow";

interface PresentationProcessingViewProps {
  slideTitles: string[];
  htmlGeneration?: HtmlGenerationStepData;
  isComplete?: boolean;
  onComplete: () => void;
}

const steps = [
  { id: "structure", text: "Structuring selected slides...", icon: LayoutTemplate },
  { id: "html", text: "Writing semantic HTML...", icon: FileCode2 },
  { id: "styles", text: "Applying presentation styles...", icon: Sparkles },
  { id: "bundle", text: "Preparing preview document...", icon: Code2 },
] as const;

export default function PresentationProcessingView({ slideTitles, htmlGeneration, isComplete = false, onComplete }: PresentationProcessingViewProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(onComplete, 500);
      return () => clearTimeout(timer);
    }

    if (htmlGeneration?.phase) return;

    const interval = setInterval(() => setCurrentStep((step) => (step + 1) % steps.length), 1300);
    return () => clearInterval(interval);
  }, [htmlGeneration?.phase, isComplete, onComplete]);

  const phaseStepIndex = htmlGeneration?.phase ? steps.findIndex((step) => step.id === htmlGeneration.phase) : -1;
  const displayedStep = phaseStepIndex >= 0 ? phaseStepIndex : currentStep;
  const progress = htmlGeneration?.progress ?? (isComplete ? 100 : (displayedStep + 1) * 25);
  const CurrentIcon = steps[displayedStep]?.icon ?? Sparkles;
  const statusMessage = htmlGeneration?.message ?? steps[displayedStep]?.text;
  const generatedSize = htmlGeneration?.generatedCharacters
    ? `${Math.max(1, Math.round(htmlGeneration.generatedCharacters / 1024))} KB generated`
    : null;

  return (
    <div className="flex min-h-screen items-center justify-center paper-texture p-6">
      <div className="w-full max-w-3xl rounded-3xl border border-[var(--border-light)] bg-[var(--bg-card)] p-8 shadow-lg">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[var(--accent-terracotta)]/10">
          <CurrentIcon className="h-9 w-9 animate-pulse text-[var(--accent-terracotta)]" />
        </div>
        <div className="text-center">
          <h2 className="text-3xl font-semibold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}>
            {isComplete ? "HTML presentation ready" : "Generating your HTML presentation..."}
          </h2>
          <p className="mt-2 text-[var(--text-secondary)]">{isComplete ? "Opening the preview workspace." : statusMessage}</p>
          {generatedSize ? <p className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">{generatedSize}</p> : null}
        </div>

        <div className="mt-8 h-2 overflow-hidden rounded-full bg-[var(--bg-secondary)]">
          <div className="h-full rounded-full bg-[var(--accent-terracotta)] transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>

        <div className="mt-6 grid gap-2 sm:grid-cols-4">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isActive = index === displayedStep;
            const isDone = index < displayedStep || isComplete;

            return (
              <div key={step.id} className={`rounded-xl border p-3 text-xs ${isActive || isDone ? "border-[var(--accent-terracotta)]/30 bg-[var(--accent-terracotta)]/5 text-[var(--text-primary)]" : "border-[var(--border-light)] bg-[var(--bg-elevated)] text-[var(--text-muted)]"}`}>
                <StepIcon className="mb-2 h-4 w-4" />
                {step.text}
              </div>
            );
          })}
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {slideTitles.map((title, index) => (
            <div key={`${title}-${index}`} className="rounded-xl border border-[var(--border-light)] bg-[var(--bg-elevated)] p-3 text-sm text-[var(--text-secondary)]">
              <span className="font-medium text-[var(--accent-brass)]">{index + 1}.</span> {title}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
