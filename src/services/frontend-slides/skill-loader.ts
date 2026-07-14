import { readFile } from "node:fs/promises";
import path from "node:path";
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

function getProjectRoot() {
  let projectRoot = process.cwd();

  if (projectRoot.includes(".mastra")) {
    const mastraIndex = projectRoot.indexOf(".mastra");
    projectRoot = projectRoot.substring(0, mastraIndex).replace(/[\\/]$/, "");
  }

  return projectRoot;
}

export function resolveFrontendSlidesSkillDir() {
  return path.join(getProjectRoot(), ".claude", "skills", "frontend-slides");
}

async function readSkillFile(relativePath: string) {
  return readFile(path.join(resolveFrontendSlidesSkillDir(), relativePath), "utf8");
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

  return {
    name: styleSpec.name,
    slug: styleSpec.boldTemplate.slug,
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
