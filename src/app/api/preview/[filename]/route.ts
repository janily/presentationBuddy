import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import path from "path";
import { resolveGeneratedSlidesDir } from "@/src/utils/save-html-to-file";
import { GENERATED_HTML_HEADERS } from "@/src/utils/generated-html-security";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const { filename } = await params;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*\.html$/.test(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  try {
    const output = resolveGeneratedSlidesDir();
    const html = await readFile(path.join(output.dir, filename), "utf8");
    return new NextResponse(html, {
      headers: { ...GENERATED_HTML_HEADERS, "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }
    console.error("Failed to serve generated presentation preview:", { filename, error });
    return NextResponse.json({ error: "Unable to read presentation file" }, { status: 500 });
  }
}
