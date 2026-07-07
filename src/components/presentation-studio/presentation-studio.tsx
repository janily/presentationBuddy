"use client";

import { RotateCcw } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { usePresentationWorkflow } from "@/src/hooks/use-presentation-workflow";
import type { PresentationOutlineData } from "@/src/types/presentation-workflow";
import BriefForm, { type PresentationBrief } from "./brief-form";
import HtmlPreview from "./html-preview";
import OutlinePanel from "./outline-panel";
import PresentationProcessingView from "./presentation-processing-view";
import { type SlideOutlineItem } from "./slide-outline-card";

type WorkflowStep = "brief" | "outlining" | "review" | "generating" | "preview";

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const emptyOutline = (brief: PresentationBrief): PresentationOutlineData => ({
  title: brief.topic,
  narrativeGoal: `Create a ${brief.style} presentation for ${brief.audience}.`,
  sections: [],
  slides: [],
  designGuidance: [],
});

const toSlideItem = (slide: PresentationOutlineData["slides"][number]): SlideOutlineItem => ({
  id: `${slide.pageNumber}-${slide.title}`,
  title: slide.title,
  notes: [slide.purpose, ...slide.keyPoints, slide.designSuggestion].filter(Boolean).join(" "),
  selected: true,
});

const toApprovedOutline = (
  baseOutline: PresentationOutlineData,
  items: SlideOutlineItem[],
): PresentationOutlineData => ({
  ...baseOutline,
  slides: items
    .filter((item) => item.selected)
    .map((item, index) => ({
      pageNumber: index + 1,
      title: item.title,
      purpose: item.notes,
      keyPoints: [item.notes],
      designSuggestion: baseOutline.designGuidance.join(" ") || "Use a polished, readable slide layout.",
    })),
});

export default function PresentationStudio() {
  const {
    sendPresentationBrief,
    approveOutline,
    suspenseData,
    outlineStep,
    htmlGenerationStep,
    status,
    activeRunId,
    approvalError,
    canApproveOutline,
  } = usePresentationWorkflow();
  const [brief, setBrief] = useState<PresentationBrief | null>(null);
  const [userModifiedOutline, setUserModifiedOutline] = useState<SlideOutlineItem[] | null>(null);

  const workflowOutline = useMemo(() => {
    return outlineStep?.data?.outline ?? suspenseData?.outline ?? null;
  }, [outlineStep, suspenseData]);

  const baseOutline = useMemo(() => {
    if (workflowOutline?.title && workflowOutline.slides) {
      return workflowOutline as PresentationOutlineData;
    }

    return brief ? emptyOutline(brief) : null;
  }, [brief, workflowOutline]);

  const outline = useMemo(() => {
    if (userModifiedOutline) return userModifiedOutline;
    return baseOutline?.slides?.map(toSlideItem) ?? [];
  }, [baseOutline, userModifiedOutline]);

  const selectedSlides = useMemo(() => outline.filter((item) => item.selected), [outline]);
  const generatedHtml = htmlGenerationStep?.data?.html ?? "";

  const currentStep = useMemo((): WorkflowStep => {
    if (!brief) return "brief";
    if (htmlGenerationStep?.data?.status === "completed" && generatedHtml) return "preview";
    if (htmlGenerationStep?.data?.status === "in-progress") return "generating";
    if (status === "submitted" || (status === "streaming" && !baseOutline?.slides?.length)) return "outlining";
    return "review";
  }, [baseOutline, brief, generatedHtml, htmlGenerationStep, status]);

  const handleBriefSubmit = useCallback((nextBrief: PresentationBrief) => {
    setBrief(nextBrief);
    setUserModifiedOutline(null);
    sendPresentationBrief({
      topic: nextBrief.topic,
      audience: nextBrief.audience,
      pageCount: nextBrief.slideCount,
      style: nextBrief.style,
      requirements: nextBrief.requirements,
    });
  }, [sendPresentationBrief]);

  const handleToggle = useCallback((id: string) => {
    setUserModifiedOutline((current) => (current ?? outline).map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)));
  }, [outline]);

  const handleEdit = useCallback((id: string, updates: Pick<SlideOutlineItem, "title" | "notes">) => {
    setUserModifiedOutline((current) => (current ?? outline).map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }, [outline]);

  const handleDelete = useCallback((id: string) => {
    setUserModifiedOutline((current) => (current ?? outline).filter((item) => item.id !== id));
  }, [outline]);

  const handleAdd = useCallback((title: string) => {
    setUserModifiedOutline((current) => [
      ...(current ?? outline),
      { id: makeId(), title, notes: "Add supporting detail, examples, and speaker notes for this slide.", selected: true },
    ]);
  }, [outline]);

  const handleGenerate = useCallback(() => {
    if (!baseOutline || selectedSlides.length === 0 || !canApproveOutline) return;
    approveOutline(toApprovedOutline(baseOutline, outline));
  }, [approveOutline, baseOutline, canApproveOutline, outline, selectedSlides.length]);

  const handleStartOver = useCallback(() => {
    setBrief(null);
    setUserModifiedOutline(null);
  }, []);

  if (currentStep === "brief") return <BriefForm onSubmit={handleBriefSubmit} />;

  if (currentStep === "generating") {
    return <PresentationProcessingView slideTitles={selectedSlides.map((slide) => slide.title)} isComplete={false} onComplete={() => undefined} />;
  }

  if (currentStep === "preview") return <HtmlPreview html={generatedHtml} onStartOver={handleStartOver} />;

  return (
    <div className="min-h-screen paper-texture">
      <header className="sticky top-0 z-20 border-b border-[var(--border-light)] bg-[var(--bg-card)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-semibold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}>Presentation Buddy</h1>
          <button type="button" onClick={handleStartOver} className="flex items-center gap-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-card)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)]"><RotateCcw className="h-4 w-4" />Start over</button>
        </div>
      </header>
      <main className="mx-auto grid max-w-7xl gap-6 p-4 md:p-6 lg:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-card)] p-6">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent-brass)]">Brief</p>
          <h2 className="mt-3 text-3xl font-semibold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}>{brief?.topic}</h2>
          <dl className="mt-6 space-y-4 text-sm">
            <div><dt className="font-medium text-[var(--text-muted)]">Audience</dt><dd className="text-[var(--text-primary)]">{brief?.audience}</dd></div>
            <div><dt className="font-medium text-[var(--text-muted)]">Style</dt><dd className="text-[var(--text-primary)]">{brief?.style}</dd></div>
            <div><dt className="font-medium text-[var(--text-muted)]">Narrative goal</dt><dd className="text-[var(--text-primary)]">{baseOutline?.narrativeGoal ?? suspenseData?.reason}</dd></div>
          </dl>
        </section>
        <div className="h-[calc(100vh-120px)] min-h-[620px]">
          <OutlinePanel items={outline} isLoading={currentStep === "outlining"} onToggle={handleToggle} onEdit={handleEdit} onDelete={handleDelete} onAdd={handleAdd} onGenerate={handleGenerate} generateDisabledReason={!activeRunId ? (approvalError ?? "Waiting for the workflow run ID before generating HTML.") : approvalError} />
        </div>
      </main>
    </div>
  );
}
