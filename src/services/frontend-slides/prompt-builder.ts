import type { FrontendSlidesInput } from "@/src/utils/outline-to-slides-mapper";
import type { FrontendSlidesFinalContext } from "./skill-loader";

export function buildFrontendSlidesMastraPrompt(
  input: FrontendSlidesInput,
  context: FrontendSlidesFinalContext,
) {
  const slides = input.slides
    .map((slide, index) => {
      return [
        `Slide ${index + 1}: ${slide.title}`,
        `Layout hint: ${slide.layout}`,
        slide.content,
      ].join("\n");
    })
    .join("\n\n---\n\n");

  return `Generate a complete standalone HTML presentation from this approved outline.

You are replacing a Claude Agent SDK skill call inside a Mastra workflow. Use the frontend-slides skill content below as the design and implementation contract. This is a headless server-side generation task: do not ask follow-up questions, do not create separate style previews, and do not mention internal workflow details.

Return only one complete HTML document, starting with <!doctype html> or <html>. Do not wrap it in Markdown fences.

Presentation title: ${input.title}
Narrative goal: ${input.narrativeGoal}
Requested style: ${input.style}
Content density: ${input.density ?? "speaker-led"}
Required slide count: ${input.slides.length}

${input.styleSpec ? `Selected style contract (NON-NEGOTIABLE):
${JSON.stringify(input.styleSpec, null, 2)}

Preserve this contract's typography, palette, layout grammar, signature elements, and visual rhythm across every slide. Do not substitute another preset or generic theme.` : "No visual style has been selected; infer a distinctive custom system from the brief."}

${input.revisionInstruction ? `Confirmed revision (NON-NEGOTIABLE):
${input.revisionInstruction}
${input.revisionTargetSlides?.length ? `Apply it specifically to slide(s): ${input.revisionTargetSlides.join(", ")}.` : "Apply it to the relevant slides only."}
Preserve the approved outline and every unaffected slide. Do not reinterpret this content revision as a request to change the visual style.` : ""}

Design guidance:
${input.designGuidance.map((item) => `- ${item}`).join("\n") || "- Create a refined, presentation-ready visual system."}

Approved outline:
${slides}

Non-negotiable output requirements:
- Single self-contained HTML file with all CSS and JavaScript inline.
- Every slide is authored inside a fixed 1920x1080 stage.
- Include the full viewport-base.css behavior in the style block.
- Use .slide elements and .active/.visible visibility rules.
- Do not use display:none/display:block for slide switching.
- Include keyboard navigation and reduced-motion support.
- Generate at least ${input.slides.length} real slides matching the approved outline.
- Use distinctive typography, color, motion, and layout. Avoid generic AI-looking templates.
- Do not render internal labels such as "preview", "template", "style option", or file paths on slides.
- Apply the ${input.density ?? "speaker-led"} content-density rules from frontend-slides.

=== frontend-slides/SKILL.md ===
${context.skill}

=== frontend-slides/html-template.md ===
${context.htmlTemplate}

=== frontend-slides/viewport-base.css ===
${context.viewportBaseCss}

=== frontend-slides/animation-patterns.md ===
${context.animationPatterns}
${context.stylePresets ? `\n=== frontend-slides/STYLE_PRESETS.md ===\n${context.stylePresets}` : ""}
`;
}
