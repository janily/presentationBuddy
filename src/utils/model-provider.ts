const DEFAULT_PROVIDER = "openrouter";

type ModelProviderName = "openrouter" | "openai" | "google" | "openai-compatible";

// Only strip a prefix when it duplicates the provider itself. OpenRouter model IDs
// keep their vendor prefix (e.g. "google/gemini-3-flash-preview" stays intact).
const PROVIDER_STRIPPABLE_PREFIXES: Record<ModelProviderName, string[]> = {
  openrouter: ["openrouter/"],
  openai: ["openai/"],
  google: ["google/", "google-generative-ai/"],
  "openai-compatible": [],
};

type MastraProviderModelConfig = {
  id: `${string}/${string}`;
  url?: string;
  apiKey?: string;
};

function normalizeProviderName(value: string | undefined): ModelProviderName {
  const provider = value?.trim().toLowerCase() || DEFAULT_PROVIDER;

  if (["google", "google-generative-ai", "gemini"].includes(provider)) {
    return "google";
  }

  if (["openai-compatible", "openai_compatible", "compatible"].includes(provider)) {
    return "openai-compatible";
  }

  if (provider === "grsai") {
    return "openai-compatible";
  }

  if (provider === "openai") {
    return "openai";
  }

  if (provider === "openrouter") {
    return "openrouter";
  }

  throw new Error(`Unsupported model provider: ${value}`);
}

function getProviderApiKey(provider: ModelProviderName) {
  switch (provider) {
    case "openai":
      return process.env.MODEL_API_KEY || process.env.OPENAI_API_KEY || undefined;
    case "google":
      return process.env.MODEL_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY || undefined;
    case "openai-compatible":
      return process.env.MODEL_API_KEY || process.env.OPENAI_API_KEY || undefined;
    case "openrouter":
    default:
      return process.env.MODEL_API_KEY || process.env.OPENROUTER_API_KEY || undefined;
  }
}

function getProviderBaseUrl(provider: ModelProviderName) {
  switch (provider) {
    case "openai":
      return process.env.MODEL_BASE_URL || process.env.OPENAI_BASE_URL;
    case "google":
      return process.env.MODEL_BASE_URL || process.env.GOOGLE_GENERATIVE_AI_BASE_URL;
    case "openai-compatible":
      return process.env.MODEL_BASE_URL || process.env.OPENAI_BASE_URL;
    case "openrouter":
    default:
      return process.env.MODEL_BASE_URL || process.env.OPENROUTER_BASE_URL;
  }
}

function getMastraProviderId(provider: ModelProviderName) {
  if (provider === "openai-compatible") {
    return process.env.MODEL_PROVIDER_NAME?.trim() || "openai";
  }

  return provider;
}

export function getModelId(envValue: string | undefined, defaultModel: string, provider: ModelProviderName = DEFAULT_PROVIDER) {
  const model = envValue?.trim() || defaultModel;
  const matchingPrefix = PROVIDER_STRIPPABLE_PREFIXES[provider].find((prefix) => model.startsWith(prefix));

  return matchingPrefix ? model.slice(matchingPrefix.length) : model;
}

export function getConfiguredModel(
  modelEnvValue: string | undefined,
  defaultModel: string,
  providerEnvValue?: string,
): MastraProviderModelConfig {
  const requestedProvider = providerEnvValue?.trim() || process.env.MODEL_PROVIDER;
  const provider = normalizeProviderName(requestedProvider);
  const model = getModelId(modelEnvValue, defaultModel, provider);
  const url = getProviderBaseUrl(provider);
  const configuredModel = {
    id: `${getMastraProviderId(provider)}/${model}` as const,
    url,
    apiKey: getProviderApiKey(provider),
  };

  if (process.env.NODE_ENV !== "test") {
    let baseUrlHost: string | undefined;
    try {
      baseUrlHost = url ? new URL(url).host : undefined;
    } catch {
      baseUrlHost = "invalid-url";
    }

    console.info("model.configuration_resolved", {
      requestedProvider: requestedProvider || DEFAULT_PROVIDER,
      resolvedProvider: provider,
      modelId: configuredModel.id,
      baseUrlHost,
    });
  }

  return configuredModel;
}
