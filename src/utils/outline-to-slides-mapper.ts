import type { PresentationOutlineData, SlideOutlineData } from "@/src/types/presentation-workflow";
import type { FrontendSlidesDensity, FrontendSlidesStyleSpec } from "@/src/services/frontend-slides/style-catalog";

export type FrontendSlideLayout = "title" | "content" | "split" | "quote";

export type FrontendSlide = {
  title: string;
  content: string;
  layout: FrontendSlideLayout;
};

export type FrontendSlidesInput = {
  title: string;
  style: string;
  narrativeGoal: string;
  designGuidance: string[];
  density?: FrontendSlidesDensity;
  styleSpec?: FrontendSlidesStyleSpec;
  slides: FrontendSlide[];
};

export function mapOutlineToFrontendSlides(
  outline: PresentationOutlineData,
  style?: string,
  options?: { density?: FrontendSlidesDensity; styleSpec?: FrontendSlidesStyleSpec },
): FrontendSlidesInput {
  return {
    title: outline.title,
    style: style?.trim() || "modern professional",
    narrativeGoal: outline.narrativeGoal,
    designGuidance: outline.designGuidance,
    density: options?.density,
    styleSpec: options?.styleSpec,
    slides: outline.slides.map((slide, index) => ({
      title: slide.title,
      content: formatSlideContent(slide),
      layout: getSlideLayout(slide, index, outline.slides.length),
    })),
  };
}

function getSlideLayout(
  slide: SlideOutlineData,
  index: number,
  slideCount: number,
): FrontendSlideLayout {
  const title = slide.title.toLowerCase();

  if (index === 0 || title.includes("intro") || title.includes("cover")) {
    return "title";
  }

  if (index === slideCount - 1 || title.includes("summary") || title.includes("conclusion")) {
    return "quote";
  }

  if (slide.keyPoints.length >= 4) {
    return "split";
  }

  return "content";
}

function formatSlideContent(slide: SlideOutlineData) {
  const parts: string[] = [];

  if (slide.purpose.trim()) {
    parts.push(`Core message:\n${slide.purpose.trim()}`);
  }

  if (slide.keyPoints.length > 0) {
    parts.push([
      "Key points:",
      ...slide.keyPoints.map((point) => `- ${point}`),
    ].join("\n"));
  }

  if (slide.designSuggestion.trim()) {
    parts.push(`Design direction:\n${slide.designSuggestion.trim()}`);
  }

  return parts.join("\n\n");
}
