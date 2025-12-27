import { UIMessage } from "ai";

type MyUIMessage = UIMessage<
  unknown,
  { userInitialImage: string; approvedSuggestions?: string[] }
>;
