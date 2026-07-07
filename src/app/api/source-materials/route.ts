import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const supportedMimeTypes: Record<string, string> = {
      "text/plain": "txt",
      "text/markdown": "md",
      "application/pdf": "pdf",
      "application/vnd.ms-powerpoint": "ppt",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        "pptx",
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "docx",
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    };

    const mimeType = file.type || "application/octet-stream";

    if (!supportedMimeTypes[mimeType]) {
      return NextResponse.json(
        { error: "Unsupported source material type" },
        { status: 400 },
      );
    }

    const materialId = randomUUID();
    const extension = supportedMimeTypes[mimeType];
    const fileName = `${materialId}.${extension}`;

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Ensure the source materials directory exists
    const sourceMaterialsDir = path.join(
      process.cwd(),
      "public",
      "source-materials",
    );
    await mkdir(sourceMaterialsDir, { recursive: true });

    // Save the file
    const filePath = path.join(sourceMaterialsDir, fileName);
    await writeFile(filePath, buffer);

    // Return the public URL and metadata needed by the workflow
    const url = `/source-materials/${fileName}`;

    return NextResponse.json({
      success: true,
      materialId,
      url,
      mimeType,
      originalName: file.name,
    });
  } catch (error) {
    console.error("Source material upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload source material" },
      { status: 500 },
    );
  }
}
