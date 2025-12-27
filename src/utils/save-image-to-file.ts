import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

/**
 * Saves an image to the public/uploads folder and returns the public URL.
 * Supports both base64 encoded strings and Buffer inputs.
 *
 * @param image - The image data as a base64 string (can include data URL prefix) or Buffer
 * @param extension - The file extension (default: 'jpeg')
 * @returns The public URL where the image can be accessed
 */
export async function saveImageToFile(
  image: string | Buffer,
  extension: string = "jpeg",
): Promise<string> {
  // Convert to buffer if it's a base64 string
  let imageBuffer: Buffer;

  console.log("in save image to file");

  if (typeof image === "string") {
    // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    imageBuffer = Buffer.from(base64Data, "base64");
    console.log("Buffer created, size:", imageBuffer.length, "bytes");
  } else {
    imageBuffer = image;
  }

  // Generate unique filename
  const fileName = `${randomUUID()}.${extension}`;

  // Determine the project root
  // When running `mastra dev`, process.cwd() points to .mastra/output
  // We need to navigate back to the actual project root
  let projectRoot = process.cwd();

  console.log("Original process.cwd():", projectRoot);

  // Check if we're running from within .mastra directory (mastra dev context)
  if (projectRoot.includes(".mastra")) {
    // Navigate up to the actual project root
    // .mastra/output -> project root (go up 2 levels)
    const mastraIndex = projectRoot.indexOf(".mastra");
    projectRoot = projectRoot.substring(0, mastraIndex).replace(/\/$/, "");
  }

  const uploadsDir = path.join(projectRoot, "public", "uploads");

  console.log("Resolved projectRoot:", projectRoot);
  console.log("uploadsDir:", uploadsDir);

  // Ensure the uploads directory exists
  await mkdir(uploadsDir, { recursive: true });

  // Save the file
  const filePath = path.join(uploadsDir, fileName);
  console.log("Saving to filePath:", filePath);

  await writeFile(filePath, imageBuffer);
  console.log("File written successfully");

  // Return the public URL
  return `/uploads/${fileName}`;
}
