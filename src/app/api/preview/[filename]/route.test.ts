import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ readFile: vi.fn(), resolveDir: vi.fn() }));
vi.mock("fs/promises", () => ({ readFile: mocks.readFile }));
vi.mock("@/src/utils/save-html-to-file", () => ({ resolveGeneratedSlidesDir: mocks.resolveDir }));
const { GET } = await import("./route");
const config = (await import("../../../../../next.config")).default;
const get = (filename: string) => GET(new Request("http://localhost/api/preview/deck.html"), { params: Promise.resolve({ filename }) });

beforeEach(() => {
  mocks.readFile.mockReset().mockResolvedValue("<!doctype html><html>deck</html>");
  mocks.resolveDir.mockReturnValue({ dir: "/data/generated-slides", source: "custom", servedByStatic: false });
});

describe("generated HTML serving", () => {
  it("isolates scripts even when the preview URL is opened directly", async () => {
    const response = await get("deck.html");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Security-Policy")).toContain("sandbox allow-scripts");
    expect(response.headers.get("Content-Security-Policy")).not.toContain("allow-same-origin");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(await response.text()).toContain("deck");
  });

  it("also protects the public static generated-slides path", async () => {
    const headers = await config.headers?.();
    const rule = headers?.find((item) => item.source === "/generated-slides/:path*");
    expect(rule?.headers.find((item) => item.key === "Content-Security-Policy")?.value).toContain("sandbox allow-scripts");
  });

  it.each(["../private.html", "sub/deck.html", "sub\\deck.html", "deck.txt", "bad\0.html"])("rejects unsafe filename %j", async (filename) => {
    expect((await get(filename)).status).toBe(400);
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it("distinguishes missing files from server storage failures", async () => {
    mocks.readFile.mockRejectedValueOnce(Object.assign(new Error("missing"), { code: "ENOENT" }));
    expect((await get("missing.html")).status).toBe(404);
    mocks.readFile.mockRejectedValueOnce(Object.assign(new Error("permission denied"), { code: "EACCES" }));
    expect((await get("deck.html")).status).toBe(500);
  });
});
