"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePresentationWorkflow } from "@/src/hooks/use-presentation-workflow";
import type { HtmlGenerationStepData, PresentationOutlineData } from "@/src/types/presentation-workflow";
import AgentPanel, { type AgentMessage } from "./agent-panel";
import PresentationPreviewPane from "./presentation-preview-pane";
import PresentationWorkspace from "./presentation-workspace";
import { emptyOutline, toApprovedOutline, toSlideItem, type PresentationBrief, type SlideOutlineItem } from "./presentation-outline-utils";
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
  frontendSlidesSessionId?: string;
  frontendSlidesRunId?: string;
  done?: boolean;
  html?: string;
  htmlUrl?: string;
  generator?: "frontend-slides" | "backup";
  fallbackReason?: string;
};

// One line of the /api/agent-chat NDJSON stream. Mirrors the server-side
// AgentChatStreamEvent type in src/app/api/agent-chat/route.ts.
type AgentChatStreamEvent =
  | { type: "progress"; message: string }
  | { type: "result"; payload: AgentChatResponse }
  | { type: "error"; error: string };

function parseStreamLine(line: string): AgentChatStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed) as AgentChatStreamEvent;
  } catch {
    return null;
  }
}

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
  const [htmlWatchdogError, setHtmlWatchdogError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<AgentMessage[]>([]);
  const [isAgentReplying, setIsAgentReplying] = useState(false);
  const [queuedGenerationMessage, setQueuedGenerationMessage] = useState<string | null>(null);
  const [frontendSlidesSession, setFrontendSlidesSession] = useState<{ sessionId?: string; runId?: string }>({});
  const [interactiveResult, setInteractiveResult] = useState<HtmlGenerationStepData | null>(null);
  const [agentProgressMessage, setAgentProgressMessage] = useState<string | null>(null);

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
    if (baseOutline?.slides?.length) return baseOutline.slides.map(toSlideItem);
    return workflowOutline?.slides?.map(toStreamingSlideItem) ?? [];
  }, [baseOutline, workflowOutline]);

  const selectedSlides = useMemo(() => outline.filter((item) => item.selected), [outline]);
  const activeHtmlGenerationStepData = interactiveResult ?? htmlGenerationStep?.data;
  const generatedHtml = activeHtmlGenerationStepData?.html ?? "";
  const generatedHtmlUrl = activeHtmlGenerationStepData?.htmlUrl;


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
        message: "工作流会话已失效，请重新生成大纲后再试。",
      };
    }

    if (baseOutline?.slides?.length) {
      return {
        kind: "html",
        message: getErrorMessage(error, "生成 HTML 失败，请从已确认的大纲重试。"),
      };
    }

    return {
      kind: "outline",
      message: getErrorMessage(error, "生成大纲失败，请重新描述你的需求后重试。"),
    };
  }, [activeRunId, approvalError, baseOutline, error, htmlWatchdogError]);

  const phaseState = useMemo(() => deriveStudioPhase({
    hasWorkflowError: Boolean(workflowError),
    workflowErrorSource: workflowError?.kind,
    workflowErrorMessage: workflowError?.message,
    hasGeneratedHtml: Boolean(generatedHtml),
    htmlGeneration: activeHtmlGenerationStepData,
    hasSuspenseOutline: Boolean(suspenseData?.outline),
    hasOutlineSlides: outline.length > 0,
    workflowStatus: status,
  }), [activeHtmlGenerationStepData, generatedHtml, outline.length, status, suspenseData?.outline, workflowError]);

  const phase = phaseState.phase;
  const previewStep = toPreviewStep(phase);
  const generateDisabledReason = !activeRunId ? (approvalError ?? "正在等待工作流会话 ID 后才能生成 HTML。") : approvalError;

  useEffect(() => {
    if (htmlGenerationStep?.data?.status !== "in-progress") return;

    const lastUpdatedAt = htmlGenerationStep.data.lastUpdatedAt ?? Date.now();
    const timeout = window.setTimeout(() => {
      if (Date.now() - lastUpdatedAt >= 240_000) {
        stop();
        setHtmlWatchdogError("生成长时间没有进展，请重试，或减少页数后再试。");
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
    sendAgentRequest(nextBrief.requirements || nextBrief.topic, {
      topic: nextBrief.topic,
      audience: nextBrief.audience,
      pageCount: nextBrief.slideCount,
      style: nextBrief.style,
    });
  }, [brief, resetWorkflow, sendAgentRequest]);

  const sendToAgentChat = useCallback(async (
    history: AgentMessage[],
    hasGeneratedDeck: boolean,
    onProgress: (message: string) => void,
  ) => {
    const response = await fetch("/api/agent-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: textHistory(history),
        hasGeneratedDeck,
        frontendSlidesSessionId: frontendSlidesSession.sessionId,
        frontendSlidesRunId: frontendSlidesSession.runId,
      }),
    });

    if (!response.ok || !response.body) {
      const data = await response.json().catch(() => ({})) as AgentChatResponse;
      throw new Error(data.error || `Agent chat failed (HTTP ${response.status})`);
    }

    // The response is NDJSON: one JSON object per line. "progress" lines can
    // arrive any number of times before the single terminal "result"/"error"
    // line closes the stream, so the UI can show live activity instead of a
    // silent multi-minute wait.
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let result: AgentChatResponse | null = null;
    let streamError: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const event = parseStreamLine(line);
        if (!event) continue;

        if (event.type === "progress") {
          onProgress(event.message);
        } else if (event.type === "result") {
          result = event.payload;
        } else if (event.type === "error") {
          streamError = event.error;
        }
      }
    }

    const trailingEvent = parseStreamLine(buffer);
    if (trailingEvent?.type === "result") result = trailingEvent.payload;
    if (trailingEvent?.type === "error") streamError = trailingEvent.error;

    if (streamError) throw new Error(streamError);
    if (!result?.reply) throw new Error("Agent chat stream ended without a result");

    return result;
  }, [frontendSlidesSession.runId, frontendSlidesSession.sessionId]);

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
    setAgentProgressMessage(null);

    try {
      const data = await sendToAgentChat(history, Boolean(generatedHtml), setAgentProgressMessage);

      setChatMessages((current) => [...current, { id: makeId(), role: "assistant", kind: "text", content: data.reply! }]);

      if (data.frontendSlidesSessionId || data.frontendSlidesRunId) {
        setFrontendSlidesSession({ sessionId: data.frontendSlidesSessionId, runId: data.frontendSlidesRunId });
      }

      if (data.done && data.html) {
        setInteractiveResult({
          status: "completed",
          html: data.html,
          htmlUrl: data.htmlUrl,
          generator: data.generator,
          fallbackReason: data.fallbackReason,
          lastUpdatedAt: Date.now(),
        });
      } else if (data.readyToGenerate && data.brief) {
        startGenerationFromBrief(data.brief);
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setChatMessages((current) => [
        ...current,
        { id: makeId(), role: "assistant", kind: "text", content: `遇到了点问题：${detail}\n\n请稍后重试；如果反复出现，请检查模型或 API Key 配置。` },
      ]);
    } finally {
      setIsAgentReplying(false);
      setAgentProgressMessage(null);
    }
  }, [chatMessages, generatedHtml, phase, sendToAgentChat, startGenerationFromBrief]);

  const handleGenerate = useCallback(() => {
    if (!baseOutline || selectedSlides.length === 0 || !canApproveOutline) return;
    setHtmlWatchdogError(null);
    approveOutline(toApprovedOutline(baseOutline, outline));
  }, [approveOutline, baseOutline, canApproveOutline, outline, selectedSlides.length]);

  const handleStartOver = useCallback(() => {
    resetWorkflow();
    setHtmlWatchdogError(null);
    setBrief(null);
    setChatMessages([]);
    setIsAgentReplying(false);
    setQueuedGenerationMessage(null);
    setFrontendSlidesSession({});
    setInteractiveResult(null);
    setAgentProgressMessage(null);
  }, [resetWorkflow]);

  const handleRetry = useCallback((kind: StudioErrorSource) => {
    clearError();
    setHtmlWatchdogError(null);

    if (kind === "html") {
      handleGenerate();
      return;
    }

    setBrief(null);
  }, [clearError, handleGenerate]);

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

    if (phase === "previewing") {
      messages.push({
        id: "complete-card",
        role: "system",
        kind: "complete",
        slideCount: selectedSlides.length || outline.length,
        htmlUrl: generatedHtmlUrl,
        generator: activeHtmlGenerationStepData?.generator,
        fallbackReason: activeHtmlGenerationStepData?.fallbackReason,
      });
    }

    return messages;
  }, [
    activeHtmlGenerationStepData?.fallbackReason,
    activeHtmlGenerationStepData?.generator,
    canApproveOutline,
    generateDisabledReason,
    generatedHtmlUrl,
    outline.length,
    phase,
    selectedSlides.length,
    workflowError,
  ]);

  const agentMessages = useMemo(() => [...chatMessages, ...systemMessages], [chatMessages, systemMessages]);

  const agentContent = (
    <AgentPanel
      messages={agentMessages}
      phase={phase}
      isSending={isAgentReplying}
      progressMessage={agentProgressMessage}
      onSend={handleAgentSend}
      onGenerate={handleGenerate}
      onRetry={handleRetry}
      onQueueAfterGeneration={handleQueueAfterGeneration}
      onRestartWithMessage={handleRestartWithMessage}
      onStartOver={handleStartOver}
    />
  );

  return (
    <PresentationWorkspace
      previewContent={<PresentationPreviewPane currentStep={previewStep} generatedHtml={generatedHtml} outline={outline} outlineGeneration={outlineStep?.data} htmlGeneration={activeHtmlGenerationStepData} />}
      agentContent={agentContent}
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
