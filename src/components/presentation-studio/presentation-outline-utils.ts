import type { PresentationOutlineData } from "@/src/types/presentation-workflow";
import type { FrontendSlidesDensity, FrontendSlidesPurpose, FrontendSlidesStyleSpec } from "@/src/services/frontend-slides/style-catalog";

export interface PresentationBrief {
  topic: string;
  audience: string;
  slideCount: number;
  style: string;
  requirements: string;
  purpose?: FrontendSlidesPurpose;
  density?: FrontendSlidesDensity;
  contentReadiness?: "ready" | "rough-notes" | "topic-only";
  styleSpec?: FrontendSlidesStyleSpec;
}

export interface SlideOutlineItem {
  id: string;
  title: string;
  notes: string;
  selected: boolean;
  purpose?: string;
  keyPoints?: string[];
  designSuggestion?: string;
  originalNotes?: string;
}

export const emptyOutline = (brief: PresentationBrief): PresentationOutlineData => ({
  title: brief.topic,
  narrativeGoal: `Create a ${brief.style} presentation for ${brief.audience}.`,
  sections: [],
  slides: [],
  designGuidance: [],
});

export const formatSlideNotes = (
  slide: Pick<PresentationOutlineData["slides"][number], "purpose" | "keyPoints" | "designSuggestion">,
) => [slide.purpose, ...slide.keyPoints, slide.designSuggestion].filter(Boolean).join(" ");

export const toSlideItem = (slide: PresentationOutlineData["slides"][number]): SlideOutlineItem => {
  const notes = formatSlideNotes(slide);

  return {
    id: `${slide.pageNumber}-${slide.title}`,
    title: slide.title,
    notes,
    selected: true,
    purpose: slide.purpose,
    keyPoints: [...slide.keyPoints],
    designSuggestion: slide.designSuggestion,
    originalNotes: notes,
  };
};

export const toApprovedOutline = (
  baseOutline: PresentationOutlineData,
  items: SlideOutlineItem[],
): PresentationOutlineData => ({
  ...baseOutline,
  slides: items
    .filter((item) => item.selected)
    .map((item, index) => {
      const notesWereEdited = item.originalNotes !== undefined && item.notes !== item.originalNotes;
      const baseKeyPoints = item.keyPoints?.length ? [...item.keyPoints] : [item.notes].filter(Boolean);
      const keyPoints = notesWereEdited && item.notes ? [...baseKeyPoints, `User notes: ${item.notes}`] : baseKeyPoints;

      return {
        pageNumber: index + 1,
        title: item.title,
        purpose: item.purpose || item.notes,
        keyPoints,
        designSuggestion:
          item.designSuggestion || baseOutline.designGuidance.join(" ") || "Use a polished, readable slide layout.",
      };
    }),
});
