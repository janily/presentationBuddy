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
  if (typeof image === "string") {
    // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    imageBuffer = Buffer.from(base64Data, "base64");
  } else {
    imageBuffer = image;
  }

  // Generate unique filename
  const fileName = `${randomUUID()}.${extension}`;

  // Ensure the uploads directory exists
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });

  // Save the file
  const filePath = path.join(uploadsDir, fileName);
  await writeFile(filePath, imageBuffer);

  // Return the public URL
  return `/uploads/${fileName}`;
}
