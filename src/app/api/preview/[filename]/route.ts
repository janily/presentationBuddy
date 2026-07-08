import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";
import { resolveGeneratedSlidesDir } from "@/src/utils/save-html-to-file";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;

  if (
    !filename.endsWith(".html")
    || filename.includes("..")
    || filename.includes("/")
    || filename.includes("\\")
  ) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  try {
    const output = resolveGeneratedSlidesDir();
    const filePath = path.join(output.dir, filename);
    const html = await readFile(filePath, "utf8");

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": output.source === "vercel"
          ? "no-store"
          : "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Failed to serve generated presentation preview:", {
      filename,
      error,
    });

    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
