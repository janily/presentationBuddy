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

    const mimeToExt: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/svg+xml": "svg",
      "text/html": "html",
      "application/pdf": "pdf",
      "text/markdown": "md",
      "text/plain": "txt",
    };

    const extension = mimeToExt[file.type];

    if (!extension) {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 400 },
      );
    }

    const assetType = file.type.startsWith("image/")
      ? "image"
      : file.type === "text/html"
        ? "html"
        : file.type === "application/pdf"
          ? "pdf"
          : "document";

    // Generate unique filename
    const fileName = `${randomUUID()}.${extension}`;

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Ensure the uploads directory exists
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    // Save the file
    const filePath = path.join(uploadsDir, fileName);
    await writeFile(filePath, buffer);

    // Return the public URL
    const url = `/uploads/${fileName}`;

    return NextResponse.json({
      success: true,
      url,
      fileName,
      assetType,
      contentType: file.type,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 },
    );
  }
}
