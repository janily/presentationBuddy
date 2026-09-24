import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FrontendSlidesStyleSpec } from "./style-schema";

const mocks = vi.hoisted(() => ({ readFile: vi.fn() }));
vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile }));

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
  mocks.readFile.mockReset().mockImplementation(async (file: string) => `contents:${file}`);
  vi.spyOn(process, "cwd").mockReturnValue("/repo");
});

function boldStyle(designMd: string): FrontendSlidesStyleSpec {
  return {
    id: "bold-template-test", name: "Test", source: "frontend-slides-bold-template", vibe: "bold", layout: "grid",
    typography: { display: "Arial", body: "Arial" },
    palette: { background: "#fff", surface: "#eee", text: "#111", accent: "#f00", secondary: "#00f" },
    signatureElements: [], boldTemplate: {
      slug: "test", tagline: "", mood: [], tone: [], formality: "", density: "", scheme: "", bestFor: "", avoidFor: "",
      previewMd: "bold-template-pack/templates/test/preview.md", designMd,
    },
  };
}

describe("bundled skill loading", () => {
  it.each(["../../../../.env.local", "/etc/passwd", "bold-template-pack/templates/../secret/design.md", "SKILL.md", "bold-template-pack\\templates\\test\\design.md"])("rejects untrusted design path %s", async (designMd) => {
    const { loadFrontendSlidesFinalContext } = await import("./skill-loader");
    await expect(loadFrontendSlidesFinalContext(boldStyle(designMd))).rejects.toThrow(/template.*path|path.*template/i);
    expect(mocks.readFile.mock.calls.some(([file]) => file.includes(".env.local") || file.includes("passwd"))).toBe(false);
  });

  it("deduplicates concurrent immutable bundled file reads", async () => {
    const { loadFrontendSlidesFinalContext } = await import("./skill-loader");
    const style = boldStyle("bold-template-pack/templates/test/design.md");
    const [first, second] = await Promise.all([loadFrontendSlidesFinalContext(style), loadFrontendSlidesFinalContext(style)]);
    expect(first).toEqual(second);
    expect(mocks.readFile).toHaveBeenCalledTimes(6);
  });

  it("does not poison subsequent requests after a failed read", async () => {
    const { loadFrontendSlidesDiscoveryContext } = await import("./skill-loader");
    mocks.readFile.mockRejectedValueOnce(new Error("temporary IO failure"));
    await expect(loadFrontendSlidesDiscoveryContext()).rejects.toThrow("temporary IO failure");
    await expect(loadFrontendSlidesDiscoveryContext()).resolves.toHaveProperty("skill");
  });

  it("treats .mastra as a directory segment, not part of a project name", async () => {
    const { resolveFrontendSlidesSkillDir } = await import("./skill-loader");
    vi.spyOn(process, "cwd").mockReturnValue("/projects/my.mastra-app");
    expect(resolveFrontendSlidesSkillDir()).toBe("/projects/my.mastra-app/.claude/skills/frontend-slides");
    vi.spyOn(process, "cwd").mockReturnValue("/projects/app/.mastra/output");
    expect(resolveFrontendSlidesSkillDir()).toBe("/projects/app/.claude/skills/frontend-slides");
  });
});
