import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

const useInteriorWorkflow = () => {
  const { sendMessage, messages, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/analyze",
      prepareSendMessagesRequest: ({messages}) => {


        const userMessage = messages.find(message => message.)

      },
    }),
  });
};
