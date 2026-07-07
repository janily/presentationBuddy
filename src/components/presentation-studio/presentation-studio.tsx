"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { usePresentationWorkflow } from "@/src/hooks/use-presentation-workflow";
import type { PresentationOutlineData } from "@/src/types/presentation-workflow";
import AgentPanel from "./agent-panel";
import { type PresentationBrief } from "./brief-form";
import OutlinePanel from "./outline-panel";
import PresentationPreviewPane from "./presentation-preview-pane";
import PresentationWorkspace from "./presentation-workspace";
import { emptyOutline, toApprovedOutline, toSlideItem } from "./presentation-outline-utils";
import { type SlideOutlineItem } from "./slide-outline-card";

type WorkflowStep = "brief" | "outlining" | "review" | "generating" | "preview";
type WorkflowErrorKind = "outline" | "html" | "resume";

const getErrorMessage = (error: Error | undefined, fallback: string) => {
  if (!error?.message) return fallback;

  try {
    const parsed = JSON.parse(error.message) as { error?: unknown; message?: unknown };
    if (typeof parsed.error === "string") return parsed.error;
    if (typeof parsed.message === "string") return parsed.message;
  } catch {
    // The AI SDK can expose plain-text error messages; use those as-is.
  }

  return error.message;
};

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const toDefaultBriefFromAgentRequest = (message: string): PresentationBrief => ({
  topic: message,
  audience: "General business audience",
  slideCount: 6,
  style: "Polished modern presentation",
  requirements: message,
});

const toStreamingSlideItem = (slide: Partial<PresentationOutlineData["slides"][number]>, index: number): SlideOutlineItem => {
  const title = slide.title?.trim() || `Drafting slide ${index + 1}...`;
  const keyPoints = slide.keyPoints?.filter(Boolean) ?? [];
  const purpose = slide.purpose?.trim() || "Drafting purpose and key points...";
  const designSuggestion = slide.designSuggestion?.trim() || "Choosing an appropriate visual treatment...";
  const notes = [purpose, ...keyPoints, designSuggestion].filter(Boolean).join(" ");

  return {
    id: `${slide.pageNumber ?? index + 1}-${title}`,
    title,
    notes,
    selected: true,
    purpose,
    keyPoints,
    designSuggestion,
    originalNotes: notes,
  };
};

