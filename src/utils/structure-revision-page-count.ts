export const MIN_PRESENTATION_SLIDE_COUNT = 3;

const chineseDigitValues: Record<string, number> = {
  零: 0,
  一: 1,
  两: 2,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

function parseQuantity(value: string) {
  if (/^\d+$/.test(value)) return Number(value);
  if (value === "十") return 10;
  if (value.includes("十")) {
    const [tens, ones] = value.split("十");
    return (tens ? chineseDigitValues[tens] ?? 0 : 1) * 10
      + (ones ? chineseDigitValues[ones] ?? 0 : 0);
  }
  return chineseDigitValues[value] ?? 0;
}

function extractSlideDelta(instruction: string, verbs: string) {
  const normalized = instruction.replace(/第\s+(?=[一二两三四五六七八九十\d])/g, "第");
  const operationPattern = new RegExp(
    `(?:${verbs})[^\n。；;,.!?]{0,40}?(?:页面|幻灯片|页|slides?|pages?)`,
    "gi",
  );
  const operations = normalized.match(operationPattern) ?? [];

  return operations.reduce((total, operation) => {
    const quantitySource = operation.replace(
      /第\s*(?:\d+|[一二两三四五六七八九十]+)\s*(?:页面|幻灯片|页|slides?|pages?)/gi,
      "",
    );
    const quantityMatch = quantitySource.match(
      /(?<!第)(\d+|[一二两三四五六七八九十]+)(?:个|张)?[^\n。；;,.!?]{0,12}?(?:页面|幻灯片|页|slides?|pages?)/i,
    );
    const quantity = quantityMatch ? parseQuantity(quantityMatch[1]) : 1;
    return total + Math.max(1, quantity);
  }, 0);
}

export function resolveStructureRevisionPageCount(currentCount: number, instruction: string) {
  const additions = extractSlideDelta(instruction, "增加|新增|添加|插入|补充|add|insert");
  const removals = extractSlideDelta(instruction, "删除|删掉|移除|去掉|remove|delete");

  return Math.max(MIN_PRESENTATION_SLIDE_COUNT, currentCount + additions - removals);
}
