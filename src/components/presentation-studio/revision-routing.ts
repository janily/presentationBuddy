const structureChangingPatterns = [
  /(?:增加|新增|添加|补充).{0,8}(?:一|两|\d+)?.{0,4}页/i,
  /(?:删除|删掉|移除).{0,8}(?:第|页面|页)/i,
  /(?:调换|调整|重排|重新排列).{0,8}(?:顺序|页面|页)/i,
  /\b(?:add|insert|remove|delete|reorder)\b.{0,30}\b(?:slide|slides|page|pages)\b/i,
];

export function isStructureChangingRevision(message: string) {
  return structureChangingPatterns.some((pattern) => pattern.test(message));
}
