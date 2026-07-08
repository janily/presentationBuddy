"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { usePresentationWorkflow } from "@/src/hooks/use-presentation-workflow";
import type { PresentationOutlineData } from "@/src/types/presentation-workflow";
import AgentPanel, { type AgentMessage } from "./agent-panel";
import { type PresentationBrief } from "./brief-form";
import OutlinePanel from "./outline-panel";
import PresentationPreviewPane from "./presentation-preview-pane";
import PresentationWorkspace from "./presentation-workspace";
import { emptyOutline, toApprovedOutline, toSlideItem } from "./presentation-outline-utils";
import { type SlideOutlineItem } from "./slide-outline-card";
import { deriveStudioPhase, type StudioErrorSource, type StudioPhase } from "./use-studio-phase";

type PreviewPaneStep = "brief" | "outlining" | "review" | "generating" | "preview";

type AgentBriefData = {
  topic: string;
  audience: string;
  pageCount: number;
  style: string;
  requirements?: string;
};

type AgentChatResponse = {
  reply?: string;
  readyToGenerate?: boolean;
  brief?: AgentBriefData | null;
  error?: string;
};

const getErrorMessage = (error: Error | undefined, fallback: string) => {
  if (!error?.message) return fallback;

  try {
    const parsed = JSON.parse(error.message) as { error?: unknown; message?: unknown };
    if (typeof parsed.error === "string") return parsed.error;
    if (typeof parsed.message === "string") return parsed.message;
  } catch {
    // Plain text model/runtime errors should pass through unchanged.
  }

  return error.message;
};

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const initialGuidanceMessage: AgentMessage = {
  id: "initial-guidance",
  role: "assistant",
  kind: "text",
  content: "Tell me what presentation you want to create. Include the topic, audience, slide count, style, and any must-have sections. I will turn that into an outline first.",
};

function toPreviewStep(phase: StudioPhase): PreviewPaneStep {
  switch (phase) {
    case "outlining":
      return "outlining";
    case "reviewing":
    case "error":
      return "review";
    case "generating":
      return "generating";
    case "previewing":
      return "preview";
    case "briefing":
    default:
      return "brief";
  }
}

