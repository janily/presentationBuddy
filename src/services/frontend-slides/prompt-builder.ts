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

${context.boldTemplateDesign ? `Selected bold template design recipe (NON-NEGOTIABLE):
Name: ${context.boldTemplateDesign.name}
Slug: ${context.boldTemplateDesign.slug}
Source: frontend-slides/${context.boldTemplateDesign.path}

Use this design.md as the final deck's style recipe. Preserve its fonts, palette, decorative vocabulary, spacing rhythm, and component grammar, translated into the fixed 1920x1080 frontend-slides stage. Do not copy demo content from the template.

=== frontend-slides/${context.boldTemplateDesign.path} ===
${context.boldTemplateDesign.content}` : ""}

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
- Every real slide root must include an exact whitespace-delimited \`slide\` class token and use .active/.visible visibility rules.
- The whole document must contain exactly ${input.slides.length} elements whose class list contains the exact \`slide\` token. Helper classes such as \`slide-content\` or \`slide-number\` do not count as slide roots.
- Do not use display:none/display:block for slide switching.
- Include keyboard navigation and reduced-motion support.
- Generate exactly ${input.slides.length} real slides matching the approved outline: no missing, merged, or extra slides.
- Reuse shared CSS classes and keep markup compact so the response can include every slide.
- Do not stop, summarize, or close the document until all ${input.slides.length} .slide elements have been written.
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

export function buildFrontendSlidesRepairPrompt(
  input: FrontendSlidesInput,
  context: FrontendSlidesFinalContext,
  failure: string,
) {
  return `The previous frontend-slides generation attempt failed before producing valid output: ${failure}

Regenerate the presentation from the approved outline. This is a full regeneration, not a patch and not a summary. Keep the HTML compact, write exactly ${input.slides.length} complete slide roots in outline order, then include navigation JavaScript and close the HTML document. A slide root is counted only when its class list contains the exact whitespace-delimited token \`slide\`; names such as \`slide-content\` and \`slide-number\` are helper classes, not additional slides.

${buildFrontendSlidesMastraPrompt(input, context)}`;
}
