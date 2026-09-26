import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getProjectRoot } from "./project-root";

export type SaveHtmlToFileOptions = {
  prefix?: string;
};

export type GeneratedSlidesDir = {
  dir: string;
  servedByStatic: boolean;
  source: "custom" | "vercel" | "public";
};

export function resolveGeneratedSlidesDir(): GeneratedSlidesDir {
  if (process.env.GENERATED_SLIDES_DIR) {
    return {
      dir: process.env.GENERATED_SLIDES_DIR,
      servedByStatic: false,
      source: "custom",
    };
  }

  if (process.env.VERCEL === "1") {
    return {
      dir: path.join("/tmp", "generated-slides"),
      servedByStatic: false,
      source: "vercel",
    };
  }

  return {
    dir: path.join(getProjectRoot(), "public", "generated-slides"),
    servedByStatic: true,
    source: "public",
  };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Saves HTML to the configured generated-slides folder and returns the preview URL.
 *
 * @param html - The HTML content to write to disk.
 * @param options - Optional filename customizations.
 * @returns The URL where the generated HTML can be accessed.
 */
export async function saveHtmlToFile(
  html: string,
  options?: SaveHtmlToFileOptions,
): Promise<string> {
  const prefix = options?.prefix ?? "presentation";
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(prefix)) {
    throw new Error("Invalid filename prefix");
  }
  const fileName = `${prefix}-${randomUUID()}.html`;
  const output = resolveGeneratedSlidesDir();
  const filePath = path.join(output.dir, fileName);

  await mkdir(output.dir, { recursive: true });

  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await writeFile(filePath, html, "utf8");

      console.log("Generated presentation HTML saved:", {
        filePath,
        size: html.length,
        servedByStatic: output.servedByStatic,
        source: output.source,
      });

      return output.servedByStatic
        ? `/generated-slides/${fileName}`
        : `/api/preview/${fileName}`;
    } catch (error) {
      lastError = error;
      console.error("Failed to save generated presentation HTML:", {
        filePath,
        attempt,
        retriesLeft: 3 - attempt,
        error,
      });

      if (attempt < 3) {
        await wait(1_000);
      }
    }
  }

  throw lastError;
}
