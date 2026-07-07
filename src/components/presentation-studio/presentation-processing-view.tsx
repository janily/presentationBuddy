"use client";

import { Code2, FileCode2, LayoutTemplate, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

interface PresentationProcessingViewProps {
  slideTitles: string[];
  isComplete?: boolean;
  onComplete: () => void;
}

const steps = [
  { id: "structure", text: "Structuring selected slides...", icon: LayoutTemplate },
  { id: "html", text: "Writing semantic HTML...", icon: FileCode2 },
  { id: "styles", text: "Applying presentation styles...", icon: Sparkles },
  { id: "bundle", text: "Preparing preview document...", icon: Code2 },
];

export default function PresentationProcessingView({ slideTitles, isComplete = false, onComplete }: PresentationProcessingViewProps) {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(onComplete, 500);
      return () => clearTimeout(timer);
    }

    const interval = setInterval(() => setCurrentStep((step) => (step + 1) % steps.length), 1300);
    return () => clearInterval(interval);
  }, [isComplete, onComplete]);

  const CurrentIcon = steps[currentStep]?.icon ?? Sparkles;

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
          <p className="mt-2 text-[var(--text-secondary)]">{isComplete ? "Opening the preview workspace." : steps[currentStep]?.text}</p>
        </div>

        <div className="mt-8 h-2 overflow-hidden rounded-full bg-[var(--bg-secondary)]">
          <div className="h-full rounded-full bg-[var(--accent-terracotta)] transition-all duration-500" style={{ width: isComplete ? "100%" : `${(currentStep + 1) * 25}%` }} />
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
