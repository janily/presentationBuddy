import { afterEach, describe, expect, it, vi } from "vitest";
import { getConfiguredModel } from "./model-provider";

describe("getConfiguredModel", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("prefers the agent-specific provider over the global provider", () => {
    vi.stubEnv("MODEL_PROVIDER", "openrouter");

    expect(getConfiguredModel("gpt-4.1-mini", "fallback", "openai").id).toBe("openai/gpt-4.1-mini");
  });

  it("falls back to the global provider when no agent-specific provider is set", () => {
    vi.stubEnv("MODEL_PROVIDER", "google");

    expect(getConfiguredModel("google/gemini-2.5-flash", "fallback").id).toBe("google/gemini-2.5-flash");
  });

  it("treats grsai as an explicit OpenAI-compatible alias", () => {
    vi.stubEnv("MODEL_PROVIDER", "grsai");
    vi.stubEnv("MODEL_BASE_URL", "https://grsaiapi.com/v1");

    const model = getConfiguredModel("gemini-3.5-flash", "fallback");

    expect(model.id).toBe("openai/gemini-3.5-flash");
    expect(model.url).toBe("https://grsaiapi.com/v1");
  });

  it("fails fast for unknown providers", () => {
    vi.stubEnv("MODEL_PROVIDER", "typo-provider");

    expect(() => getConfiguredModel(undefined, "fallback")).toThrow(/Unsupported model provider/i);
  });
});
