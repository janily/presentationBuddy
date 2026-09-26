import { afterEach, describe, expect, it, vi } from "vitest";
import { getConfiguredModel, usesJsonPromptInjection } from "./model-provider";

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

  it.each(["grsai", "grsaiapi", " GRSAIAPI "])("treats %s as an explicit OpenAI-compatible alias", (provider) => {
    vi.stubEnv("MODEL_PROVIDER", provider);
    vi.stubEnv("MODEL_PROVIDER_NAME", "");
    vi.stubEnv("MODEL_API_KEY", "test-grsai-key");
    vi.stubEnv("MODEL_BASE_URL", "https://grsaiapi.com/v1");

    const model = getConfiguredModel("gemini-3.5-flash", "fallback");

    expect(model.id).toBe("openai/gemini-3.5-flash");
    expect(model.url).toBe("https://grsaiapi.com/v1");
    expect(model.apiKey).toBe("test-grsai-key");
  });

  it("supports grsaiapi as an agent-specific provider override", () => {
    vi.stubEnv("MODEL_PROVIDER", "openrouter");
    vi.stubEnv("MODEL_PROVIDER_NAME", "");
    vi.stubEnv("MODEL_BASE_URL", "https://grsaiapi.com/v1");
    vi.stubEnv("MODEL_API_KEY", "test-grsai-key");

    expect(getConfiguredModel("gemini-3.5-flash", "fallback", "grsaiapi")).toEqual({
      id: "openai/gemini-3.5-flash",
      url: "https://grsaiapi.com/v1",
      apiKey: "test-grsai-key",
    });
  });

  it("fails fast for unknown providers", () => {
    vi.stubEnv("MODEL_PROVIDER", "typo-provider");

    expect(() => getConfiguredModel(undefined, "fallback")).toThrow(/Unsupported model provider/i);
  });

  it.each(["grsai", "grsaiapi"])("adds the documented API path for %s when only a host is configured", (provider) => {
    vi.stubEnv("MODEL_PROVIDER", provider);
    vi.stubEnv("MODEL_BASE_URL", "https://grsaiapi.com/");
    expect(getConfiguredModel("gemini-3.1-pro", "fallback").url).toBe("https://grsaiapi.com/v1");
  });

  it("preserves an explicit compatible API path", () => {
    vi.stubEnv("MODEL_PROVIDER", "grsaiapi");
    vi.stubEnv("MODEL_BASE_URL", "https://proxy.example/custom/v1");
    expect(getConfiguredModel("gemini-3.1-pro", "fallback").url).toBe("https://proxy.example/custom/v1");
  });

  it("uses JSON prompt injection for compatible providers and honors agent overrides", () => {
    vi.stubEnv("MODEL_PROVIDER", "grsaiapi");
    expect(usesJsonPromptInjection()).toBe(true);
    expect(usesJsonPromptInjection("grsai")).toBe(true);
    expect(usesJsonPromptInjection("openai-compatible")).toBe(true);
    expect(usesJsonPromptInjection("openrouter")).toBe(false);
    expect(usesJsonPromptInjection("google")).toBe(false);
  });
});
