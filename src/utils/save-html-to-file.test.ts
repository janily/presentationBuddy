import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import path from "path";

const mkdir = vi.fn();
const writeFile = vi.fn();
const randomUUID = vi.fn(() => "fixed-id");

vi.mock("fs/promises", () => ({ mkdir, writeFile }));
vi.mock("crypto", () => ({ randomUUID }));

const { saveHtmlToFile } = await import("./save-html-to-file");

describe("saveHtmlToFile", () => {
  const originalCwd = process.cwd;

  beforeEach(() => {
    mkdir.mockReset();
    writeFile.mockReset();
    randomUUID.mockReturnValue("fixed-id");
  });

  afterEach(() => {
    process.cwd = originalCwd;
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
});
