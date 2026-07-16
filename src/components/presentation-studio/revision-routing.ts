import type { FrontendSlidesStyleSpec } from "@/src/services/frontend-slides/style-catalog";
import type { RevisionSpec } from "@/src/types/presentation-workflow";

const structureChangingPatterns = [
  /(?:增加|新增|添加|补充).{0,8}(?:一|两|\d+)?.{0,4}页/i,
  /(?:删除|删掉|移除).{0,8}(?:第|页面|页)/i,
  /(?:调换|调整|重排|重新排列).{0,8}(?:顺序|页面|页)/i,
  /\b(?:add|insert|remove|delete|reorder)\b.{0,30}\b(?:slide|slides|page|pages)\b/i,
];

export function isStructureChangingRevision(message: string) {
  return structureChangingPatterns.some((pattern) => pattern.test(message));
}

export function buildFullDeckStyleRevision(
  styleName: string,
  styleSpec: FrontendSlidesStyleSpec,
): RevisionSpec {
  return {
    kind: "style",
    instruction: `Restyle the entire presentation using the selected ${styleName} visual system. Apply it to every slide and replace the previous theme's layout, typography, palette, and signature elements while preserving the approved content and slide order.`,
    style: styleName,
    styleSpec,
    requiresOutlineReview: false,
  };
}
