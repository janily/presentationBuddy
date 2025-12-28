import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { MyUIMessage } from "../types/interior-workflow";
import { useMemo } from "react";

export const useInteriorWorkflow = () => {
  const { sendMessage, messages, status } = useChat<MyUIMessage>({
    transport: new DefaultChatTransport({
      api: "/api/analyze",
      prepareSendMessagesRequest: ({ messages }) => {
        const lastMessage = messages[messages.length - 1];

        const userImagePart = lastMessage.parts.find(
          (item) => item.type === "data-userInitialImage",
        );
        const approvedChangesPart = lastMessage.parts.find(
          (item) => item.type === "data-approvedChanges",
        );
        const workflowRunIdPart = lastMessage.parts.find(
          (item) => item.type === "data-workflowRunId",
        );

        // Extract actual data values from the parts
        const imageUrl = userImagePart?.data;
        const approvedChanges = approvedChangesPart?.data;
        const workflowRunId = workflowRunIdPart?.data;

        return {
          body: {
            imageUrl,
            approvedChanges,
            workflowRunId,
          },
        };
      },
    }),
  });

  const suggestionStep = useMemo(() => {
    return messages
      .flatMap((m) => m.parts)
      .findLast((item) => item.type === "data-suggestions");
  }, [messages]);

  const improvementStep = useMemo(() => {
    return messages
      .flatMap((m) => m.parts)
      .findLast((item) => item.type === "data-improvedInterior");
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
    if (!lastWorkflowPart) {
      return null;
    }

    const workflowData = lastWorkflowPart.data;

    const steps = workflowData?.data?.steps;
    if (!steps) return null;

    const lastStepKey = Object.keys(steps).pop();
    const lastStep = lastStepKey ? steps[lastStepKey] : null;

    const suggestedChanges = lastStep?.suspendPayload?.suggestedChanges || [];
    const reason = lastStep?.suspendPayload?.reason || "";

    return {
      suggestedChanges,
      reason,
    };
  }, [lastWorkflowPart]);

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
