"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DefaultChatTransport } from "ai";
import { usePresentationWorkflow } from "@/src/hooks/use-presentation-workflow";
import type {
  ArtifactOperation,
  HtmlGenerationStepData,
  PresentationBriefData,
  PresentationOutlineData,
  RevisionSpec,
} from "@/src/types/presentation-workflow";
import AgentPanel, { type AgentMessage } from "./agent-panel";
import { getQuickActionDefinition, type AgentQuickActionChoice, type AgentQuickCommand } from "./agent-quick-actions";
import { appendCompletionMessage } from "./agent-message-model";
import { dispatchAgentChatUIChunk, type AgentChatStreamCallbacks } from "./agent-chat-ui-stream";
import { applyReasoningEvent, stopStreamingAssistantMessage } from "./agent-message-stream-state";
import { requestsCancelledGenerationRetry } from "./cancelled-generation-retry";
import { discoverFrontendSlideStyles, listFrontendSlideStyles, type FrontendSlidesStylePreview, type FrontendSlidesStyleSpec } from "@/src/services/frontend-slides/style-catalog";
import { applyPaletteRevision } from "@/src/services/frontend-slides/palette-revision";
import { buildFullDeckStyleRevision, isStructureChangingRevision } from "./revision-routing";
import { removeOutlineVisualDirections } from "@/src/utils/presentation-outline-style";
import {
  shouldAppendReplayMessage,
  shouldDeferAgentAction,
} from "./generation-state-routing";
import type { AgentActionProposal, AgentChatResponse, AgentChatUIChunk, AgentChatUIMessage } from "@/src/types/agent-chat";
import {
  buildRevisionFromProposal,
  resolveProposalConfirmation,
  resolveStructureRevisionPageCount,
  shouldShowProposalCard,
} from "./proposal-routing";
import PresentationPreviewPane from "./presentation-preview-pane";
import PresentationWorkspace from "./presentation-workspace";
import { emptyOutline, toApprovedOutline, toSlideItem, type PresentationBrief, type SlideOutlineItem } from "./presentation-outline-utils";
import { deriveStudioPhase, type StudioErrorSource, type StudioPhase } from "./use-studio-phase";

type PreviewPaneStep = "brief" | "outlining" | "review" | "generating" | "preview";

type AgentBriefData = NonNullable<AgentChatResponse["brief"]>;

type PendingArtifact = {
  operation: ArtifactOperation;
  brief: PresentationBrief;
  outline: PresentationOutlineData;
  revision?: RevisionSpec;
  mode: "generation" | "revision" | "structure-revision";
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

function persistCancelledProposal(proposal: AgentActionProposal) {
  if (!proposal.executionId) return;
  void fetch("/api/agent-chat/proposal-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      proposalId: proposal.proposalId,
      status: "cancelled",
      executionId: proposal.executionId,
    }),
  });
}

async function persistResumedProposal(proposalId: string, operation: ArtifactOperation) {
  const response = await fetch("/api/agent-chat/proposal-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      proposalId,
      status: "executing",
      deckId: operation.deckId,
      baseVersion: operation.baseVersion,
    }),
  });
  if (!response.ok) {
    throw new Error("无法恢复刚才已停止的修改，请基于当前版本重新确认方案。");
  }
  return response.json() as Promise<AgentActionProposal>;
}

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
      return (message.role === "assistant" || message.role === "user")
        && (message.kind === undefined || message.kind === "text")
        && !message.isStreaming
        && message.content.trim().length > 0;
    })
    .map(({ role, content }) => ({ role, content }));
}

function toBriefData(brief: PresentationBrief, artifact?: ArtifactOperation): PresentationBriefData {
  return {
    topic: brief.topic,
    audience: brief.audience,
    pageCount: brief.slideCount,
    style: brief.style,
    requirements: brief.requirements,
    purpose: brief.purpose,
    density: brief.density,
    contentReadiness: brief.contentReadiness,
    styleSpec: brief.styleSpec,
    artifact,
  };
}

