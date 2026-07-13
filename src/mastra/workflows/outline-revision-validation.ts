import type { PresentationOutlineData } from "@/src/types/presentation-workflow";

type OutlineRevisionValidationInput = {
  currentOutline: PresentationOutlineData;
  revisedOutline: PresentationOutlineData;
  expectedSlideCount: number;
  targetSlides?: number[];
};

export function validateOutlineRevisionResult({
  currentOutline,
  revisedOutline,
  expectedSlideCount,
  targetSlides,
}: OutlineRevisionValidationInput) {
  if (revisedOutline.slides.length !== expectedSlideCount) {
    throw new Error(
      `Outline revision returned ${revisedOutline.slides.length} slide(s), expected exactly ${expectedSlideCount}`,
    );
  }

  revisedOutline.slides.forEach((slide, index) => {
    if (slide.pageNumber !== index + 1) {
      throw new Error(`Outline revision page numbers must be sequential from 1; slide ${index + 1} is numbered ${slide.pageNumber}`);
    }
  });

  if (targetSlides?.some((pageNumber) => pageNumber > expectedSlideCount)) {
    throw new Error("Outline revision targets a slide outside the revised presentation");
  }

  if (JSON.stringify(currentOutline) === JSON.stringify(revisedOutline)) {
    throw new Error("Outline revision did not change the approved outline");
  }
}
