import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useMemo, useState } from "react";
import {
  MyUIMessage,
  PresentationBriefData,
  PresentationOutlineData,
} from "../types/presentation-workflow";

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
  const { sendMessage, messages, status, error, clearError } = useChat<MyUIMessage>({
    transport: new DefaultChatTransport({
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

        const presentationBrief = (presentationBriefPart as { data?: unknown } | undefined)?.data;
        const approvedOutline = (approvedOutlinePart as { data?: unknown } | undefined)?.data;
        const workflowRunId = getNonEmptyString((workflowRunIdPart as { data?: unknown } | undefined)?.data);

        if (approvedOutline && workflowRunId) {
          return {
            body: {
              approvedOutline,
              workflowRunId,
            },
          };
        }

        return {
          body: {
            presentationBrief,
          },
        };
      },
    }) as never,
  });

  const outlineStep = useMemo(() => {
    return messages
      .flatMap((m) => m.parts)
      .findLast((item) => item.type === "data-presentationOutline");
  }, [messages]);

  const htmlGenerationStep = useMemo(() => {
    return messages
      .flatMap((m) => m.parts)
      .findLast((item) => item.type === "data-presentationHtml");
  }, [messages]);

  const lastWorkflowPart = messages
    .flatMap((m) => m.parts)
    .findLast((p) => p.type === "data-workflow");

  const lastWorkflowRunIdPart = messages
    .flatMap((m) => m.parts)
    .findLast((p) => p.type === "data-workflowRunId");

  const activeRunId = useMemo(() => {
    const workflowPayloadRunId = getWorkflowPayloadRunId(lastWorkflowPart?.data);
    if (workflowPayloadRunId) return workflowPayloadRunId;

    return getNonEmptyString(lastWorkflowRunIdPart?.data);
  }, [lastWorkflowPart, lastWorkflowRunIdPart]);

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

  const suspenseData = useMemo(() => {
    if (!lastWorkflowPart) {
      return null;
    }

    const workflowData = lastWorkflowPart.data;

    const steps = getWorkflowSteps(workflowData);
    if (!steps) return null;

    const lastStepKey = Object.keys(steps).pop();
    const lastStep = lastStepKey ? steps[lastStepKey] : null;

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

  return {
    sendPresentationBrief,
    approveOutline,
    messages,
    status,
    error,
    clearError,
    suspenseData,
    activeRunId,
    approvalError,
    canApproveOutline: Boolean(activeRunId),
    outlineStep,
    htmlGenerationStep,
  };
};
