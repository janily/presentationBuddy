import { useChat, useCompletion } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MyUIMessage } from "../types/interior-workflow";
import { WorkflowDataPart } from "@mastra/ai-sdk";
import { useMemo } from "react";

export const useInteriorWorkflow = () => {
  const { sendMessage, messages, status } = useChat<MyUIMessage>({
    transport: new DefaultChatTransport({
      api: "/api/analyze",
      prepareSendMessagesRequest: ({ messages }) => {
        const lastMessage = messages[messages.length - 1];

        const userImage = lastMessage.parts.find(
          (item) => item.type === "data-userInitialImage",
        );
        const approvedChanges = lastMessage.parts.find(
          (item) => item.type === "data-approvedChanges",
        );
        const workflowRunId = lastMessage.parts.find(
          (item) => item.type === "data-workflowRunId",
        );

        return {
          body: {
            imageUrl: userImage,
            approvedChanges: approvedChanges,
            workflowRunId,
          },
        };
      },
    }),
  });

  const suggestionStep = useMemo(() => {
    return messages
      .flatMap((m) => m.parts)
      .find((item) => item.type === "data-improvementSuggestions");
  }, [messages]);

  const improvementStep = useMemo(() => {
    return messages
      .flatMap((m) => m.parts)
      .find((item) => item.type === "data-improvedInterior");
  }, [messages]);

  const lastWorkflowPart = messages
    .flatMap((m) => m.parts)
    .findLast((p) => p.type === "data-workflow");

  const activeRunId = lastWorkflowPart?.id;

  const sendInteriorImage = (imageUrl: string) => {
    sendMessage({
      role: "user",
      parts: [
        {
          type: "data-userInitialImage",
          data: imageUrl,
        },
      ],
    });
  };

  const suspenseData = useMemo(() => {
    const workflowPart = messages
      .flatMap((m) => m.parts)
      .findLast((p) => p.type === "data-workflow");

    if (!workflowPart) {
      return null;
    }

    const steps = workflowPart.data.data.steps;
    const lastStepKey = Object.keys(steps).pop();
    const lastStep = lastStepKey ? steps[lastStepKey] : null;

    const suggestedChanges = lastStep?.suspendPayload?.suggestedChanges || [];
    const reason = lastStep?.suspendPayload?.reason || "";

    return {
      suggestedChanges,
      reason,
    };
  }, [messages]);

  const approveChanges = (approvedChanges: string[]) => {
    sendMessage({
      role: "user",
      parts: [
        {
          type: "data-approvedChanges",
          data: approvedChanges,
        },
        {
          type: "data-workflowRunId",
          data: activeRunId as string,
        },
      ],
    });
  };

  return {
    sendInteriorImage,
    approveChanges,
    messages,
    status,
    suspenseData,
    activeRunId,
    suggestionStep,
    improvementStep,
  };
};
