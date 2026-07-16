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

export function hasPresentationArtifactVersionConflict(deckId: string, baseVersion: number) {
  const current = getStore().get(deckId);

  // The in-memory store is only a best-effort cache in production. A cold
  // server instance has no record of decks created by another instance, so a
  // missing entry must not be treated as version 0. When an entry is present,
  // keep enforcing the optimistic lock normally.
  return current !== undefined && current.version !== baseVersion;
}

export function savePresentationArtifact(input: SavePresentationArtifactInput) {
  const { operation } = input;
  const store = getStore();
  const current = store.get(operation.deckId);
  const currentVersion = current?.version ?? 0;

  if (current && currentVersion !== operation.baseVersion) {
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
