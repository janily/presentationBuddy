"use client";

import { RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import BriefForm, { type PresentationBrief } from "./brief-form";
import HtmlPreview from "./html-preview";
import OutlinePanel from "./outline-panel";
import PresentationProcessingView from "./presentation-processing-view";
import { type SlideOutlineItem } from "./slide-outline-card";

type WorkflowStep = "brief" | "outlining" | "review" | "generating" | "preview";

type GenerationStatus = "idle" | "outlining" | "generating" | "complete";

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function createOutline(brief: PresentationBrief): SlideOutlineItem[] {
  const base = [
    ["Opening story", `Frame ${brief.topic} for ${brief.audience}.`],
    ["Why it matters", "Summarize the business stakes and current friction."],
    ["Core idea", `Introduce the recommended approach in a ${brief.style.toLowerCase()} style.`],
    ["Execution plan", "Break the work into practical phases and owners."],
    ["Success metrics", "Define the KPIs, signals, and review cadence."],
    ["Call to action", "Close with the next decision and immediate steps."],
  ];

  return Array.from({ length: brief.slideCount }, (_, index) => {
    const [title, notes] = base[index] ?? [`Deep dive ${index + 1}`, "Add supporting evidence, examples, and speaker notes."];
    return {
      id: makeId(),
      title,
      notes: `${notes}${brief.requirements ? ` Requirement: ${brief.requirements}` : ""}`,
      selected: true,
    };
  });
}

function createHtml(brief: PresentationBrief | null, slides: SlideOutlineItem[]) {
  const safe = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const slideMarkup = slides
    .map(
      (slide, index) => `<section class="slide">
  <p class="eyebrow">Slide ${index + 1}</p>
  <h2>${safe(slide.title)}</h2>
  <p>${safe(slide.notes)}</p>
</section>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safe(brief?.topic ?? "Generated presentation")}</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #251812; color: #fff8ef; }
    .deck { display: grid; gap: 32px; padding: 48px; }
    .cover, .slide { min-height: 520px; border-radius: 32px; padding: 56px; background: linear-gradient(135deg, #3a241b, #7f3f2f); box-shadow: 0 24px 80px rgba(0,0,0,.28); }
    .cover { display: flex; flex-direction: column; justify-content: center; }
    .eyebrow { color: #d7b56d; font-size: 14px; font-weight: 800; letter-spacing: .24em; text-transform: uppercase; }
    h1 { max-width: 920px; font-size: clamp(48px, 8vw, 92px); line-height: .95; margin: 16px 0; }
    h2 { max-width: 800px; font-size: clamp(38px, 6vw, 72px); line-height: 1; margin: 16px 0 24px; }
    p { max-width: 820px; font-size: 24px; line-height: 1.45; }
  </style>
</head>
<body>
  <main class="deck">
    <section class="cover">
      <p class="eyebrow">${safe(brief?.style ?? "Presentation")}</p>
      <h1>${safe(brief?.topic ?? "Generated presentation")}</h1>
      <p>Prepared for ${safe(brief?.audience || "your audience")}</p>
    </section>
    ${slideMarkup}
  </main>
</body>
</html>`;
}

export default function PresentationStudio() {
  const [brief, setBrief] = useState<PresentationBrief | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<GenerationStatus>("idle");
  const [userModifiedOutline, setUserModifiedOutline] = useState<SlideOutlineItem[] | null>(null);
  const [generatedHtml, setGeneratedHtml] = useState("");

  const outline = useMemo(() => userModifiedOutline ?? (brief ? createOutline(brief) : []), [brief, userModifiedOutline]);
  const selectedSlides = useMemo(() => outline.filter((item) => item.selected), [outline]);

  const currentStep = useMemo((): WorkflowStep => {
    if (!brief) return "brief";
    if (workflowStatus === "outlining") return "outlining";
    if (workflowStatus === "generating") return "generating";
    if (workflowStatus === "complete" && generatedHtml) return "preview";
    return "review";
  }, [brief, generatedHtml, workflowStatus]);

  useEffect(() => {
    if (workflowStatus !== "outlining" || !brief) return;
    const timer = setTimeout(() => {
      setUserModifiedOutline(createOutline(brief));
      setWorkflowStatus("idle");
    }, 900);
    return () => clearTimeout(timer);
  }, [brief, workflowStatus]);

  useEffect(() => {
    if (workflowStatus !== "generating") return;
    const timer = setTimeout(() => {
      setGeneratedHtml(createHtml(brief, selectedSlides));
      setWorkflowStatus("complete");
    }, 2200);
    return () => clearTimeout(timer);
  }, [brief, selectedSlides, workflowStatus]);

  const handleBriefSubmit = useCallback((nextBrief: PresentationBrief) => {
    setBrief(nextBrief);
    setUserModifiedOutline(null);
    setGeneratedHtml("");
    setWorkflowStatus("outlining");
  }, []);

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

  const handleStartOver = useCallback(() => {
    setBrief(null);
    setWorkflowStatus("idle");
    setUserModifiedOutline(null);
    setGeneratedHtml("");
  }, []);

  if (currentStep === "brief") return <BriefForm onSubmit={handleBriefSubmit} />;

  if (currentStep === "generating") {
    return <PresentationProcessingView slideTitles={selectedSlides.map((slide) => slide.title)} isComplete={workflowStatus === "complete"} onComplete={() => undefined} />;
  }

  if (currentStep === "preview") return <HtmlPreview html={generatedHtml} onStartOver={handleStartOver} />;

  return (
    <div className="min-h-screen paper-texture">
      <header className="sticky top-0 z-20 border-b border-[var(--border-light)] bg-[var(--bg-card)]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <h1 className="text-xl font-semibold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}>Presentation Studio</h1>
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
            <div><dt className="font-medium text-[var(--text-muted)]">Additional requirements</dt><dd className="text-[var(--text-primary)]">{brief?.requirements}</dd></div>
          </dl>
        </section>
        <div className="h-[calc(100vh-120px)] min-h-[620px]">
          <OutlinePanel items={outline} isLoading={currentStep === "outlining"} onToggle={handleToggle} onEdit={handleEdit} onDelete={handleDelete} onAdd={handleAdd} onGenerate={() => setWorkflowStatus("generating")} />
        </div>
      </main>
    </div>
  );
}
