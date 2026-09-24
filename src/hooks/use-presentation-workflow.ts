import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useMemo, useState } from "react";
import {
  MyUIMessage,
  AgentRequestData,
  PresentationBriefData,
  PresentationOutlineData,
  PresentationRevisionRequestData,
} from "../types/presentation-workflow";
import { getWorkflowFailureInfo } from "../utils/workflow-failure";

const getNonEmptyString = (value: unknown) => typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

const getWorkflowPayloadRunId = (workflowData: unknown) => {
  if (!workflowData || typeof workflowData !== "object") return null;

  const data = workflowData as { runId?: unknown; id?: unknown; data?: { runId?: unknown; id?: unknown } };
  return getNonEmptyString(data.runId) ?? getNonEmptyString(data.data?.runId) ?? getNonEmptyString(data.id) ?? getNonEmptyString(data.data?.id);
};

const getWorkflowSteps = (workflowData: unknown) => {
  if (!workflowData || typeof workflowData !== "object") return null;

  const data = workflowData as {
    steps?: Record<string, { suspendPayload?: Record<string, unknown> }>;
    data?: { steps?: Record<string, { suspendPayload?: Record<string, unknown> }> };
  };

  return data.steps ?? data.data?.steps ?? null;
};

export const usePresentationWorkflow = () => {
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [transport] = useState(() => new DefaultChatTransport<MyUIMessage>({
      api: "/api/analyze",
      prepareSendMessagesRequest: ({ messages }) => {
        const lastMessage = messages[messages.length - 1];

        const presentationBriefPart = lastMessage.parts.find(
          (item) => item.type === "data-presentationBrief",
        );
        const approvedOutlinePart = lastMessage.parts.find(
          (item) => item.type === "data-approvedOutline",
        );
        const workflowRunIdPart = lastMessage.parts.find(
          (item) => item.type === "data-workflowRunId",
        );
        const agentRequestPart = lastMessage.parts.find(
          (item) => item.type === "data-agentRequest",
        );
        const presentationRevisionPart = lastMessage.parts.find(
          (item) => item.type === "data-presentationRevision",
        );

        const presentationBrief = (presentationBriefPart as { data?: unknown } | undefined)?.data;
        const approvedOutline = (approvedOutlinePart as { data?: unknown } | undefined)?.data;
        const workflowRunId = getNonEmptyString((workflowRunIdPart as { data?: unknown } | undefined)?.data);
        const agentRequest = (agentRequestPart as { data?: unknown } | undefined)?.data;
        const revisionRequest = (presentationRevisionPart as { data?: unknown } | undefined)?.data;

        if (revisionRequest) {
          return {
            body: {
              revisionRequest,
            },
          };
        }

        if (approvedOutline && workflowRunId) {
          return {
            body: {
              approvedOutline,
              workflowRunId,
            },
          };
        }

        if (agentRequest) {
          return {
            body: {
              agentRequest,
            },
          };
        }

        return {
          body: {
            presentationBrief,
          },
        };
      },
    }));
  const { sendMessage, messages, setMessages, status, error, clearError, stop } = useChat<MyUIMessage>({
    transport: transport as never,
  });

  const { outlineStep, htmlGenerationStep, lastWorkflowPart, activeRunId } = useMemo(() => {
    let outlineStep: Extract<MyUIMessage["parts"][number], { type: "data-presentationOutline" }> | undefined;
    let htmlGenerationStep: Extract<MyUIMessage["parts"][number], { type: "data-presentationHtml" }> | undefined;
    let lastWorkflowPart: Extract<MyUIMessage["parts"][number], { type: "data-workflow" }> | undefined;
    let activeRunId: string | null = null;

    // One backwards pass, no flattened history copies on every streamed update.
    // A new run ID is a boundary: never combine its status with an older deck.
    scan: for (let m = messages.length - 1; m >= 0; m--) {
      if (messages[m].role !== "assistant") continue;
      const beforeMessage = { outlineStep, htmlGenerationStep, lastWorkflowPart };
      const parts = messages[m].parts;
      for (let p = parts.length - 1; p >= 0; p--) {
        const part = parts[p];
        const runId = part.type === "data-workflowRunId"
          ? getNonEmptyString(part.data)
          : part.type === "data-workflow" ? getWorkflowPayloadRunId(part.data) : null;
        if (runId && activeRunId && runId !== activeRunId) {
          // Identifiers can precede content in a message. Discard any content
          // tentatively collected from this older run while scanning backwards.
          ({ outlineStep, htmlGenerationStep, lastWorkflowPart } = beforeMessage);
          break scan;
        }
        activeRunId ??= runId;
        if (part.type === "data-presentationOutline") outlineStep ??= part;
        if (part.type === "data-presentationHtml") htmlGenerationStep ??= part;
        if (part.type === "data-workflow") lastWorkflowPart ??= part;

      }
      if (activeRunId && outlineStep && htmlGenerationStep && lastWorkflowPart) break;
    }
    return { outlineStep, htmlGenerationStep, lastWorkflowPart, activeRunId };
  }, [messages]);

  const workflowFailure = useMemo(
    () => getWorkflowFailureInfo(lastWorkflowPart?.data),
    [lastWorkflowPart],
  );

  const sendPresentationBrief = (brief: PresentationBriefData) => {
    setApprovalError(null);
    clearError();
    sendMessage({
      role: "user",
      parts: [
        {
          type: "data-presentationBrief",
          data: brief,
        },
      ],
    });
  };

  const sendAgentRequest = (message: string, context?: AgentRequestData["context"]) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    setApprovalError(null);
    clearError();
    sendMessage({
      role: "user",
      parts: [
        {
          type: "data-agentRequest",
          data: {
            message: trimmedMessage,
            context,
          },
        },
      ],
    });
  };

  const sendRevision = (revisionRequest: PresentationRevisionRequestData) => {
    setApprovalError(null);
    clearError();
    sendMessage({
      role: "user",
      parts: [
        {
          type: "data-presentationRevision",
          data: revisionRequest,
        },
      ],
    });
  };

  const suspenseData = useMemo(() => {
    if (!lastWorkflowPart) {
      return null;
    }

    const workflowData = lastWorkflowPart.data;

    const steps = getWorkflowSteps(workflowData);
    if (!steps) return null;

    const lastStep = steps["presentation-outline-suggestion-step"]
      ?? Object.values(steps).find((step) => step.suspendPayload?.suggestedOutline);

    const outline = lastStep?.suspendPayload?.suggestedOutline as
      | PresentationOutlineData
      | undefined;
    const reason = (lastStep?.suspendPayload?.reason || "") as string;

    return {
      outline,
      reason,
    };
  }, [lastWorkflowPart]);

  const approveOutline = useCallback((approvedOutline: PresentationOutlineData) => {
    if (!activeRunId) {
      setApprovalError("Workflow run ID is missing. Please regenerate the outline before creating the HTML presentation.");
      return;
    }

    setApprovalError(null);
    clearError();
    sendMessage({
      role: "user",
      parts: [
        {
          type: "data-approvedOutline",
          data: approvedOutline,
        },
        {
          type: "data-workflowRunId",
          data: activeRunId,
        },
      ],
    });
  }, [activeRunId, clearError, sendMessage]);

  const resetWorkflow = useCallback(() => {
    stop();
    clearError();
    setApprovalError(null);
    setMessages([]);
  }, [clearError, setMessages, stop]);

  return {
    sendPresentationBrief,
    sendAgentRequest,
    sendRevision,
    approveOutline,
    messages,
    status,
    error,
    clearError,
    stop,
    resetWorkflow,
    suspenseData,
    activeRunId,
    approvalError,
    canApproveOutline: Boolean(activeRunId),
    outlineStep,
    htmlGenerationStep,
    workflowFailure,
  };
};
