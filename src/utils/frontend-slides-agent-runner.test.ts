import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  assertFrontendSlidesDocument,
  assertFrontendSlidesComplete,
  buildFrontendSlidesAgentPrompt,
  buildFrontendSlidesInteractivePrompt,
  countGeneratedSlides,
  extractHtmlFromAgentResult,
  invokeFrontendSlidesAgent,
  isFrontendSlidesAgentConfigured,
  isFrontendSlidesRequired,
  resolveFrontendSlidesHtml,
  startOrContinueFrontendSlidesSession,
} from "./frontend-slides-agent-runner";
import type { FrontendSlidesInput } from "./outline-to-slides-mapper";

const queryMock = vi.hoisted(() => vi.fn());

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: queryMock,
}));

const input: FrontendSlidesInput = {
  title: "AI Strategy Brief",
  style: "business modern",
  narrativeGoal: "Help executives choose the next AI investment.",
  designGuidance: ["Use restrained executive visuals"],
  slides: [
    {
      title: "Intro",
      layout: "title",
      content: "Core message:\nFrame the strategic decision.",
    },
    {
      title: "Portfolio choices",
      layout: "content",
      content: "Core message:\nCompare options.",
    },
  ],
};

const validFrontendSlidesHtml = `<!doctype html>
<html>
<head>
<style>
.deck-viewport { width: 100vw; height: 100vh; }
.slide-stage { width: 1920px; height: 1080px; }
.slide { display: block; visibility: hidden; pointer-events: none; }
.slide.active { visibility: visible; pointer-events: auto; }
</style>
</head>
<body>
<main class="slide-stage">
<section class="slide active">One</section>
<section class="slide">Two</section>
</main>
</body>
</html>`;

function makeQueryMock(
  messages: unknown[],
  commands: Array<{ name: string; description?: string }> = [{ name: "frontend-slides" }],
) {
  const iterator = (async function* () {
    for (const message of messages) {
      yield message;
    }
  })();

  return Object.assign(iterator, {
    supportedCommands: vi.fn().mockResolvedValue(commands),
    close: vi.fn(),
  });
}

