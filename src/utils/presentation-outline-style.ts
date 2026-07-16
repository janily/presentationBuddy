import type { PresentationOutlineData } from "@/src/types/presentation-workflow";

export function removeOutlineVisualDirections(
  outline: PresentationOutlineData,
): PresentationOutlineData {
  return {
    ...outline,
    designGuidance: [],
    slides: outline.slides.map((slide) => ({
      ...slide,
      designSuggestion: "",
    })),
  };
}
