import { describe, expect, it } from "vitest";
import { appendCompletionMessage, type AgentMessage } from "./agent-message-model";

describe("agent message model", () => {
  it("adds one durable completion message per artifact", () => {
    const once = appendCompletionMessage([], {
      artifactId: "deck-1:1",
      slideCount: 8,
      htmlUrl: "/preview/v1",
    });
    const twice = appendCompletionMessage(once, {
      artifactId: "deck-1:1",
      slideCount: 8,
      htmlUrl: "/preview/v1",
    });

    expect(twice).toHaveLength(1);
    expect(twice[0]).toMatchObject({ id: "complete-deck-1:1", kind: "complete" });
  });

  it("does not move a completion message behind a later user turn", () => {
    const completed = appendCompletionMessage([], {
      artifactId: "deck-1:1",
      slideCount: 8,
    });
    const userMessage: AgentMessage = {
      id: "user-2",
      role: "user",
      kind: "text",
      content: "换一种视觉风格",
    };
    const withUser = [...completed, userMessage];
    const rerendered = appendCompletionMessage(withUser, {
      artifactId: "deck-1:1",
      slideCount: 8,
    });

    expect(rerendered.map((message) => message.id)).toEqual([
      "complete-deck-1:1",
      "user-2",
    ]);
  });
});
