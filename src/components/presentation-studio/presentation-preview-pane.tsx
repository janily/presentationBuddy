"use client";

import { CheckCircle2, Circle, FileCode2, LayoutTemplate, Loader2, Sparkles } from "lucide-react";
import HtmlPreview from "./html-preview";
import type { HtmlGenerationStepData, OutlineStepData } from "@/src/types/presentation-workflow";
import type { SlideOutlineItem } from "./slide-outline-card";

type PreviewPaneStep = "brief" | "outlining" | "review" | "generating" | "preview";

interface PresentationPreviewPaneProps {
  step?: PreviewPaneStep;
  currentStep?: PreviewPaneStep;
  html?: string;
  generatedHtml?: string;
  outline: SlideOutlineItem[];
  outlineGeneration?: OutlineStepData;
  htmlGeneration?: HtmlGenerationStepData;
}

const generationSteps = [
  { id: "structure", text: "Structuring selected slides...", icon: LayoutTemplate },
  { id: "html", text: "Writing semantic HTML...", icon: FileCode2 },
  { id: "styles", text: "Applying presentation styles...", icon: Sparkles },
  { id: "bundle", text: "Preparing preview document...", icon: FileCode2 },
] as const;

function EmptyPreview() {
  return (
    <div className="flex h-full min-h-[620px] items-center justify-center bg-[linear-gradient(135deg,#faf7f1_0%,#fff_52%,#f7efe5_100%)] p-8 text-center">
      <div className="max-w-xl rounded-3xl border border-dashed border-[var(--border-light)] bg-white/75 p-10 shadow-sm backdrop-blur">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--accent-terracotta)]/10 text-[var(--accent-terracotta)]">
          <Sparkles className="h-8 w-8" />
        </div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent-brass)]">Live preview</p>
        <h2 className="mt-3 text-3xl font-semibold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}>你的演示文稿将在这里实时预览</h2>
        <p className="mt-4 text-[var(--text-secondary)]">Use the agent panel to create a brief, review the outline, and generate an HTML deck without leaving this workspace.</p>
      </div>
    </div>
  );
}

