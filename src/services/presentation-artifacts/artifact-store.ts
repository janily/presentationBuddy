import type {
  ArtifactOperation,
  DeckArtifact,
  PresentationBriefData,
  PresentationOutlineData,
} from "@/src/types/presentation-workflow";

type SavePresentationArtifactInput = {
  operation: ArtifactOperation;
  brief: PresentationBriefData;
  approvedOutline: PresentationOutlineData;
  html: string;
  htmlUrl?: string;
};

const globalArtifactStore = globalThis as typeof globalThis & {
  __presentationBuddyArtifacts?: Map<string, DeckArtifact>;
};

function getStore() {
  globalArtifactStore.__presentationBuddyArtifacts ??= new Map<string, DeckArtifact>();
  return globalArtifactStore.__presentationBuddyArtifacts;
}

export function getPresentationArtifact(deckId: string) {
  return getStore().get(deckId) ?? null;
}

export function savePresentationArtifact(input: SavePresentationArtifactInput) {
  const { operation } = input;
  const store = getStore();
  const current = store.get(operation.deckId);
  const currentVersion = current?.version ?? 0;

  if (currentVersion !== operation.baseVersion) {
    throw new Error(
      `Artifact version conflict for ${operation.deckId}: expected base ${currentVersion}, received ${operation.baseVersion}`,
    );
  }

  if (operation.targetVersion !== operation.baseVersion + 1) {
    throw new Error("Artifact target version must advance the base version by one");
  }

  const now = new Date().toISOString();
  const artifact: DeckArtifact = {
    deckId: operation.deckId,
    version: operation.targetVersion,
    operationId: operation.operationId,
    brief: input.brief,
    approvedOutline: input.approvedOutline,
    html: input.html,
    htmlUrl: input.htmlUrl,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
  };

  store.set(operation.deckId, artifact);
  return artifact;
}

export function resetPresentationArtifactStore() {
  getStore().clear();
}
