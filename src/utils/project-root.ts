import path from "node:path";

/** mastra dev runs in a .mastra/output subtree, not at the project root. */
export function getProjectRoot(cwd = process.cwd()) {
  const normalized = path.resolve(cwd);
  const segments = normalized.split(path.sep);
  const index = segments.indexOf(".mastra");
  return index < 0 ? normalized : segments.slice(0, index).join(path.sep) || path.parse(normalized).root;
}
