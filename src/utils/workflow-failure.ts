export type WorkflowFailureInfo = {
  workflowName?: string;
  stepId?: string;
};

export function getWorkflowFailureInfo(workflowData: unknown): WorkflowFailureInfo | null {
  if (!workflowData || typeof workflowData !== "object") return null;

  const outer = workflowData as {
    name?: unknown;
    status?: unknown;
    steps?: unknown;
    data?: { name?: unknown; status?: unknown; steps?: unknown };
  };
  const payload = outer.status ? outer : outer.data;
  if (!payload || payload.status !== "failed") return null;

  const steps = payload.steps && typeof payload.steps === "object"
    ? payload.steps as Record<string, { status?: unknown }>
    : {};
  const failedStep = Object.entries(steps).findLast(([, step]) => step?.status === "failed");

  return {
    workflowName: typeof payload.name === "string" ? payload.name : undefined,
    stepId: failedStep?.[0],
  };
}
