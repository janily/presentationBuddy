import type { PresentationOutlineData } from "@/src/types/presentation-workflow";
import { presentationOutlineSchema } from "@/src/mastra/workflows/presentation-generation-schemas";
import type { FrontendSlidesDensity, FrontendSlidesPurpose, FrontendSlidesStyleSpec } from "@/src/services/frontend-slides/style-catalog";

export interface PresentationBrief {
  sourceIds?: string[];
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
  slide: Partial<Pick<PresentationOutlineData["slides"][number], "purpose" | "keyPoints" | "designSuggestion">>,
) => [slide.purpose, ...(Array.isArray(slide.keyPoints) ? slide.keyPoints : []), slide.designSuggestion]
  .filter((value) => typeof value === "string" && value.length > 0).join(" ");

// A streamed outline can have a title and slides while slide fields are still missing.
export const getCompleteOutline = (outline: unknown): PresentationOutlineData | null => {
  const result = presentationOutlineSchema.safeParse(outline);
  return result.success ? result.data : null;
};

export const toStreamingSlideItem = (
  slide: Partial<PresentationOutlineData["slides"][number]> | null | undefined,
  index: number,
): SlideOutlineItem => {
  const title = typeof slide?.title === "string" && slide.title.trim() || `Drafting slide ${index + 1}...`;
  const keyPoints = Array.isArray(slide?.keyPoints)
    ? slide.keyPoints.filter((point): point is string => typeof point === "string" && point.length > 0)
    : [];
  const purpose = typeof slide?.purpose === "string" && slide.purpose.trim() || "Drafting purpose and key points...";
  const designSuggestion = typeof slide?.designSuggestion === "string" && slide.designSuggestion.trim() || "Choosing an appropriate visual treatment...";
  const notes = formatSlideNotes({ purpose, keyPoints, designSuggestion });

  return {
    id: `${slide?.pageNumber ?? index + 1}-${title}`,
    title,
    notes,
    selected: true,
    purpose,
    keyPoints,
    designSuggestion,
    originalNotes: notes,
  };
};

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
