import z from "zod";
import { presentationRevisionRequestSchema } from "@/src/mastra/workflows/presentation-generation-schemas";

type ValidatedRevisionRequest = z.infer<typeof presentationRevisionRequestSchema>;

function resolveRevisionStyle({ presentationBrief, revision }: ValidatedRevisionRequest) {
  const currentStyle = presentationBrief.style ?? "Polished modern presentation";
  if (revision.style) return revision.style;
  if (revision.kind === "palette") {
    return currentStyle.includes(revision.instruction)
      ? currentStyle
      : `${currentStyle}. Palette revision: ${revision.instruction}`;
  }
  if (revision.palette?.length) {
    return [currentStyle, `Palette: ${revision.palette.join(", ")}`]
      .filter(Boolean)
      .join(". ");
  }
  return currentStyle;
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
    styleSpec: revision.kind === "palette" ? undefined : presentationBrief.styleSpec,
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
