import { readFile } from "fs/promises";
import { fileURLToPath } from "url";

export async function getBase64FromFileUrl(fileUrl: string): Promise<string> {
  // Convert file:// URL to a file path
  const filePath = fileURLToPath(fileUrl);

  // Read the file as a buffer
  const fileBuffer = await readFile(filePath);

  // Convert to base64
  return fileBuffer.toString("base64");
}