export default function PresentationStudio() {
  const {
    sendAgentRequest,
    sendRevision,
    approveOutline,
    suspenseData,
    outlineStep,
    htmlGenerationStep,
    workflowFailure,
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
  const [agentProgressMessage, setAgentProgressMessage] = useState<string | null>(null);
  const [activeArtifact, setActiveArtifact] = useState<{
    deckId: string;
    version: number;
    html: string;
    htmlUrl?: string;
    brief: PresentationBrief;
    outline: PresentationOutlineData;
  } | null>(null);
  const [pendingArtifact, setPendingArtifact] = useState<PendingArtifact | null>(null);
  const [lastCancelledArtifact, setLastCancelledArtifact] = useState<PendingArtifact | null>(null);
  const [pendingProposal, setPendingProposal] = useState<AgentActionProposal | null>(null);
  const [confirmingProposalId, setConfirmingProposalId] = useState<string | null>(null);
  const [stylePreviews, setStylePreviews] = useState<FrontendSlidesStylePreview[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<FrontendSlidesStyleSpec | null>(null);
  const [styleDiscoveryBrief, setStyleDiscoveryBrief] = useState<AgentBriefData | null>(null);
  const [isDiscoveringStyles, setIsDiscoveringStyles] = useState(false);
  const [shownStyleIds, setShownStyleIds] = useState<string[]>([]);
  const [styleBatch, setStyleBatch] = useState(0);
  const [remainingStyleCount, setRemainingStyleCount] = useState(0);
  const agentChatAbortRef = useRef<AbortController | null>(null);
  const agentReplyingRef = useRef(false);
  const deckIdRef = useRef(`deck-${makeId()}`);
  const publishedArtifactKeyRef = useRef<string | null>(null);
  const phaseRef = useRef<StudioPhase>("briefing");
  const activeArtifactRef = useRef(activeArtifact);
  activeArtifactRef.current = activeArtifact;

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
  const activeHtmlGenerationStepData = useMemo<HtmlGenerationStepData | undefined>(() => {
    const workflowData = htmlGenerationStep?.data;

    if (activeArtifact && pendingArtifact) {
      if (workflowData?.artifact?.operationId === pendingArtifact.operation.operationId) {
        return workflowData;
      }

      if (pendingArtifact.mode === "generation") return undefined;

      return {
        status: "in-progress",
        phase: "structure",
        message: "正在启动版本修改…",
        progress: 5,
        lastUpdatedAt: 0,
        artifact: {
          operationId: pendingArtifact.operation.operationId,
          deckId: pendingArtifact.operation.deckId,
          version: pendingArtifact.operation.targetVersion,
        },
      };
    }

    if (workflowData) return workflowData;
    if (!activeArtifact) return undefined;

    return {
      status: "completed",
      html: activeArtifact.html,
      htmlUrl: activeArtifact.htmlUrl,
      progress: 100,
      artifact: {
        operationId: activeArtifact.deckId,
        deckId: activeArtifact.deckId,
        version: activeArtifact.version,
      },
    };
  }, [activeArtifact, htmlGenerationStep?.data, pendingArtifact]);
  const generatedHtml = activeHtmlGenerationStepData?.status === "completed"
    ? activeHtmlGenerationStepData.html ?? activeArtifact?.html ?? ""
    : activeArtifact?.html ?? activeHtmlGenerationStepData?.html ?? "";
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

    if (outlineStep?.data?.status === "failed") {
      return {
        kind: pendingArtifact?.revision ? "html" : "outline",
        message: pendingArtifact?.revision
          ? "新版本生成失败（大纲修改阶段），当前预览未变更。请重试本次修改。"
          : "大纲生成失败，请重试。",
      };
    }

    if (htmlGenerationStep?.data?.status === "failed") {
      return {
        kind: "html",
        message: "新版本 HTML 生成失败，当前预览未变更。请重试本次生成。",
      };
    }

    if (workflowFailure) {
      const failedDuringOutline = workflowFailure.stepId === "presentation-outline-suggestion-step";
      return {
        kind: pendingArtifact?.revision ? "html" : failedDuringOutline ? "outline" : "html",
        message: pendingArtifact?.revision
          ? `新版本生成失败${failedDuringOutline ? "（大纲修改阶段）" : ""}，当前预览未变更。请重试本次修改。`
          : failedDuringOutline
            ? "大纲生成失败，请重试。"
            : "演示文稿生成失败，请重试。",
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
  }, [activeRunId, approvalError, baseOutline, error, htmlGenerationStep?.data?.status, htmlWatchdogError, outlineStep?.data?.status, pendingArtifact?.revision, workflowFailure]);

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
  phaseRef.current = phase;
  const previewStep = phase === "error" && activeArtifact ? "preview" : toPreviewStep(phase);
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

  const beginRevision = useCallback((revision: RevisionSpec, proposal?: AgentActionProposal) => {
    const baselineOutline = activeArtifact?.outline ?? baseOutline;
    const baselineBrief = activeArtifact?.brief ?? brief;
    if (!baselineOutline || !baselineBrief || revision.requiresOutlineReview) return false;
    const revisionOutline = revision.kind === "style"
      ? removeOutlineVisualDirections(baselineOutline)
      : baselineOutline;

    const baseVersion = activeArtifact?.version ?? activeHtmlGenerationStepData?.artifact?.version ?? 0;
    const operation: ArtifactOperation = {
      operationId: `operation-${makeId()}`,
      deckId: activeArtifact?.deckId ?? activeHtmlGenerationStepData?.artifact?.deckId ?? deckIdRef.current,
      baseVersion,
      targetVersion: baseVersion + 1,
      proposalId: proposal?.proposalId,
      executionId: proposal?.executionId,
    };
    const isPaletteRevision = revision.kind === "palette";
    const revisedBrief: PresentationBrief = {
      ...baselineBrief,
      style: revision.style
        ?? (isPaletteRevision
          ? `${baselineBrief.style}. Palette revision: ${revision.instruction}`
          : baselineBrief.style),
      styleSpec: isPaletteRevision
        ? applyPaletteRevision(baselineBrief.styleSpec, revision.instruction)
        : revision.styleSpec ?? baselineBrief.styleSpec,
      requirements: revision.kind === "style"
        ? baselineBrief.requirements
        : [baselineBrief.requirements, revision.instruction].filter(Boolean).join("\n\n"),
    };

    setHtmlWatchdogError(null);
    setLastCancelledArtifact(null);
    setPendingArtifact({ operation, brief: revisedBrief, outline: revisionOutline, revision, mode: "revision" });
    sendRevision({
      presentationBrief: toBriefData(revisedBrief),
      approvedOutline: revisionOutline,
      revision,
      artifact: operation,
    });
    return true;
  }, [activeArtifact, activeHtmlGenerationStepData?.artifact?.deckId, activeHtmlGenerationStepData?.artifact?.version, baseOutline, brief, sendRevision]);

  const beginStructureRevision = useCallback((proposal: AgentActionProposal) => {
    if (!activeArtifact) return false;

    const operation: ArtifactOperation = {
      operationId: `operation-${makeId()}`,
      deckId: activeArtifact.deckId,
      baseVersion: activeArtifact.version,
      targetVersion: activeArtifact.version + 1,
      proposalId: proposal.proposalId,
      executionId: proposal.executionId,
    };
    const slideCount = resolveStructureRevisionPageCount(
      activeArtifact.outline.slides.length,
      proposal.instruction,
    );
    const revisedBrief: PresentationBrief = {
      ...activeArtifact.brief,
      slideCount,
      requirements: [
        activeArtifact.brief.requirements,
        `Apply this confirmed structural revision: ${proposal.instruction}`,
        "Preserve every unaffected slide and the current visual style.",
      ].filter(Boolean).join("\n\n"),
    };

    setHtmlWatchdogError(null);
    setLastCancelledArtifact(null);
    setBrief(revisedBrief);
    setPendingArtifact({
      operation,
      brief: revisedBrief,
      outline: emptyOutline(revisedBrief),
      revision: {
        kind: "structure",
        instruction: proposal.instruction,
        targetSlides: proposal.targetSlides,
        requiresOutlineReview: true,
      },
      mode: "structure-revision",
    });
    sendRevision({
      presentationBrief: toBriefData(revisedBrief),
      approvedOutline: activeArtifact.outline,
      revision: {
        kind: "structure",
        instruction: proposal.instruction,
        targetSlides: proposal.targetSlides,
        requiresOutlineReview: true,
      },
      artifact: operation,
    });
    return true;
  }, [activeArtifact, sendRevision]);

  const executeProposal = useCallback((proposal: AgentActionProposal) => {
    const revision = buildRevisionFromProposal(proposal);
    const started = proposal.requiresOutlineReview
      ? beginStructureRevision(proposal)
      : beginRevision(revision, proposal);

    if (!started) return false;

    setPendingProposal({ ...proposal, status: "executing" });
    return true;
  }, [beginRevision, beginStructureRevision]);

  const startGenerationFromBrief = useCallback((agentBrief: AgentBriefData, revisionMessage?: string) => {
    setStylePreviews([]);
    setIsDiscoveringStyles(false);
    const nextBrief: PresentationBrief = {
      topic: agentBrief.topic,
      audience: agentBrief.audience,
      slideCount: agentBrief.pageCount,
      style: selectedStyle?.name ?? agentBrief.style,
      requirements: agentBrief.requirements?.trim() ?? "",
      purpose: agentBrief.purpose ?? styleDiscoveryBrief?.purpose,
      density: agentBrief.density ?? styleDiscoveryBrief?.density,
      contentReadiness: agentBrief.contentReadiness ?? styleDiscoveryBrief?.contentReadiness,
      styleSpec: selectedStyle ?? undefined,
    };

    setLastCancelledArtifact(null);

    if (activeArtifact && baseOutline) {
      if (
        nextBrief.slideCount !== activeArtifact.outline.slides.length
        || (revisionMessage ? isStructureChangingRevision(revisionMessage) : false)
      ) {
        const operation: ArtifactOperation = {
          operationId: `operation-${makeId()}`,
          deckId: activeArtifact.deckId,
          baseVersion: activeArtifact.version,
          targetVersion: activeArtifact.version + 1,
        };

        setPendingArtifact({
          operation,
          brief: nextBrief,
          outline: emptyOutline(nextBrief),
          mode: "generation",
        });
        sendAgentRequest(nextBrief.requirements || nextBrief.topic, {
          ...toBriefData(nextBrief, operation),
        });
        return;
      }

      if (nextBrief.styleSpec) {
        beginRevision(buildFullDeckStyleRevision(nextBrief.style, nextBrief.styleSpec));
      }
      return;
    }

    const operation: ArtifactOperation = {
      operationId: `operation-${makeId()}`,
      deckId: deckIdRef.current,
      baseVersion: 0,
      targetVersion: 1,
    };

    setHtmlWatchdogError(null);
    setBrief(nextBrief);
    setPendingArtifact({
      operation,
      brief: nextBrief,
      outline: emptyOutline(nextBrief),
      mode: "generation",
    });
    sendAgentRequest(nextBrief.requirements || nextBrief.topic, {
      ...toBriefData(nextBrief, operation),
    });
  }, [activeArtifact, baseOutline, beginRevision, selectedStyle, sendAgentRequest, styleDiscoveryBrief]);

  // Kept temporarily for direct endpoint diagnostics; interactive discovery uses local assets below.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const discoverStylesViaApi = useCallback(async (agentBrief: AgentBriefData) => {
    setStyleDiscoveryBrief(agentBrief);
    setSelectedStyle(null);
    setIsDiscoveringStyles(true);
    setStylePreviews([]);
    try {
      const response = await fetch("/api/style-discovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: agentBrief.topic,
          audience: agentBrief.audience,
          purpose: agentBrief.purpose ?? "teaching-tutorial",
          density: agentBrief.density ?? "speaker-led",
        }),
      });
      const data = await response.json() as { previews?: FrontendSlidesStylePreview[]; error?: string };
      if (!response.ok || !data.previews) throw new Error(data.error ?? "无法生成风格预览");
      setStylePreviews(data.previews);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setChatMessages((current) => [...current, { id: makeId(), role: "assistant", kind: "text", content: `frontend-slides 风格预览生成失败：${message}` }]);
    } finally {
      setIsDiscoveringStyles(false);
    }
  }, []);

  const discoverStyles = useCallback((agentBrief: AgentBriefData, mode: "initial" | "more" = "initial") => {
    setStyleDiscoveryBrief(agentBrief);
    setSelectedStyle(null);
    setIsDiscoveringStyles(false);
    const excludedIds = mode === "more" ? shownStyleIds : [];
    const previews = discoverFrontendSlideStyles({
      topic: agentBrief.topic,
      audience: agentBrief.audience,
      purpose: agentBrief.purpose ?? "teaching-tutorial",
      density: agentBrief.density ?? "speaker-led",
    }, undefined, { excludeIds: excludedIds });
    const nextShownIds = mode === "more"
      ? [...new Set([...shownStyleIds, ...previews.map((preview) => preview.style.id)])]
      : previews.map((preview) => preview.style.id);

    setStylePreviews(previews);
    setShownStyleIds(nextShownIds);
    setStyleBatch(mode === "more" ? (current) => current + 1 : 1);
    setRemainingStyleCount(Math.max(0, listFrontendSlideStyles().length - nextShownIds.length));
  }, [shownStyleIds]);

  const discoverMoreStyles = useCallback(() => {
    if (!styleDiscoveryBrief || remainingStyleCount === 0) return;
    discoverStyles(styleDiscoveryBrief, "more");
  }, [discoverStyles, remainingStyleCount, styleDiscoveryBrief]);

  const handleSelectStyle = useCallback((style: FrontendSlidesStyleSpec) => {
    setSelectedStyle(style);
    setChatMessages((current) => [
      ...current,
      { id: makeId(), role: "user", kind: "text", content: `选择 frontend-slides 风格：${style.name}` },
      { id: makeId(), role: "assistant", kind: "text", content: `已选择「${style.name}」。我会保持它的字体、配色、布局语法和标志性元素贯穿整份演示文稿。回复“确认生成”后开始。` },
    ]);
  }, []);

  const sendToAgentChat = useCallback(async (
    history: AgentMessage[],
    hasGeneratedDeck: boolean,
    isGenerating: boolean,
    callbacks: AgentChatStreamCallbacks,
  ) => {
    const operationId = `operation-${makeId()}`;
    const transport = new DefaultChatTransport<AgentChatUIMessage>({
      api: "/api/agent-chat",
      prepareSendMessagesRequest: () => ({
        body: {
          messages: textHistory(history),
          hasGeneratedDeck,
          hasSelectedStyle: Boolean(selectedStyle ?? activeArtifact?.brief.styleSpec),
          isGenerating,
          hasFailedGeneration: Boolean(workflowError),
          draftBrief: workflowError && brief ? toBriefData(brief) : undefined,
          pendingProposalId: pendingProposal?.status === "pending" ? pendingProposal.proposalId : undefined,
          operationId,
          deckContext: activeArtifact ? {
            deckId: activeArtifact.deckId,
            version: activeArtifact.version,
            presentationBrief: toBriefData(activeArtifact.brief),
            approvedOutline: activeArtifact.outline,
          } : undefined,
        },
      }),
    });
    const stream = await transport.sendMessages({
      trigger: "submit-message",
      chatId: operationId,
      messageId: undefined,
      messages: [],
      abortSignal: callbacks.signal,
    });
    const reader = stream.getReader();
    const streamState: { result?: AgentChatResponse; error?: string } = {};

    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      const dispatchResult = dispatchAgentChatUIChunk(chunk as AgentChatUIChunk, callbacks);
      if (dispatchResult.result) streamState.result = dispatchResult.result;
      if (dispatchResult.error) streamState.error = dispatchResult.error;
    }

    if (streamState.error) throw new Error(streamState.error);
    if (!streamState.result?.reply) throw new Error("Agent chat stream ended without a result");

    return streamState.result;
  }, [activeArtifact, brief, pendingProposal, selectedStyle, workflowError]);

  const handleAgentSend = useCallback(async (
    message: string,
    options: { force?: boolean; replay?: boolean } = {},
  ) => {
    if (agentReplyingRef.current && !options.force) return;

    const userMessage: AgentMessage = { id: makeId(), role: "user", kind: "text", content: message };

    if (phaseRef.current === "generating" && !options.force) {
      setQueuedGenerationMessage(message);
      setChatMessages((current) => [
        ...current,
        userMessage,
        { id: makeId(), role: "system", kind: "generation-request", message, queued: true },
      ]);
      return;
    }

    const proposalResolution = resolveProposalConfirmation(
      message,
      pendingProposal,
      activeArtifact ? { deckId: activeArtifact.deckId, version: activeArtifact.version } : null,
    );
    if (proposalResolution.kind === "consumed") {
      setChatMessages((current) => [
        ...current,
        userMessage,
        { id: makeId(), role: "assistant", kind: "text", content: "刚才确认的方案已经在执行或已执行，不会重复启动。" },
      ]);
      return;
    }
    if (proposalResolution.kind === "stale") {
      setChatMessages((current) => [
        ...current,
        userMessage,
        { id: makeId(), role: "assistant", kind: "text", content: "当前演示文稿已经更新，刚才的方案基于旧版本，不能直接覆盖。我会基于当前版本重新整理。" },
      ]);
      setPendingProposal(null);
      return;
    }
    if (proposalResolution.kind === "amend") {
      setPendingProposal((current) => current ? { ...current, status: "superseded" } : null);
    }
    if (lastCancelledArtifact && requestsCancelledGenerationRetry(message)) {
      let operation: ArtifactOperation = {
        ...lastCancelledArtifact.operation,
        operationId: `operation-${makeId()}`,
      };
      let resumedArtifact: PendingArtifact = { ...lastCancelledArtifact, operation };

      setLastCancelledArtifact(null);
      setHtmlWatchdogError(null);
      setPendingArtifact(resumedArtifact);
      setPendingProposal((current) => current ? { ...current, status: "executing" } : null);
      setChatMessages((current) => [
        ...current,
        userMessage,
        {
          id: makeId(),
          role: "assistant",
          kind: "text",
          content: "好的，继续执行刚才已确认的调整，不会重新修改方向。正在恢复生成……",
        },
      ]);

      try {
        if (pendingProposal?.proposalId) {
          const resumedProposal = await persistResumedProposal(pendingProposal.proposalId, operation);
          operation = { ...operation, executionId: resumedProposal.executionId };
          resumedArtifact = { ...resumedArtifact, operation };
          setPendingArtifact(resumedArtifact);
          setPendingProposal(resumedProposal);
        }

        if (resumedArtifact.revision) {
          sendRevision({
            presentationBrief: toBriefData(resumedArtifact.brief),
            approvedOutline: resumedArtifact.outline,
            revision: resumedArtifact.revision,
            artifact: operation,
          });
          return;
        }

        sendAgentRequest(
          resumedArtifact.brief.requirements || resumedArtifact.brief.topic,
          toBriefData(resumedArtifact.brief, operation),
        );
      } catch (error) {
        setPendingArtifact(null);
        setPendingProposal((current) => current ? { ...current, status: "cancelled" } : null);
        setChatMessages((current) => [
          ...current,
          {
            id: makeId(),
            role: "assistant",
            kind: "text",
            content: error instanceof Error ? error.message : "恢复执行失败，请重新确认方案。",
            streamState: "error",
          },
        ]);
      }
      return;
    }

    if (phaseRef.current === "error") {
      // A conversational follow-up starts a new branch from the retained brief.
      // Remove failed workflow parts so they no longer keep the UI in error.
      resetWorkflow();
      setHtmlWatchdogError(null);
      setPendingArtifact(null);
      setPendingProposal((current) => current?.status === "cancelled"
        ? { ...current, status: "superseded" }
        : current);
    }

    if (proposalResolution.kind === "execute") {
      // Remove the still-actionable proposal card immediately. The semantic
      // proposal status remains pending until the server atomically starts it,
      // so a failed or cancelled confirmation can safely reveal the card again.
      setConfirmingProposalId(proposalResolution.proposal.proposalId);
    }

    const lastHistoryMessage = textHistory(chatMessages).at(-1);
    const shouldAppendUserMessage = !options.replay
      || shouldAppendReplayMessage(lastHistoryMessage, message);
    const history = shouldAppendUserMessage ? [...chatMessages, userMessage] : chatMessages;
    const visibleHistory = options.replay ? chatMessages : history;
    const assistantMessageId = makeId();
    const abortController = new AbortController();

    agentChatAbortRef.current?.abort();
    agentChatAbortRef.current = abortController;
    agentReplyingRef.current = true;
    setHtmlWatchdogError(null);
    setChatMessages([
      ...visibleHistory,
      { id: assistantMessageId, role: "assistant", kind: "text", content: "", streamState: "connecting", isStreaming: true },
    ]);
    setIsAgentReplying(true);
    setAgentProgressMessage(
      proposalResolution.kind === "execute"
        ? "正在确认方案并准备执行…"
        : "正在连接模型…",
    );

    const updateAssistantMessage = (contentUpdater: (content: string) => string, isStreaming = true) => {
      setChatMessages((current) => current.map((item) => (
        item.id === assistantMessageId && item.role === "assistant" && (item.kind === undefined || item.kind === "text")
          ? { ...item, content: contentUpdater(item.content), streamState: isStreaming ? "answering" : "done", isStreaming }
          : item
      )));
    };

    try {
      const wasGeneratingAtDispatch = !options.force && phaseRef.current === "generating";
      const artifactAtDispatch = activeArtifactRef.current;
      const artifactKeyAtDispatch = artifactAtDispatch
        ? `${artifactAtDispatch.deckId}:${artifactAtDispatch.version}`
        : null;
      const data = await sendToAgentChat(
        history,
        Boolean(generatedHtml),
        wasGeneratingAtDispatch,
        {
          signal: abortController.signal,
          onProgress: (progressMessage) => setAgentProgressMessage(
            proposalResolution.kind === "execute"
              ? "正在确认方案并准备执行…"
              : progressMessage,
          ),
          onAssistantDelta: (delta) => {
            setAgentProgressMessage(null);
            updateAssistantMessage((content) => `${content}${delta}`);
          },
          onReasoningDelta: (delta, state) => {
            setAgentProgressMessage(null);
            setChatMessages((current) => current.map((item) => (
              item.id === assistantMessageId && item.role === "assistant" && (item.kind === undefined || item.kind === "text")
                ? applyReasoningEvent(item, delta, state)
                : item
            )));
          },
          onAssistantSnapshot: (text) => {
            if (text) setAgentProgressMessage(null);
            updateAssistantMessage(() => text);
          },
          onDecision: (payload) => updateAssistantMessage(() => payload.reply ?? "", false),
        },
      );

      updateAssistantMessage(() => data.reply!, false);

      const currentArtifact = activeArtifactRef.current;
      const currentArtifactKey = currentArtifact
        ? `${currentArtifact.deckId}:${currentArtifact.version}`
        : null;
      const artifactAdvancedWhileWaiting = artifactKeyAtDispatch !== currentArtifactKey;
      const actionBecameStale = artifactAdvancedWhileWaiting
        && shouldDeferAgentAction("generating", data);
      if (
        wasGeneratingAtDispatch
        || actionBecameStale
        || shouldDeferAgentAction(phaseRef.current, data)
      ) {
        setQueuedGenerationMessage(message);
        setChatMessages((current) => [
          ...current,
          { id: makeId(), role: "system", kind: "generation-request", message, queued: true },
        ]);
        return;
      }

      if (data.proposal) {
        setPendingProposal(data.proposal);
      }

      if (data.nextAction === "execute-proposal" && data.proposal) {
        executeProposal(data.proposal);
      } else if (data.readyToGenerate && data.brief) {
        startGenerationFromBrief(data.brief, message);
      } else if (data.nextAction === "discover-styles" && data.brief) {
        await discoverStyles(data.brief);
      } else if (data.nextAction === "more-styles") {
        const discoveryBrief = data.brief ?? styleDiscoveryBrief;
        if (discoveryBrief) discoverStyles(discoveryBrief, "more");
      }
    } catch (error) {
      if (abortController.signal.aborted) return;

      const detail = error instanceof Error ? error.message : String(error);
      setChatMessages((current) => current.map((item) => (
        item.id === assistantMessageId && item.role === "assistant" && item.kind === "text"
          ? {
              ...item,
              content: `遇到了一点问题：${detail}\n\n本次处理未执行任何修改。`,
              streamState: "error",
              isStreaming: false,
              retryPrompt: message,
            }
          : item
      )));
    } finally {
      if (proposalResolution.kind === "execute") {
        setConfirmingProposalId((current) => (
          current === proposalResolution.proposal.proposalId ? null : current
        ));
      }
      if (agentChatAbortRef.current === abortController) {
        agentChatAbortRef.current = null;
        agentReplyingRef.current = false;
        setIsAgentReplying(false);
        setAgentProgressMessage(null);
      }
    }
  }, [activeArtifact, chatMessages, discoverStyles, executeProposal, generatedHtml, lastCancelledArtifact, pendingProposal, resetWorkflow, sendAgentRequest, sendRevision, sendToAgentChat, startGenerationFromBrief, styleDiscoveryBrief]);

  const handleExecuteProposal = useCallback((proposalId: string) => {
    if (!pendingProposal || pendingProposal.proposalId !== proposalId) return;
    void handleAgentSend("按此方案执行");
  }, [handleAgentSend, pendingProposal]);

  const handleQuickAction = useCallback((command: AgentQuickCommand) => {
    if (phase === "generating" || agentReplyingRef.current || isAgentReplying) return;
    if (command === "change-style" && (activeArtifact?.brief ?? brief)) {
      const source = activeArtifact?.brief ?? brief!;
      void discoverStyles({
        topic: source.topic,
        audience: source.audience,
        pageCount: source.slideCount,
        style: source.style,
        requirements: source.requirements,
        purpose: source.purpose,
        density: source.density,
      });
      return;
    }
    const action = getQuickActionDefinition(command);

    setChatMessages((current) => [
      ...current,
      { id: makeId(), role: "user", kind: "text", content: action.userText },
      { id: `quick-choice-${makeId()}`, role: "system", kind: "quick-choice", action },
    ]);
  }, [activeArtifact?.brief, brief, discoverStyles, isAgentReplying, phase]);

  const handleApplyRevision = useCallback((choice: AgentQuickActionChoice) => {
    if (phase === "generating") return;

    const started = beginRevision(choice.revision);
    setChatMessages((current) => [
      ...current,
      { id: makeId(), role: "user", kind: "text", content: choice.label },
      {
        id: makeId(),
        role: "assistant",
        kind: "text",
        content: started
          ? `已选择「${choice.label}」，正在基于当前版本生成新版本。`
          : "当前版本缺少可复用的大纲，请先重新生成演示文稿。",
      },
    ]);
  }, [beginRevision, phase]);

  const handleCancelCurrentOperation = useCallback(() => {
    if (agentChatAbortRef.current) {
      agentChatAbortRef.current.abort();
      agentChatAbortRef.current = null;
      agentReplyingRef.current = false;
      setIsAgentReplying(false);
      setAgentProgressMessage(null);
      setChatMessages((current) => current.map((message) => (
        message.role === "assistant" && message.kind === "text" && message.isStreaming
          ? stopStreamingAssistantMessage(message)
          : message
      )));
      return;
    }

    if (phase === "generating") {
      if (pendingProposal?.status === "executing") {
        persistCancelledProposal(pendingProposal);
        setPendingProposal({ ...pendingProposal, status: "cancelled" });
      }
      setLastCancelledArtifact(pendingArtifact);
      resetWorkflow();
      setPendingArtifact(null);
      setHtmlWatchdogError(null);
      setChatMessages((current) => [
        ...current,
        { id: makeId(), role: "assistant", kind: "text", content: "已停止生成，当前预览保持不变。" },
      ]);
    }
  }, [pendingArtifact, pendingProposal, phase, resetWorkflow]);

  useEffect(() => {
    if (!workflowError || pendingProposal?.status !== "executing") return;
    persistCancelledProposal(pendingProposal);
    setPendingProposal({ ...pendingProposal, status: "cancelled" });
  }, [pendingProposal, workflowError]);

  useEffect(() => {
    const data = htmlGenerationStep?.data;
    if (data?.status !== "completed" || !data.html) return;

    const artifactKey = data.artifact
      ? `${data.artifact.deckId}:${data.artifact.version}`
      : data.htmlUrl ?? `html-${data.generatedCharacters ?? data.html.length}`;
    if (publishedArtifactKeyRef.current === artifactKey) return;
    publishedArtifactKeyRef.current = artifactKey;

    const completedBrief = pendingArtifact?.brief ?? brief;
    const completedOutline = pendingArtifact?.outline.slides.length
      ? pendingArtifact.outline
      : baseOutline;
    if (completedBrief && completedOutline) {
      setActiveArtifact({
        deckId: data.artifact?.deckId ?? deckIdRef.current,
        version: data.artifact?.version ?? activeArtifact?.version ?? 1,
        html: data.html,
        htmlUrl: data.htmlUrl,
        brief: completedBrief,
        outline: completedOutline,
      });
      setBrief(completedBrief);
    }

    setPendingArtifact(null);
    setPendingProposal((current) => current?.status === "executing"
      ? { ...current, status: "consumed" }
      : current);
    setChatMessages((current) => appendCompletionMessage(current, {
      artifactId: artifactKey,
      slideCount: completedOutline?.slides.length ?? selectedSlides.length ?? outline.length,
      htmlUrl: data.htmlUrl,
      generator: data.generator,
      regenerationReason: data.regenerationReason,
    }));
  }, [activeArtifact?.version, baseOutline, brief, htmlGenerationStep?.data, outline.length, pendingArtifact, selectedSlides.length]);

  const handleGenerate = useCallback(() => {
    if (!baseOutline || selectedSlides.length === 0 || !canApproveOutline) return;
    setHtmlWatchdogError(null);
    approveOutline(toApprovedOutline(baseOutline, outline));
  }, [approveOutline, baseOutline, canApproveOutline, outline, selectedSlides.length]);

  const handleStartOver = useCallback(() => {
    agentChatAbortRef.current?.abort();
    agentChatAbortRef.current = null;
    agentReplyingRef.current = false;
    resetWorkflow();
    setHtmlWatchdogError(null);
    setBrief(null);
    setChatMessages([]);
    setIsAgentReplying(false);
    setQueuedGenerationMessage(null);
    setAgentProgressMessage(null);
    setActiveArtifact(null);
    setPendingArtifact(null);
    setLastCancelledArtifact(null);
    setPendingProposal(null);
    setStylePreviews([]);
    setSelectedStyle(null);
    setStyleDiscoveryBrief(null);
    setIsDiscoveringStyles(false);
    deckIdRef.current = `deck-${makeId()}`;
    publishedArtifactKeyRef.current = null;
  }, [resetWorkflow]);

  useEffect(() => {
    return () => {
      agentChatAbortRef.current?.abort();
    };
  }, []);

  const handleRetry = useCallback(async (kind: StudioErrorSource) => {
    clearError();
    setHtmlWatchdogError(null);

    if (kind === "html") {
      if (pendingArtifact?.revision) {
        const revision = pendingArtifact.revision;
        let retryArtifact = pendingArtifact;
        if (pendingProposal) {
          const retryOperation = {
            ...pendingArtifact.operation,
            operationId: `operation-${makeId()}`,
          };
          try {
            const resumedProposal = await persistResumedProposal(
              pendingProposal.proposalId,
              retryOperation,
            );
            retryArtifact = {
              ...pendingArtifact,
              operation: { ...retryOperation, executionId: resumedProposal.executionId },
            };
            setPendingArtifact(retryArtifact);
            setPendingProposal(resumedProposal);
          } catch (error) {
            setChatMessages((current) => [
              ...current,
              {
                id: makeId(),
                role: "assistant",
                kind: "text",
                content: error instanceof Error ? error.message : "恢复执行失败，请重新确认方案。",
                streamState: "error",
              },
            ]);
            return;
          }
        }
        sendRevision({
          presentationBrief: toBriefData(retryArtifact.brief),
          approvedOutline: retryArtifact.outline,
          revision,
          artifact: retryArtifact.operation,
        });
        return;
      }

      handleGenerate();
      return;
    }

    setBrief(null);
  }, [clearError, handleGenerate, pendingArtifact, pendingProposal, sendRevision]);

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
      void handleAgentSend(message, { force: true, replay: true });
    }, 0);
  }, [handleAgentSend, markGenerationRequestQueued, resetWorkflow, stop]);

  useEffect(() => {
    if (phase !== "previewing" || !activeArtifact || !queuedGenerationMessage) return;

    const message = queuedGenerationMessage;
    const timeout = window.setTimeout(() => {
      setQueuedGenerationMessage(null);
      void handleAgentSend(message, { force: true, replay: true });
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [activeArtifact, handleAgentSend, phase, queuedGenerationMessage]);

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

    if (shouldShowProposalCard(pendingProposal, confirmingProposalId)) {
      messages.push({
        id: `proposal-card-${pendingProposal.proposalId}`,
        role: "system",
        kind: "action-proposal",
        proposal: pendingProposal,
      });
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

    return messages;
  }, [
    canApproveOutline,
    confirmingProposalId,
    generateDisabledReason,
    outline.length,
    pendingProposal,
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
      onQuickAction={handleQuickAction}
      onApplyRevision={handleApplyRevision}
      onExecuteProposal={handleExecuteProposal}
      onCancel={handleCancelCurrentOperation}
      onGenerate={handleGenerate}
      onRetry={handleRetry}
      onQueueAfterGeneration={handleQueueAfterGeneration}
      onRestartWithMessage={handleRestartWithMessage}
      onStartOver={handleStartOver}
    />
  );

  return (
    <PresentationWorkspace
      previewContent={<PresentationPreviewPane currentStep={previewStep} generatedHtml={generatedHtml} outline={outline} outlineGeneration={outlineStep?.data} htmlGeneration={activeHtmlGenerationStepData} preservePreviewDuringGeneration={Boolean(activeArtifact && pendingArtifact)} stylePreviews={stylePreviews} selectedStyleId={selectedStyle?.id} isDiscoveringStyles={isDiscoveringStyles} styleBatch={styleBatch} remainingStyleCount={remainingStyleCount} onSelectStyle={handleSelectStyle} onMoreStyles={discoverMoreStyles} />}
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
