import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export type SaveHtmlToFileOptions = {
  prefix?: string;
};

/**
 * Saves HTML to the public/generated-slides folder and returns the public URL.
 *
 * @param html - The HTML content to write to disk.
 * @param options - Optional filename customizations.
 * @returns The public URL where the generated HTML can be accessed.
 */
export async function saveHtmlToFile(
  html: string,
  options?: SaveHtmlToFileOptions,
): Promise<string> {
  const prefix = options?.prefix ?? "presentation";
  const fileName = `${prefix}-${randomUUID()}.html`;

  // Determine the project root.
  // When running `mastra dev`, process.cwd() points to .mastra/output.
  // We need to navigate back to the actual project root.
  let projectRoot = process.cwd();

  // Check if we're running from within .mastra directory (mastra dev context).
  if (projectRoot.includes(".mastra")) {
    const mastraIndex = projectRoot.indexOf(".mastra");
    projectRoot = projectRoot.substring(0, mastraIndex).replace(/\/$/, "");
  }

  const generatedSlidesDir = path.join(
    projectRoot,
    "public",
    "generated-slides",
  );

  await mkdir(generatedSlidesDir, { recursive: true });

  const filePath = path.join(generatedSlidesDir, fileName);

  await writeFile(filePath, html, "utf8");

  return `/generated-slides/${fileName}`;
}
