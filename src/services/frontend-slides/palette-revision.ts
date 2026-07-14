import type { FrontendSlidesStyleSpec } from "./style-schema";

const namedColors: Array<[RegExp, string]> = [
  [/深蓝|navy|deep blue/i, "#123b6d"],
  [/青色|cyan|teal/i, "#16c7c7"],
  [/蓝色|blue/i, "#2563eb"],
  [/绿色|green/i, "#16a34a"],
  [/红色|red/i, "#dc2626"],
  [/橙色|orange/i, "#ea580c"],
  [/紫色|purple/i, "#7c3aed"],
  [/粉色|pink/i, "#db2777"],
  [/黄色|yellow/i, "#eab308"],
  [/黑色|black/i, "#111111"],
  [/白色|white/i, "#ffffff"],
];

export function applyPaletteRevision(
  styleSpec: FrontendSlidesStyleSpec | undefined,
  instruction: string,
) {
  if (!styleSpec) return undefined;

  const explicitHex = instruction.match(/#[0-9a-f]{6}\b/gi) ?? [];
  const named = namedColors
    .filter(([pattern]) => pattern.test(instruction))
    .map(([, color]) => color);
  const colors = [...new Set([...explicitHex.map((color) => color.toLowerCase()), ...named])];
  if (colors.length === 0) return styleSpec;

  return {
    ...styleSpec,
    palette: {
      ...styleSpec.palette,
      accent: colors[0],
      secondary: colors[1] ?? colors[0],
    },
  };
}
