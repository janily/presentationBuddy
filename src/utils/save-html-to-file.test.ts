import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import path from "path";

const mkdir = vi.fn();
const writeFile = vi.fn();
const randomUUID = vi.fn(() => "fixed-id");

vi.mock("fs/promises", () => ({ mkdir, writeFile }));
vi.mock("crypto", () => ({ randomUUID }));

const { resolveGeneratedSlidesDir, saveHtmlToFile } = await import("./save-html-to-file");

describe("saveHtmlToFile", () => {
  const originalCwd = process.cwd;
  const originalGeneratedSlidesDir = process.env.GENERATED_SLIDES_DIR;
  const originalVercel = process.env.VERCEL;

  beforeEach(() => {
    mkdir.mockReset();
    writeFile.mockReset();
    randomUUID.mockReturnValue("fixed-id");
    delete process.env.GENERATED_SLIDES_DIR;
    delete process.env.VERCEL;
    vi.useRealTimers();
  });

  afterEach(() => {
    process.cwd = originalCwd;
    process.env.GENERATED_SLIDES_DIR = originalGeneratedSlidesDir;
    process.env.VERCEL = originalVercel;
    vi.useRealTimers();
  });

  it("uses the default filename prefix and returns the public generated-slides URL", async () => {
    process.cwd = () => "/repo";

    const url = await saveHtmlToFile("<html />");

    expect(mkdir).toHaveBeenCalledWith(path.join("/repo", "public", "generated-slides"), { recursive: true });
    expect(writeFile).toHaveBeenCalledWith(path.join("/repo", "public", "generated-slides", "presentation-fixed-id.html"), "<html />", "utf8");
    expect(url).toBe("/generated-slides/presentation-fixed-id.html");
  });

  it("uses a custom filename prefix", async () => {
    process.cwd = () => "/repo";

    const url = await saveHtmlToFile("<html />", { prefix: "custom-deck" });

    expect(writeFile).toHaveBeenCalledWith(path.join("/repo", "public", "generated-slides", "custom-deck-fixed-id.html"), "<html />", "utf8");
    expect(url).toBe("/generated-slides/custom-deck-fixed-id.html");
  });

  it("resolves the project root when cwd is inside .mastra output", async () => {
    process.cwd = () => "/repo/.mastra/output";

    await saveHtmlToFile("<html />");

    expect(mkdir).toHaveBeenCalledWith(path.join("/repo", "public", "generated-slides"), { recursive: true });
    expect(writeFile).toHaveBeenCalledWith(path.join("/repo", "public", "generated-slides", "presentation-fixed-id.html"), "<html />", "utf8");
  });

  it("uses GENERATED_SLIDES_DIR and returns the preview API URL", async () => {
    process.env.GENERATED_SLIDES_DIR = path.join("/data", "generated-slides");

    const url = await saveHtmlToFile("<html />");

    expect(mkdir).toHaveBeenCalledWith(path.join("/data", "generated-slides"), { recursive: true });
    expect(writeFile).toHaveBeenCalledWith(path.join("/data", "generated-slides", "presentation-fixed-id.html"), "<html />", "utf8");
    expect(url).toBe("/api/preview/presentation-fixed-id.html");
  });

  it("uses /tmp on Vercel and returns the preview API URL", async () => {
    process.env.VERCEL = "1";

    const url = await saveHtmlToFile("<html />");

    expect(mkdir).toHaveBeenCalledWith(path.join("/tmp", "generated-slides"), { recursive: true });
    expect(writeFile).toHaveBeenCalledWith(path.join("/tmp", "generated-slides", "presentation-fixed-id.html"), "<html />", "utf8");
    expect(url).toBe("/api/preview/presentation-fixed-id.html");
  });

  it("prefers GENERATED_SLIDES_DIR over Vercel /tmp", () => {
    process.env.GENERATED_SLIDES_DIR = path.join("/data", "generated-slides");
    process.env.VERCEL = "1";

    expect(resolveGeneratedSlidesDir()).toEqual({
      dir: path.join("/data", "generated-slides"),
      servedByStatic: false,
      source: "custom",
    });
  });

  it("retries when writing the file fails", async () => {
    vi.useFakeTimers();
    process.cwd = () => "/repo";
    writeFile
      .mockRejectedValueOnce(new Error("temporary write failure"))
      .mockResolvedValueOnce(undefined);

    const savePromise = saveHtmlToFile("<html />");
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(savePromise).resolves.toBe("/generated-slides/presentation-fixed-id.html");
    expect(writeFile).toHaveBeenCalledTimes(2);
  });
});
