import z from "zod";
import { presentationRevisionRequestSchema } from "@/src/mastra/workflows/presentation-generation-schemas";

type ValidatedRevisionRequest = z.infer<typeof presentationRevisionRequestSchema>;

function resolveRevisionStyle({ presentationBrief, revision }: ValidatedRevisionRequest) {
  if (revision.style) return revision.style;
  if (revision.palette?.length) {
    return [presentationBrief.style, `Palette: ${revision.palette.join(", ")}`]
      .filter(Boolean)
      .join(". ");
  }
  return presentationBrief.style;
}

export function buildRevisionWorkflowPlan(request: ValidatedRevisionRequest) {
  const { presentationBrief, approvedOutline, revision, artifact } = request;
  const commonInput = {
    ...presentationBrief,
    style: resolveRevisionStyle(request),
    requirements: [
      presentationBrief.requirements,
      `Revision request (${revision.kind}): ${revision.instruction}`,
    ].filter(Boolean).join("\n\n"),
    artifact,
  };

  if (revision.requiresOutlineReview) {
    return {
      workflowKind: "outline-revision" as const,
      inputData: {
        ...commonInput,
        autoApproveOutline: true as const,
        revision,
        outlineRevisionContext: {
          instruction: revision.instruction,
          targetSlides: revision.targetSlides,
          currentOutline: approvedOutline,
        },
      },
    };
  }

  return {
    workflowKind: "html-revision" as const,
    inputData: {
      ...commonInput,
      outline: approvedOutline,
      revision,
    },
  };
}
