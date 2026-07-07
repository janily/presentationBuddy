import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

function resolveProjectRoot(): string {
  let projectRoot = process.cwd();

  if (projectRoot.includes(".mastra")) {
    const mastraIndex = projectRoot.indexOf(".mastra");
    projectRoot = projectRoot.substring(0, mastraIndex).replace(/\/$/, "");
  }

  return projectRoot;
}

function sanitizeHtmlFileName(fileName?: string): string {
  if (!fileName) {
    return `${randomUUID()}.html`;
  }

  const normalizedName = fileName.endsWith(".html") ? fileName : `${fileName}.html`;
  const safeName = path.basename(normalizedName).replace(/[^a-zA-Z0-9._-]/g, "-");

  return safeName || `${randomUUID()}.html`;
}

/**
 * Saves generated slide HTML to public/generated-slides and returns its public URL.
 *
 * @param html - Complete HTML document content.
 * @param fileName - Optional file name. A UUID-based name is used when omitted.
 * @returns The public URL where the generated slide deck can be accessed.
 */
export async function saveHtmlToFile(
  html: string,
  fileName?: string,
): Promise<string> {
  const projectRoot = resolveProjectRoot();
  const generatedSlidesDir = path.join(projectRoot, "public", "generated-slides");
  const safeFileName = sanitizeHtmlFileName(fileName);
  const filePath = path.join(generatedSlidesDir, safeFileName);

  await mkdir(generatedSlidesDir, { recursive: true });
  await writeFile(filePath, html, "utf8");

  return `/generated-slides/${safeFileName}`;
}
