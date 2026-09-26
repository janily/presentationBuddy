import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadFrontendSlidesFinalContext } from "./skill-loader";
import { getFrontendSlideStyle } from "./style-catalog";

let fixtureRoot: string;
beforeEach(async () => {
  fixtureRoot = await mkdtemp(path.join(tmpdir(), "presentation-skill-test-"));
  const skillDir = path.join(fixtureRoot, ".claude/skills/frontend-slides");
  await mkdir(path.join(skillDir, "bold-template-pack/templates/vellum"), { recursive: true });
  await Promise.all(["SKILL.md", "html-template.md", "viewport-base.css", "animation-patterns.md", "STYLE_PRESETS.md", "bold-template-pack/templates/vellum/design.md"].map((file) => writeFile(path.join(skillDir, file), `Fixture: ${file}`)));
  await writeFile(path.join(fixtureRoot, "private-fixture.txt"), "This must never reach a model prompt");
  vi.spyOn(process, "cwd").mockReturnValue(fixtureRoot);
});
afterEach(async () => { vi.restoreAllMocks(); await rm(fixtureRoot, { recursive: true, force: true }); });

describe("frontend-slides file boundary", () => {
  it("loads the selected template inside the skill package", async () => {
    const context = await loadFrontendSlidesFinalContext(getFrontendSlideStyle("bold-template-vellum"));
    expect(context.boldTemplateDesign?.content).toBe("Fixture: bold-template-pack/templates/vellum/design.md");
  });

  it.each(["relative", "absolute"])("rejects a %s path outside the skill before it can enter the prompt", async (kind) => {
    const style = getFrontendSlideStyle("bold-template-vellum");
    if (!style?.boldTemplate) throw new Error("Missing template fixture");
    const designMd = kind === "relative" ? "../../../private-fixture.txt" : path.join(fixtureRoot, "private-fixture.txt");
    await expect(loadFrontendSlidesFinalContext({
      ...style, boldTemplate: { ...style.boldTemplate, designMd },
    })).rejects.toThrow(/outside the frontend-slides skill directory/);
  });
});