describe("frontend-slides agent runner helpers", () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  const originalRequired = process.env.FRONTEND_SLIDES_REQUIRED;
  const tempDir = path.join(process.cwd(), ".frontend-slides-runs", "test-runner");

  afterEach(async () => {
    process.env.ANTHROPIC_API_KEY = originalApiKey;
    process.env.FRONTEND_SLIDES_REQUIRED = originalRequired;
    queryMock.mockReset();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("detects whether the agent can be configured from ANTHROPIC_API_KEY", () => {
    delete process.env.ANTHROPIC_API_KEY;
    expect(isFrontendSlidesAgentConfigured()).toBe(false);

    process.env.ANTHROPIC_API_KEY = "test-key";
    expect(isFrontendSlidesAgentConfigured()).toBe(true);
  });

  it("detects strict frontend-slides mode", () => {
    delete process.env.FRONTEND_SLIDES_REQUIRED;
    expect(isFrontendSlidesRequired()).toBe(false);

    process.env.FRONTEND_SLIDES_REQUIRED = "true";
    expect(isFrontendSlidesRequired()).toBe(true);
  });

  it("builds a headless prompt that requires the approved slide count", () => {
    const prompt = buildFrontendSlidesAgentPrompt(input);

    expect(prompt).toContain("headless server-side generation task");
    expect(prompt).toContain("Required slide count: 2");
    expect(prompt).toContain("Do not ask follow-up questions");
    expect(prompt).toContain("Write exactly one complete HTML document");
    expect(prompt).toContain("Slide 2: Portfolio choices");
  });

  it("extracts HTML from fenced or plain agent results", () => {
    expect(extractHtmlFromAgentResult("```html\n<!doctype html><html><body>Deck</body></html>\n```"))
      .toBe("<!doctype html><html><body>Deck</body></html>");

    expect(extractHtmlFromAgentResult("Done:\n<html><body>Deck</body></html>"))
      .toBe("<html><body>Deck</body></html>");
  });

  it("counts section slides and frontend-slides class slides", () => {
    expect(countGeneratedSlides("<section>One</section><section>Two</section>")).toBe(2);
    expect(countGeneratedSlides('<div class="slide active"></div><div class="chapter slide"></div>')).toBe(2);
  });

  it("fails incomplete HTML output before it can be saved", () => {
    expect(() => assertFrontendSlidesComplete("<section>Only one</section>", 2))
      .toThrow("only contains 1 slide(s), expected 2");
  });

  it("reads the generated HTML file when the agent result only returns a path", async () => {
    const outputPath = path.join(tempDir, "deck.html");
    await mkdir(tempDir, { recursive: true });
    await writeFile(outputPath, validFrontendSlidesHtml, "utf8");

    await expect(resolveFrontendSlidesHtml("Done: .frontend-slides-runs/test-runner/deck.html", outputPath))
      .resolves.toBe(validFrontendSlidesHtml);
  });

  it("validates frontend-slides fixed-stage output rules", () => {
    expect(() => assertFrontendSlidesDocument(validFrontendSlidesHtml, 2)).not.toThrow();

    expect(() => assertFrontendSlidesDocument(
      '<!doctype html><html><style>.slide-stage{width:1920px;height:1080px}.slide{display:none;visibility:hidden;pointer-events:none}.slide.active{display:block;visibility:visible;pointer-events:auto}</style><body><main class="slide-stage"><section class="slide">One</section><section class="slide">Two</section></main></body></html>',
      2,
    )).toThrow("display none/block");
  });

  it("reports friendly progress events while invoking the agent", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    queryMock.mockReturnValue(makeQueryMock([
      {
        type: "assistant",
        message: { content: [{ type: "text", text: "Working" }] },
      },
      {
        type: "result",
        subtype: "success",
        result: validFrontendSlidesHtml,
      },
    ]));

    const progress: string[] = [];
    const result = await invokeFrontendSlidesAgent(input, {
      onProgress: (event) => progress.push(event.stage),
    });

    expect(result.html).toContain("<!doctype html>");
    expect(progress).toContain("load-skill");
    expect(progress).toContain("compose");
    expect(progress).toContain("validate");
  });

  it("fails clearly when the SDK does not discover the frontend-slides skill", async () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    queryMock.mockReturnValue(makeQueryMock([], [{ name: "other-skill" }]));

    await expect(invokeFrontendSlidesAgent(input)).rejects.toThrow("did not discover the frontend-slides skill");
  });

  it("builds an interactive prompt that invites the agent to ask follow-up questions", () => {
    const prompt = buildFrontendSlidesInteractivePrompt({ topic: "Q3 launch" }, ".frontend-slides-runs/abc/deck.html");

    expect(prompt).toContain("interactive, multi-turn session");
    expect(prompt).toContain("Topic: Q3 launch");
    expect(prompt).not.toContain("headless");
  });

  describe("startOrContinueFrontendSlidesSession", () => {
    const runId = "test-interactive";
    const runDir = path.join(process.cwd(), ".frontend-slides-runs", runId);

    afterEach(async () => {
      await rm(runDir, { recursive: true, force: true });
    });

    it("returns a question turn when the agent has not written the deck yet", async () => {
      process.env.ANTHROPIC_API_KEY = "test-key";
      queryMock.mockReturnValue(makeQueryMock([
        { type: "system", session_id: "session-1" },
        { type: "result", subtype: "success", result: "What is this presentation for?", session_id: "session-1" },
      ]));

      const result = await startOrContinueFrontendSlidesSession({
        runId,
        userMessage: "Help me build a pitch deck",
      });

      expect(result).toEqual({
        kind: "question",
        sessionId: "session-1",
        runId,
        assistantMessage: "What is this presentation for?",
      });
    });

    it("returns a done turn once the agent has written a valid deck to disk", async () => {
      process.env.ANTHROPIC_API_KEY = "test-key";
      process.env.FRONTEND_SLIDES_KEEP_RUN_FILES = "true";
      await mkdir(runDir, { recursive: true });
      await writeFile(path.join(runDir, "deck.html"), validFrontendSlidesHtml, "utf8");

      queryMock.mockReturnValue(makeQueryMock([
        { type: "result", subtype: "success", result: "Done, it's ready.", session_id: "session-2" },
      ]));

      const result = await startOrContinueFrontendSlidesSession({
        sessionId: "session-1",
        runId,
        userMessage: "Looks great, finish it",
      });

      expect(result.kind).toBe("done");
      if (result.kind === "done") {
        expect(result.html).toContain("<!doctype html>");
        expect(result.sessionId).toBe("session-2");
      }

      delete process.env.FRONTEND_SLIDES_KEEP_RUN_FILES;
    });

    it("resumes an existing session id instead of re-checking skill availability", async () => {
      process.env.ANTHROPIC_API_KEY = "test-key";
      const mock = makeQueryMock([
        { type: "result", subtype: "success", result: "Sure, one more question...", session_id: "session-1" },
      ]);
      queryMock.mockReturnValue(mock);

      await startOrContinueFrontendSlidesSession({
        sessionId: "session-1",
        runId,
        userMessage: "Reading deck, please",
      });

      expect(mock.supportedCommands).not.toHaveBeenCalled();
      expect(queryMock).toHaveBeenCalledWith(expect.objectContaining({
        prompt: "Reading deck, please",
        options: expect.objectContaining({ resume: "session-1" }),
      }));
    });

    it("reports live progress from assistant text and tool_use messages via onProgress", async () => {
      process.env.ANTHROPIC_API_KEY = "test-key";
      queryMock.mockReturnValue(makeQueryMock([
        {
          type: "assistant",
          session_id: "session-1",
          message: {
            content: [
              { type: "text", text: "Let me check the design guidelines first." },
              { type: "tool_use", name: "Read", input: { file_path: "viewport-base.css" } },
            ],
          },
        },
        {
          type: "assistant",
          session_id: "session-1",
          message: {
            content: [{ type: "tool_use", name: "Write", input: { file_path: "deck.html" } }],
          },
        },
        { type: "result", subtype: "success", result: "What is this presentation for?", session_id: "session-1" },
      ]));

      const progress: string[] = [];

      await startOrContinueFrontendSlidesSession({
        runId,
        userMessage: "Help me build a pitch deck",
        onProgress: (message) => progress.push(message),
      });

      // The first onProgress call is the fixed "loading instructions" message;
      // the rest are derived from the streamed assistant/tool_use messages.
      expect(progress).toContain("Let me check the design guidelines first.");
      expect(progress).toContain("正在读取设计规范...");
      expect(progress).toContain("正在写入演示文稿 HTML...");
    });
  });
});