function textHistory(messages: AgentMessage[]) {
  return messages
    .filter((message): message is Extract<AgentMessage, { role: "assistant" | "user" }> => {
      return (message.role === "assistant" || message.role === "user") && (message.kind === undefined || message.kind === "text");
    })
    .map(({ role, content }) => ({ role, content }));
}

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
  const [isOutlineDrawerOpen, setIsOutlineDrawerOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<AgentMessage[]>([initialGuidanceMessage]);
  const [isAgentReplying, setIsAgentReplying] = useState(false);
  const [queuedGenerationMessage, setQueuedGenerationMessage] = useState<string | null>(null);

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
  const generatedHtmlUrl = htmlGenerationStep?.data?.htmlUrl;

  const workflowError = useMemo((): { kind: StudioErrorSource; message: string } | null => {
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

  const phaseState = useMemo(() => deriveStudioPhase({
    hasWorkflowError: Boolean(workflowError),
    workflowErrorSource: workflowError?.kind,
    workflowErrorMessage: workflowError?.message,
    hasGeneratedHtml: Boolean(generatedHtml),
    htmlGeneration: htmlGenerationStep?.data,
    hasSuspenseOutline: Boolean(suspenseData?.outline),
    hasOutlineSlides: outline.length > 0,
    workflowStatus: status,
  }), [generatedHtml, htmlGenerationStep?.data, outline.length, status, suspenseData?.outline, workflowError]);

  const phase = phaseState.phase;
  const previewStep = toPreviewStep(phase);
  const generateDisabledReason = !activeRunId ? (approvalError ?? "Waiting for the workflow run ID before generating HTML.") : approvalError;

  useEffect(() => {
    if (htmlGenerationStep?.data?.status !== "in-progress") return;

    const lastUpdatedAt = htmlGenerationStep.data.lastUpdatedAt ?? Date.now();
    const timeout = window.setTimeout(() => {
      if (Date.now() - lastUpdatedAt >= 240_000) {
        stop();
        setHtmlWatchdogError("Generation has not reported progress for several minutes. Please retry, reduce selected slides, or switch to a faster HTML model.");
      }
    }, 240_000);

    return () => window.clearTimeout(timeout);
  }, [htmlGenerationStep?.data?.lastUpdatedAt, htmlGenerationStep?.data?.status, stop]);

  const startGenerationFromBrief = useCallback((agentBrief: AgentBriefData) => {
    const nextBrief: PresentationBrief = {
      topic: agentBrief.topic,
      audience: agentBrief.audience,
      slideCount: agentBrief.pageCount,
      style: agentBrief.style,
      requirements: agentBrief.requirements?.trim() ?? "",
    };

    if (brief) {
      resetWorkflow();
    }

    setHtmlWatchdogError(null);
    setBrief(nextBrief);
    setUserModifiedOutline(null);
    setIsOutlineDrawerOpen(false);
    sendAgentRequest(nextBrief.requirements || nextBrief.topic, {
      topic: nextBrief.topic,
      audience: nextBrief.audience,
      pageCount: nextBrief.slideCount,
      style: nextBrief.style,
    });
  }, [brief, resetWorkflow, sendAgentRequest]);

  const sendToAgentChat = useCallback(async (history: AgentMessage[], hasGeneratedDeck: boolean) => {
    const response = await fetch("/api/agent-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: textHistory(history),
        hasGeneratedDeck,
      }),
    });
    const data = await response.json().catch(() => ({})) as AgentChatResponse;

    if (!response.ok || !data.reply) {
      throw new Error(data.error || `Agent chat failed (HTTP ${response.status})`);
    }

    return data;
  }, []);

  const handleAgentSend = useCallback(async (message: string, options: { force?: boolean } = {}) => {
    const userMessage: AgentMessage = { id: makeId(), role: "user", kind: "text", content: message };

    if (phase === "generating" && !options.force) {
      setChatMessages((current) => [
        ...current,
        userMessage,
        { id: makeId(), role: "system", kind: "generation-request", message },
      ]);
      return;
    }

    const history = [...chatMessages, userMessage];

    setHtmlWatchdogError(null);
    setChatMessages(history);
    setIsAgentReplying(true);

    try {
      const data = await sendToAgentChat(history, Boolean(generatedHtml));

      setChatMessages((current) => [...current, { id: makeId(), role: "assistant", kind: "text", content: data.reply! }]);

      if (data.readyToGenerate && data.brief) {
        startGenerationFromBrief(data.brief);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setChatMessages((current) => [
        ...current,
        { id: makeId(), role: "assistant", kind: "text", content: `I hit an issue: ${detail}\n\nTry again in a moment, or check the model/API key configuration if it keeps happening.` },
      ]);
    } finally {
      setIsAgentReplying(false);
    }
  }, [chatMessages, generatedHtml, phase, sendToAgentChat, startGenerationFromBrief]);

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
    setIsOutlineDrawerOpen(false);
    setHtmlWatchdogError(null);
    approveOutline(toApprovedOutline(baseOutline, outline));
  }, [approveOutline, baseOutline, canApproveOutline, outline, selectedSlides.length]);

  const handleStartOver = useCallback(() => {
    resetWorkflow();
    setHtmlWatchdogError(null);
    setBrief(null);
    setUserModifiedOutline(null);
    setIsOutlineDrawerOpen(false);
    setChatMessages([initialGuidanceMessage]);
    setIsAgentReplying(false);
    setQueuedGenerationMessage(null);
  }, [resetWorkflow]);

  const handleRetry = useCallback((kind: StudioErrorSource) => {
    clearError();
    setHtmlWatchdogError(null);

    if (kind === "html") {
      handleGenerate();
      return;
    }

    setUserModifiedOutline(null);
    setIsOutlineDrawerOpen(false);
    setBrief(null);
  }, [clearError, handleGenerate]);

  useEffect(() => {
    if (!isOutlineDrawerOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOutlineDrawerOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOutlineDrawerOpen]);

  const markGenerationRequestQueued = useCallback((messageId: string) => {
    setChatMessages((current) => current.map((message) => (
      message.id === messageId && message.kind === "generation-request"
        ? { ...message, queued: true }
        : message
    )));
  }, []);

  const handleQueueAfterGeneration = useCallback((messageId: string, message: string) => {
    markGenerationRequestQueued(messageId);
    setQueuedGenerationMessage(message);
  }, [markGenerationRequestQueued]);

  const handleRestartWithMessage = useCallback((messageId: string, message: string) => {
    stop();
    resetWorkflow();
    setHtmlWatchdogError(null);
    setQueuedGenerationMessage(null);
    markGenerationRequestQueued(messageId);
    window.setTimeout(() => {
      void handleAgentSend(message, { force: true });
    }, 0);
  }, [handleAgentSend, markGenerationRequestQueued, resetWorkflow, stop]);

  useEffect(() => {
    if (phase !== "previewing" || !queuedGenerationMessage) return;

    const message = queuedGenerationMessage;
    setQueuedGenerationMessage(null);
    void handleAgentSend(message, { force: true });
  }, [handleAgentSend, phase, queuedGenerationMessage]);

  const systemMessages = useMemo<AgentMessage[]>(() => {
    const messages: AgentMessage[] = [];

    if (phase === "error" && workflowError) {
      messages.push({
        id: `error-${workflowError.kind}`,
        role: "system",
        kind: "error",
        message: workflowError.message,
        retryKind: workflowError.kind,
      });
      return messages;
    }

    if (phase === "reviewing" && outline.length > 0) {
      messages.push({
        id: "outline-review-card",
        role: "system",
        kind: "outline-review",
        slideCount: selectedSlides.length,
        canGenerate: selectedSlides.length > 0 && canApproveOutline && !generateDisabledReason,
        disabledReason: generateDisabledReason,
      });
    }

    if (phase === "outlining") {
      messages.push({
        id: "outline-progress-card",
        role: "system",
        kind: "progress",
        message: outlineStep?.data?.message ?? "Drafting the presentation outline...",
        progress: outlineStep?.data?.progress,
        steps: outlineStep?.data?.steps,
      });
    }

    if (phase === "generating") {
      messages.push({
        id: "generation-progress-card",
        role: "system",
        kind: "progress",
        message: htmlGenerationStep?.data?.message ?? "Generating the HTML presentation...",
        progress: htmlGenerationStep?.data?.progress,
        steps: htmlGenerationStep?.data?.steps,
      });
    }

    if (phase === "previewing") {
      messages.push({
        id: "complete-card",
        role: "system",
        kind: "complete",
        slideCount: selectedSlides.length || outline.length,
        htmlUrl: generatedHtmlUrl,
      });
    }

    return messages;
  }, [canApproveOutline, generateDisabledReason, generatedHtmlUrl, htmlGenerationStep?.data?.message, htmlGenerationStep?.data?.progress, htmlGenerationStep?.data?.steps, outline.length, outlineStep?.data?.message, outlineStep?.data?.progress, outlineStep?.data?.steps, phase, selectedSlides.length, workflowError]);

  const agentMessages = useMemo(() => [...chatMessages, ...systemMessages], [chatMessages, systemMessages]);

  const agentContent = (
    <>
      <AgentPanel
        messages={agentMessages}
        phase={phase}
        isSending={isAgentReplying}
        onSend={handleAgentSend}
        onGenerate={handleGenerate}
        onOpenOutline={() => setIsOutlineDrawerOpen(true)}
        onRetry={handleRetry}
        onQueueAfterGeneration={handleQueueAfterGeneration}
        onRestartWithMessage={handleRestartWithMessage}
        title={phase === "previewing" ? "Keep refining this deck" : "Presentation agent"}
      />

      {isOutlineDrawerOpen && outline.length > 0 ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/25 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Edit presentation outline"
          onClick={() => setIsOutlineDrawerOpen(false)}
        >
          <div
            className="flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[var(--border-light)] bg-[var(--bg-card)] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--border-light)] bg-[var(--bg-secondary)] px-5 py-4">
              <div>
                <h3 className="font-semibold text-[var(--text-primary)]">Edit outline</h3>
                <p className="text-sm text-[var(--text-muted)]">Make slide-level changes, then return to the conversation.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsOutlineDrawerOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border-light)] bg-white text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
                aria-label="Close outline editor"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 p-4">
              <OutlinePanel
                items={outline}
                isLoading={phase === "outlining"}
                onToggle={handleToggle}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onAdd={handleAdd}
                onGenerate={handleGenerate}
                generateDisabledReason={generateDisabledReason}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

  return (
    <PresentationWorkspace
      previewContent={<PresentationPreviewPane currentStep={previewStep} generatedHtml={generatedHtml} outline={outline} outlineGeneration={outlineStep?.data} htmlGeneration={htmlGenerationStep?.data} />}
      agentContent={agentContent}
      onStartOver={handleStartOver}
    />
  );
}

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
