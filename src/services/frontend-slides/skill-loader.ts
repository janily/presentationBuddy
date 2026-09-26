import { readFile } from "node:fs/promises";
import path from "node:path";
import { getProjectRoot } from "@/src/utils/project-root";
import type { FrontendSlidesStyleSpec } from "./style-schema";

export type FrontendSlidesFinalContext = {
  skill: string;
  htmlTemplate: string;
  viewportBaseCss: string;
  animationPatterns: string;
  stylePresets?: string;
  boldTemplateDesign?: {
    name: string;
    slug: string;
    path: string;
    content: string;
  };
};

export type FrontendSlidesDiscoveryContext = {
  skill: string;
  stylePresets: string;
};

export function resolveFrontendSlidesSkillDir() {
  return path.join(getProjectRoot(), ".claude", "skills", "frontend-slides");
}

const fileCache = new Map<string, Promise<string>>();
const baseFiles = new Set(["SKILL.md", "html-template.md", "viewport-base.css", "animation-patterns.md", "STYLE_PRESETS.md"]);

function readSkillFile(relativePath: string) {
  if (!baseFiles.has(relativePath) && !/^bold-template-pack\/templates\/[a-z0-9]+(?:-[a-z0-9]+)*\/design\.md$/.test(relativePath)) {
    throw new Error("Invalid bundled template path");
  }
  const fullPath = path.join(resolveFrontendSlidesSkillDir(), relativePath);
  // Production assets are immutable. Preserve live skill edits during dev.
  if (process.env.NODE_ENV === "development") return readFile(fullPath, "utf8");
  const cached = fileCache.get(fullPath);
  if (cached) return cached;
  const pending = readFile(fullPath, "utf8").catch((error) => {
    fileCache.delete(fullPath);
    throw error;
  });
  fileCache.set(fullPath, pending);
  return pending;
}

async function readOptionalSkillFile(relativePath: string) {
  try {
    return await readSkillFile(relativePath);
  } catch {
    return undefined;
  }
}

async function loadSelectedBoldTemplateDesign(styleSpec?: FrontendSlidesStyleSpec) {
  if (styleSpec?.source !== "frontend-slides-bold-template" || !styleSpec.boldTemplate?.designMd) {
    return undefined;
  }

  const { slug, designMd } = styleSpec.boldTemplate;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || designMd !== `bold-template-pack/templates/${slug}/design.md`) {
    throw new Error("Invalid bundled template path");
  }

  return {
    name: styleSpec.name,
    slug,
    path: styleSpec.boldTemplate.designMd,
    content: await readSkillFile(styleSpec.boldTemplate.designMd),
  };
}

export async function loadFrontendSlidesFinalContext(styleSpec?: FrontendSlidesStyleSpec): Promise<FrontendSlidesFinalContext> {
  const [skill, htmlTemplate, viewportBaseCss, animationPatterns, stylePresets] = await Promise.all([
    readSkillFile("SKILL.md"),
    readSkillFile("html-template.md"),
    readSkillFile("viewport-base.css"),
    readSkillFile("animation-patterns.md"),
    readOptionalSkillFile("STYLE_PRESETS.md"),
  ]);
  const boldTemplateDesign = await loadSelectedBoldTemplateDesign(styleSpec);

  return {
    skill,
    htmlTemplate,
    viewportBaseCss,
    animationPatterns,
    stylePresets,
    boldTemplateDesign,
  };
}

export async function loadFrontendSlidesDiscoveryContext(): Promise<FrontendSlidesDiscoveryContext> {
  const [skill, stylePresets] = await Promise.all([
    readSkillFile("SKILL.md"),
    readSkillFile("STYLE_PRESETS.md"),
  ]);

  return { skill, stylePresets };
}
