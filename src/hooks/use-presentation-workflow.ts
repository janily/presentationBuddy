import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useMemo } from "react";
import {
  MyUIMessage,
  PresentationBriefData,
} from "../types/presentation-workflow";

export const usePresentationWorkflow = () => {
  const { sendMessage, messages, status } = useChat<MyUIMessage>({
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

        const presentationBrief = presentationBriefPart?.data;
        const approvedOutline = approvedOutlinePart?.data;
        const workflowRunId = workflowRunIdPart?.data;

        return {
          body: {
            presentationBrief,
            approvedOutline,
            workflowRunId,
          },
        };
      },
    }),
  });

  const outlineStep = useMemo(() => {
    return messages
      .flatMap((m) => m.parts)
      .findLast((item) => item.type === "data-outlineSuggestions");
  }, [messages]);

  const htmlGenerationStep = useMemo(() => {
    return messages
      .flatMap((m) => m.parts)
      .findLast((item) => item.type === "data-generatedPresentation");
  }, [messages]);

  const lastWorkflowPart = messages
    .flatMap((m) => m.parts)
    .findLast((p) => p.type === "data-workflow");

  const activeRunId = useMemo(() => {
    if (!lastWorkflowPart) {
      return null;
    }

    return lastWorkflowPart.id;
  }, [lastWorkflowPart]);

  const sendPresentationBrief = (brief: PresentationBriefData) => {
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

    const steps = workflowData?.data?.steps;
    if (!steps) return null;

    const lastStepKey = Object.keys(steps).pop();
    const lastStep = lastStepKey ? steps[lastStepKey] : null;

    const outline = (lastStep?.suspendPayload?.outline || []) as string[];
    const reason = (lastStep?.suspendPayload?.reason || "") as string;

    return {
      outline,
      reason,
    };
  }, [lastWorkflowPart]);

  const approveOutline = (approvedOutline: string[]) => {
    sendMessage({
      role: "user",
      parts: [
        {
          type: "data-approvedOutline",
          data: approvedOutline,
        },
        {
          type: "data-workflowRunId",
          data: activeRunId as string,
        },
      ],
    });
  };

  return {
    sendPresentationBrief,
    approveOutline,
    messages,
    status,
    suspenseData,
    activeRunId,
    outlineStep,
    htmlGenerationStep,
  };
};
