"use client";

import { FileCode2, LayoutTemplate, Sparkles } from "lucide-react";
import HtmlPreview from "./html-preview";
import type { HtmlGenerationStepData } from "@/src/types/presentation-workflow";
import type { SlideOutlineItem } from "./slide-outline-card";

type PreviewPaneStep = "brief" | "outlining" | "review" | "generating" | "preview";

interface PresentationPreviewPaneProps {
  step?: PreviewPaneStep;
  currentStep?: PreviewPaneStep;
  html?: string;
  generatedHtml?: string;
  outline: SlideOutlineItem[];
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

function OutlinePreview({ outline, isLoading }: { outline: SlideOutlineItem[]; isLoading: boolean }) {
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(outline.length ? outline : Array.from({ length: 6 }, (_, index) => ({ id: `${index}`, title: `Slide ${index + 1}`, notes: "Waiting for the agent to draft this slide.", selected: true } as SlideOutlineItem))).map((slide, index) => (
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

  return (
    <div className="absolute inset-x-6 bottom-6 rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)]/95 p-4 shadow-lg backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-[var(--accent-terracotta)]/10 p-2 text-[var(--accent-terracotta)]"><ActiveIcon className="h-5 w-5 animate-pulse" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Generating your HTML presentation...</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{htmlGeneration?.message ?? generationSteps[activeIndex]?.text}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--bg-secondary)]">
            <div className="h-full rounded-full bg-[var(--accent-terracotta)] transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PresentationPreviewPane({ step, currentStep, html, generatedHtml, outline, htmlGeneration }: PresentationPreviewPaneProps) {
  const activeStep = currentStep ?? step ?? "brief";
  const activeHtml = generatedHtml ?? html ?? "";

  if (activeStep === "preview" && activeHtml) {
    return <HtmlPreview html={activeHtml} />;
  }

  if (activeStep === "outlining" || activeStep === "review" || activeStep === "generating") {
    return (
      <div className="relative h-full">
        <OutlinePreview outline={outline} isLoading={activeStep === "outlining"} />
        {activeStep === "generating" ? <GenerationProgress htmlGeneration={htmlGeneration} /> : null}
      </div>
    );
  }

  return <EmptyPreview />;
}