function WorkflowStepList({ steps }: { steps: Array<{ id: string; label: string; status: "pending" | "active" | "completed"; detail?: string }> }) {
  return (
    <div className="grid gap-3">
      {steps.map((step) => {
        const StepStateIcon = step.status === "completed" ? CheckCircle2 : step.status === "active" ? Loader2 : Circle;

        return (
          <div
            key={step.id}
            className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${
              step.status === "pending"
                ? "border-[var(--border-light)] bg-[var(--bg-elevated)] text-[var(--text-muted)]"
                : "border-[var(--accent-terracotta)]/25 bg-[var(--accent-terracotta)]/5 text-[var(--text-primary)]"
            }`}
          >
            <StepStateIcon className={`mt-0.5 h-4 w-4 shrink-0 ${
              step.status === "completed"
                ? "text-emerald-600"
                : step.status === "active"
                  ? "animate-spin text-[var(--accent-terracotta)]"
                  : "text-[var(--border-medium)]"
            }`} />
            <div className="min-w-0">
              <p className="text-sm font-medium">{step.label}</p>
              {step.detail && step.status === "active" ? (
                <p className="mt-1 text-sm text-[var(--text-muted)]">{step.detail}</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OutlineProgress({ outlineGeneration }: { outlineGeneration?: OutlineStepData }) {
  const progress = outlineGeneration?.progress ?? 12;
  const message = outlineGeneration?.message ?? "Preparing the outline workflow...";
  const steps = outlineGeneration?.steps ?? [
    { id: "prepare", label: "Reading your request", status: "active" as const },
    { id: "analyze", label: "Identifying audience and goals", status: "pending" as const },
    { id: "structure", label: "Planning the deck structure", status: "pending" as const },
    { id: "detail", label: "Writing slide-level details", status: "pending" as const },
    { id: "review", label: "Preparing outline for review", status: "pending" as const },
  ];

  return (
    <div className="rounded-3xl border border-[var(--border-light)] bg-white/90 p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent-terracotta)]/10 text-[var(--accent-terracotta)]">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent-brass)]">Outline generation</p>
          <h3 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}>
            Drafting your presentation structure...
          </h3>
          <p className="mt-2 text-[var(--text-secondary)]">{message}</p>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-[var(--bg-secondary)]">
            <div className="h-full rounded-full bg-[var(--accent-terracotta)] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-sm text-[var(--text-muted)]">{progress}% complete</p>
        </div>
      </div>
      <div className="mt-6">
        <WorkflowStepList steps={steps} />
      </div>
    </div>
  );
}

function OutlinePreview({ outline, isLoading, outlineGeneration }: { outline: SlideOutlineItem[]; isLoading: boolean; outlineGeneration?: OutlineStepData }) {
  return (
    <div className="h-full min-h-[calc(100vh-112px)] overflow-auto bg-[linear-gradient(135deg,#faf7f1_0%,#fff_60%,#f7efe5_100%)] p-6">
      <div className="mx-auto max-w-5xl space-y-4 pb-8">
        <div className="rounded-3xl border border-[var(--border-light)] bg-white/85 p-6 shadow-sm backdrop-blur">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent-brass)]">Outline preview</p>
          <h2 className="mt-2 text-3xl font-semibold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}>
            {isLoading ? "Drafting your presentation structure..." : "Review the story before HTML generation"}
          </h2>
          <p className="mt-3 text-[var(--text-secondary)]">The left workspace reflects the current workflow state while the agent controls stay available on the right.</p>
        </div>
        {isLoading && outline.length === 0 ? <OutlineProgress outlineGeneration={outlineGeneration} /> : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {outline.map((slide, index) => (
            <article key={slide.id} className={`min-h-44 rounded-2xl border bg-white/90 p-5 shadow-sm ${slide.selected ? "border-[var(--border-light)]" : "border-dashed border-[var(--border-light)] opacity-60"}`}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="rounded-full bg-[var(--accent-terracotta)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent-terracotta)]">{index + 1}</span>
                {isLoading ? <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--accent-terracotta)]" /> : null}
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">{slide.title}</h3>
              <p className="mt-3 line-clamp-4 text-sm text-[var(--text-secondary)]">{slide.notes}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function GenerationProgress({ htmlGeneration }: { htmlGeneration?: HtmlGenerationStepData }) {
  const activeIndex = htmlGeneration?.phase ? Math.max(0, generationSteps.findIndex((step) => step.id === htmlGeneration.phase)) : 0;
  const progress = htmlGeneration?.progress ?? 25;
  const ActiveIcon = generationSteps[activeIndex]?.icon ?? Sparkles;
  const progressSteps = htmlGeneration?.steps ?? [];

  return (
    <div className="flex h-full min-h-[620px] items-center justify-center bg-[linear-gradient(135deg,#faf7f1_0%,#fff_56%,#f7efe5_100%)] p-8">
      <div className="w-full max-w-xl rounded-3xl border border-[var(--border-light)] bg-[var(--bg-card)]/95 p-8 shadow-lg backdrop-blur">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--accent-terracotta)]/10 text-[var(--accent-terracotta)]">
          <ActiveIcon className="h-7 w-7 animate-pulse" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent-brass)]">HTML generation</p>
          <h2 className="mt-3 text-3xl font-semibold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}>
            Generating your HTML presentation...
          </h2>
          <p className="mt-3 text-[var(--text-secondary)]">{htmlGeneration?.message ?? generationSteps[activeIndex]?.text}</p>
          <div className="mt-6 h-2 overflow-hidden rounded-full bg-[var(--bg-secondary)]">
            <div className="h-full rounded-full bg-[var(--accent-terracotta)] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-3 text-sm text-[var(--text-muted)]">{progress}% complete</p>
          {progressSteps.length > 0 ? (
            <div className="mt-6 grid gap-3">
              <WorkflowStepList steps={progressSteps} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function PresentationPreviewPane({ step, currentStep, html, generatedHtml, outline, outlineGeneration, htmlGeneration }: PresentationPreviewPaneProps) {
  const activeStep = currentStep ?? step ?? "brief";
  const activeHtml = generatedHtml ?? html ?? "";

  if (activeStep === "preview" && activeHtml) {
    return <HtmlPreview html={activeHtml} />;
  }

  if (activeStep === "generating") {
    return <GenerationProgress htmlGeneration={htmlGeneration} />;
  }

  if (activeStep === "outlining" || activeStep === "review") {
    return <OutlinePreview outline={outline} isLoading={activeStep === "outlining"} outlineGeneration={outlineGeneration} />;
  }

  return <EmptyPreview />;
}
