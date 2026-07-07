import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const OPENROUTER_MODEL_PREFIX = "openrouter/";

export const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || "",
});

export function getOpenRouterModelId(envValue: string | undefined, defaultModel: string) {
  const model = envValue?.trim() || defaultModel;

  return model.startsWith(OPENROUTER_MODEL_PREFIX) ? model.slice(OPENROUTER_MODEL_PREFIX.length) : model;
}