export default function PresentationStudio() {
  const {
    sendAgentRequest,
    approveOutline,
    suspenseData,
    outlineStep,
    htmlGenerationStep,
    status,
    activeRunId,
    approvalError,
    canApproveOutline,
    error,
    clearError,
    stop,
    resetWorkflow,
  } = usePresentationWorkflow();
  const [brief, setBrief] = useState<PresentationBrief | null>(null);
  const [userModifiedOutline, setUserModifiedOutline] = useState<SlideOutlineItem[] | null>(null);
  const [htmlWatchdogError, setHtmlWatchdogError] = useState<string | null>(null);
  const [isAdvancedOutlineOpen, setIsAdvancedOutlineOpen] = useState(false);

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
    if (baseOutline?.slides?.length) return baseOutline.slides.map(toSlideItem);
    return workflowOutline?.slides?.map(toStreamingSlideItem) ?? [];
  }, [baseOutline, userModifiedOutline, workflowOutline]);

  const selectedSlides = useMemo(() => outline.filter((item) => item.selected), [outline]);
  const generatedHtml = htmlGenerationStep?.data?.html ?? "";
  const workflowError = useMemo((): { kind: WorkflowErrorKind; message: string } | null => {
    if (htmlWatchdogError) {
      return {
        kind: "html",
        message: htmlWatchdogError,
      };
    }

    if (approvalError) {
      return {
        kind: "resume",
        message: approvalError,
      };
    }

    if (!error) return null;

    if (!activeRunId && baseOutline?.slides?.length) {
      return {
        kind: "resume",
        message: "Workflow run ID is missing. Please create the outline again before generating HTML.",
      };
    }

    if (baseOutline?.slides?.length) {
      return {
        kind: "html",
        message: getErrorMessage(error, "HTML generation failed. Please retry from the approved outline."),
      };
    }

    return {
      kind: "outline",
      message: getErrorMessage(error, "Outline generation failed. Please return to the brief and try again."),
    };
  }, [activeRunId, approvalError, baseOutline, error, htmlWatchdogError]);

  const currentStep = useMemo((): WorkflowStep => {
    if (!brief) return "brief";
    if (htmlGenerationStep?.data?.status === "completed" && generatedHtml) return "preview";
    if (workflowError) return "review";
    if (htmlGenerationStep?.data?.status === "in-progress") return "generating";
    if (status === "submitted" || (status === "streaming" && !baseOutline?.slides?.length)) return "outlining";
    return "review";
  }, [baseOutline, brief, generatedHtml, htmlGenerationStep, status, workflowError]);

  useEffect(() => {
    if (htmlGenerationStep?.data?.status !== "in-progress") return;

    const generatedCharacters = htmlGenerationStep.data.generatedCharacters ?? 0;
    const timeout = window.setTimeout(() => {
      if (generatedCharacters === 0) {
        stop();
        setHtmlWatchdogError("HTML generation did not receive any model output for 45 seconds. Please retry HTML generation or reduce the number of selected slides.");
      }
    }, 45_000);

    return () => window.clearTimeout(timeout);
  }, [htmlGenerationStep?.data?.generatedCharacters, htmlGenerationStep?.data?.status, stop]);

  const handleAgentRequestSubmit = useCallback((message: string) => {
    const contextualMessage = generatedHtml
      ? `${message}\n\nCurrent deck context: revise the generated presentation rather than switching away from the workspace.`
      : message;
    const nextBrief = toDefaultBriefFromAgentRequest(message);

    setHtmlWatchdogError(null);
    setBrief(nextBrief);
    setUserModifiedOutline(null);
    setIsAdvancedOutlineOpen(false);
    sendAgentRequest(contextualMessage, {
      topic: nextBrief.topic,
      audience: nextBrief.audience,
      pageCount: nextBrief.slideCount,
      style: nextBrief.style,
      requirements: nextBrief.requirements,
    });
  }, [generatedHtml, sendAgentRequest]);

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
      {
        id: makeId(),
        title,
        notes: "Add supporting detail, examples, and speaker notes for this slide.",
        selected: true,
        purpose: "Add supporting detail, examples, and speaker notes for this slide.",
        keyPoints: ["Add supporting detail, examples, and speaker notes for this slide."],
        designSuggestion: baseOutline?.designGuidance.join(" ") || "Use a polished, readable slide layout.",
      },
    ]);
  }, [baseOutline, outline]);

  const handleGenerate = useCallback(() => {
    if (!baseOutline || selectedSlides.length === 0 || !canApproveOutline) return;
    setIsAdvancedOutlineOpen(false);
    setHtmlWatchdogError(null);
    approveOutline(toApprovedOutline(baseOutline, outline));
  }, [approveOutline, baseOutline, canApproveOutline, outline, selectedSlides.length]);

  const generateDisabledReason = !activeRunId ? (approvalError ?? "Waiting for the workflow run ID before generating HTML.") : approvalError;

  const handleStartOver = useCallback(() => {
    resetWorkflow();
    setHtmlWatchdogError(null);
    setBrief(null);
    setUserModifiedOutline(null);
    setIsAdvancedOutlineOpen(false);
  }, [resetWorkflow]);

  const handleRetryBrief = useCallback(() => {
    clearError();
    setHtmlWatchdogError(null);
    setUserModifiedOutline(null);
    setIsAdvancedOutlineOpen(false);
    setBrief(null);
  }, [clearError]);

  const handleRetryHtml = useCallback(() => {
    clearError();
    setHtmlWatchdogError(null);
    handleGenerate();
  }, [clearError, handleGenerate]);

  const agentContent = (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {workflowError && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-700">Generation issue</p>
          <p className="mt-2 text-sm">{workflowError.message}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            {workflowError.kind === "html" && (
              <button type="button" onClick={handleRetryHtml} className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">Retry HTML generation</button>
            )}
            {(workflowError.kind === "outline" || workflowError.kind === "resume") && (
              <button type="button" onClick={handleRetryBrief} className="rounded-xl bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">Reset brief</button>
            )}
          </div>
        </section>
      )}

      {brief ? (
        <section className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-elevated)] p-4">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--accent-brass)]">Current request</p>
          <h3 className="mt-2 text-xl font-semibold text-[var(--text-primary)]" style={{ fontFamily: "var(--font-fraunces), Georgia, serif" }}>{brief.topic}</h3>
          <dl className="mt-4 space-y-2 text-sm">
            <div><dt className="font-medium text-[var(--text-muted)]">Audience</dt><dd className="text-[var(--text-primary)]">{brief.audience}</dd></div>
            <div><dt className="font-medium text-[var(--text-muted)]">Style</dt><dd className="text-[var(--text-primary)]">{brief.style}</dd></div>
            <div><dt className="font-medium text-[var(--text-muted)]">Narrative goal</dt><dd className="text-[var(--text-primary)]">{baseOutline?.narrativeGoal ?? suspenseData?.reason ?? "The agent will suggest a narrative after outline generation starts."}</dd></div>
          </dl>
        </section>
      ) : null}

      {currentStep === "generating" ? (
        <section className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-elevated)] p-4 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--accent-brass)]">Agent message</p>
          <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">Generating your HTML presentation...</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{htmlGenerationStep?.data?.message ?? "Preparing the selected slides for the live preview."}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--bg-secondary)]">
            <div className="h-full rounded-full bg-[var(--accent-terracotta)] transition-all duration-500" style={{ width: `${htmlGenerationStep?.data?.progress ?? 25}%` }} />
          </div>
        </section>
      ) : null}

      {currentStep === "review" && outline.length > 0 ? (
        <section className="rounded-2xl border border-[var(--accent-terracotta)]/30 bg-[var(--accent-terracotta)]/10 p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-white/70 p-2 text-[var(--accent-terracotta)]"><Sparkles className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[var(--accent-brass)]">Agent message</p>
              <h3 className="mt-1 font-semibold text-[var(--text-primary)]">我已准备好大纲，要生成预览吗？</h3>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">你可以直接生成 HTML preview，也可以继续用自然语言要求我调整结构；高级大纲编辑入口保留在下方。</p>
              <button type="button" onClick={handleGenerate} disabled={selectedSlides.length === 0 || !canApproveOutline || Boolean(generateDisabledReason)} className="mt-4 rounded-xl bg-[var(--accent-terracotta)] px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-[var(--accent-terracotta-light)] disabled:cursor-not-allowed disabled:opacity-50">
                Generate preview ({selectedSlides.length} slides)
              </button>
              {generateDisabledReason ? <p className="mt-2 text-xs text-[var(--accent-terracotta)]">{generateDisabledReason}</p> : null}
            </div>
          </div>
        </section>
      ) : null}

      {currentStep === "brief" ? (
        <AgentPanel onSubmit={handleAgentRequestSubmit} />
      ) : currentStep === "preview" ? (
        <AgentPanel
          onSubmit={handleAgentRequestSubmit}
          title="Keep refining this deck"
          subtitle="Ask for style, slide, or content changes without leaving the preview."
          initialMessage="演示文稿已生成。你可以继续说：调整风格、删掉第 3 页、换成更商务，或补充新的内容要求。"
          helperText="发送后会基于当前预览继续在同一工作区处理，右侧对话保持可用。"
          quickPrompts={["调整风格", "删掉第 3 页", "换成更商务"]}
          placeholder="例如：把整体风格换成更商务，删掉第 3 页，并加强结尾 CTA。"
        />
      ) : (
        <AgentPanel
          onSubmit={handleAgentRequestSubmit}
          title={currentStep === "outlining" ? "Agent is drafting" : "Continue with the agent"}
          subtitle="Natural language stays the primary path; use the advanced outline only when needed."
          initialMessage={currentStep === "outlining" ? "我正在生成大纲。你仍然可以继续补充要求，我会基于新的上下文重新推进。" : "大纲已准备好。可以点击生成预览，也可以继续告诉我你想如何调整。"}
          helperText="无需先完成卡片编辑；继续输入自然语言即可推进或重做大纲。"
          quickPrompts={["增加案例页", "让叙事更有说服力", "改成高端商务风"]}
          placeholder="例如：把第 2 页拆成两页，并把整体语气调整得更适合董事会。"
        />
      )}

      {brief && outline.length > 0 ? (
        <section className="rounded-2xl border border-[var(--border-light)] bg-[var(--bg-elevated)] shadow-sm">
          <button type="button" onClick={() => setIsAdvancedOutlineOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
            <span>
              <span className="block text-sm font-semibold text-[var(--text-primary)]">Advanced outline editing</span>
              <span className="mt-1 block text-xs text-[var(--text-muted)]">Optional: select, edit, delete, or add slides without blocking the agent conversation.</span>
            </span>
            {isAdvancedOutlineOpen ? <ChevronDown className="h-5 w-5 text-[var(--text-muted)]" /> : <ChevronRight className="h-5 w-5 text-[var(--text-muted)]" />}
          </button>
          {isAdvancedOutlineOpen ? (
            <div className="h-[560px] border-t border-[var(--border-light)] p-3">
              <OutlinePanel items={outline} isLoading={currentStep === "outlining"} onToggle={handleToggle} onEdit={handleEdit} onDelete={handleDelete} onAdd={handleAdd} onGenerate={handleGenerate} generateDisabledReason={generateDisabledReason} />
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );

  return (
    <PresentationWorkspace
      previewContent={<PresentationPreviewPane currentStep={currentStep} generatedHtml={generatedHtml} outline={outline} htmlGeneration={htmlGenerationStep?.data} />}
      agentContent={agentContent}
      onStartOver={handleStartOver}
    />
  );
}
