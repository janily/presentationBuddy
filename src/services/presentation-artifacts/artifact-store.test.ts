import { beforeEach, describe, expect, it } from "vitest";
import {
  getPresentationArtifact,
  resetPresentationArtifactStore,
  savePresentationArtifact,
} from "./artifact-store";

const outline = {
  title: "Deck",
  narrativeGoal: "Explain the product",
  sections: ["Intro"],
  slides: [
    {
      pageNumber: 1,
      title: "Intro",
      purpose: "Set context",
      keyPoints: ["One"],
      designSuggestion: "Clean",
    },
  ],
  designGuidance: ["High contrast"],
};

const brief = {
  topic: "Product",
  audience: "Customers",
  pageCount: 3,
  style: "Modern",
  requirements: "Concise",
};

describe("presentation artifact store", () => {
  beforeEach(() => resetPresentationArtifactStore());

  it("publishes the first artifact at version one", () => {
    const artifact = savePresentationArtifact({
      operation: { operationId: "op-1", deckId: "deck-1", baseVersion: 0, targetVersion: 1 },
      brief,
      approvedOutline: outline,
      html: "<html>v1</html>",
      htmlUrl: "/api/preview/v1",
    });

    expect(artifact.version).toBe(1);
    expect(getPresentationArtifact("deck-1")).toEqual(artifact);
  });

  it("publishes a revision only when its base version is current", () => {
    savePresentationArtifact({
      operation: { operationId: "op-1", deckId: "deck-1", baseVersion: 0, targetVersion: 1 },
      brief,
      approvedOutline: outline,
      html: "<html>v1</html>",
      htmlUrl: "/api/preview/v1",
    });

    const artifact = savePresentationArtifact({
      operation: { operationId: "op-2", deckId: "deck-1", baseVersion: 1, targetVersion: 2 },
      brief: { ...brief, style: "Professional dark" },
      approvedOutline: outline,
      html: "<html>v2</html>",
      htmlUrl: "/api/preview/v2",
    });

    expect(artifact.version).toBe(2);
    expect(artifact.html).toContain("v2");
  });

  it("rejects stale revisions without replacing the active artifact", () => {
    savePresentationArtifact({
      operation: { operationId: "op-1", deckId: "deck-1", baseVersion: 0, targetVersion: 1 },
      brief,
      approvedOutline: outline,
      html: "<html>v1</html>",
      htmlUrl: "/api/preview/v1",
    });

    expect(() => savePresentationArtifact({
      operation: { operationId: "op-stale", deckId: "deck-1", baseVersion: 0, targetVersion: 1 },
      brief,
      approvedOutline: outline,
      html: "<html>stale</html>",
      htmlUrl: "/api/preview/stale",
    })).toThrow(/version conflict/i);

    expect(getPresentationArtifact("deck-1")?.html).toContain("v1");
  });
});
