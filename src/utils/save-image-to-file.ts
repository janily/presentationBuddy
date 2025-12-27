import { writeFile, mkdir } from "fs/promises";
import path from "path";

/**
 * Saves a base64 image to the data folder with the specified filename.
 * @param base64Image - The base64 encoded image string (can include data URL prefix)
 * @param fileName - The filename to use (without extension)
 * @param extension - The file extension (default: 'jpeg')
 * @returns The full path to the saved file
 */
export async function saveImageToFile(
  base64Image: string,
  fileName: string,
  extension: string = "jpeg",
): Promise<string> {
  // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

  // Convert base64 to buffer
  const imageBuffer = Buffer.from(base64Data, "base64");

  // Get the data directory path (relative to project root)
  const dataDir = path.join(process.cwd(), "data");

  // Ensure the data directory exists
  await mkdir(dataDir, { recursive: true });

  // Create the file path
  const fullFileName = `${fileName}.${extension}`;
  const filePath = path.join(dataDir, fullFileName);

  // Write the file
  await writeFile(filePath, imageBuffer);

  return filePath;
}
