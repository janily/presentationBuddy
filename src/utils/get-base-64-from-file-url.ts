import { readFile } from "fs/promises";
import path from "path";

/**
 * Converts a file URL or local path to a base64 string.
 * Handles both remote URLs (http/https) and local paths (/uploads/...).
 *
 * @param fileUrl - The URL or local path to the file
 * @returns The file content as a base64 encoded string
 */
export async function getBase64FromFileUrl(fileUrl: string): Promise<string> {
  // Check if it's a relative/local path (starts with /)
  if (fileUrl.startsWith("/") && !fileUrl.startsWith("//")) {
    // It's a local path like /uploads/xxx.png
    // Read directly from the file system

    // Determine the project root (handle mastra dev context)
    let projectRoot = process.cwd();

    if (projectRoot.includes(".mastra")) {
      const mastraIndex = projectRoot.indexOf(".mastra");
      projectRoot = projectRoot.substring(0, mastraIndex).replace(/\/$/, "");
    }

    // Construct the full file path
    // /uploads/xxx.png -> public/uploads/xxx.png
    const filePath = path.join(projectRoot, "public", fileUrl);

    console.log("Reading local file:", filePath);

    const fileBuffer = await readFile(filePath);
    return fileBuffer.toString("base64");
  }

  // It's a remote URL, fetch it
  const response = await fetch(fileUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);

  return fileBuffer.toString("base64");
}
