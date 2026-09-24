import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";

const root = process.cwd();
const skill = ".claude/skills/frontend-slides";
const templates = await readdir(path.join(skill, "bold-template-pack/templates"));
const requirements = {
  analyze: ["SKILL.md", "html-template.md", "viewport-base.css", "animation-patterns.md", "STYLE_PRESETS.md",
    ...templates.map((name) => `bold-template-pack/templates/${name}/design.md`)],
  "style-discovery": ["SKILL.md", "STYLE_PRESETS.md"],
};
for (const [route, assets] of Object.entries(requirements)) {
  const traceFile = path.join(root, `.next/server/app/api/${route}/route.js.nft.json`);
  const trace = JSON.parse(await readFile(traceFile, "utf8"));
  const files = new Set(trace.files.map((file) => path.resolve(path.dirname(traceFile), file)));
  const missing = assets.filter((asset) => !files.has(path.join(root, skill, asset)));
  assert.equal(missing.length, 0, `${route}: deployment trace is missing ${missing.join(", ")}`);
  console.log(`${route}: ${assets.length} required runtime assets traced`);
}
