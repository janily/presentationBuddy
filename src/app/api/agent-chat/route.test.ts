import { beforeEach, describe, expect, it } from "vitest";
import type { BriefDecision } from "@/src/mastra/agents/presentation-brief-conversation-agent";
import { createActionProposal } from "./intent-routing";
import {
  buildProposalExecutionReply,
  buildFailedGenerationSystemContext,
  enforceAgentDecisionState,
  resolveProposalExecution,
} from "./route";
import {
  resetAgentProposalStore,
  saveAgentProposal,
} from "@/src/services/agent-proposals/proposal-store";
import type { AgentActionProposal } from "@/src/types/agent-chat";

const baseDecision: BriefDecision = {
  reply: "正在准备视觉风格预览。",
  readyToGenerate: false,
  nextAction: "discover-styles",
  revision: null,
  styleId: null,
  brief: null,
};

function pendingProposal(overrides: Partial<AgentActionProposal> = {}): AgentActionProposal {
  return {
    proposalId: "proposal-1",
    deckId: "deck-1",
    baseVersion: 4,
    action: "revise-structure",
    instruction: "增加一页 Mastra Workflow 实战案例",
    targetSlides: [6],
    requiresOutlineReview: true,
    userFacingSummary: "我会增加一页实战案例，确认后执行。",
    status: "pending",
    createdAt: "2026-07-13T00:00:00.000Z",
    ...overrides,
  };
}

describe("agent action proposal policy", () => {
  it("binds a structural revision proposal to the current artifact version", () => {
    const decision: BriefDecision = {
      ...baseDecision,
      reply: "我会增加一页实战案例，确认后执行。",
      nextAction: "revise-structure",
      revision: {
        instruction: "增加一页 Mastra Workflow 实战案例",
        targetSlides: [6],
        requiresOutlineReview: true,
      },
    };

    expect(createActionProposal(decision, {
      deckId: "deck-1",
      version: 4,
      proposalId: "proposal-1",
      createdAt: "2026-07-13T00:00:00.000Z",
    })).toEqual({
      proposalId: "proposal-1",
      deckId: "deck-1",
      baseVersion: 4,
      action: "revise-structure",
      instruction: "增加一页 Mastra Workflow 实战案例",
      targetSlides: [6],
      requiresOutlineReview: true,
      userFacingSummary: "我会增加一页实战案例，确认后执行。",
      status: "pending",
      createdAt: "2026-07-13T00:00:00.000Z",
    });
  });

  it("does not create a proposal for ordinary chat", () => {
    expect(createActionProposal({
      ...baseDecision,
      reply: "Mastra 的 Workflow 适合确定性的多步骤流程。",
      nextAction: "chat",
      revision: null,
    }, {
      deckId: "deck-1",
      version: 4,
      proposalId: "proposal-1",
      createdAt: "2026-07-13T00:00:00.000Z",
    })).toBeNull();
  });

  it("creates a version-bound proposal for a palette revision", () => {
    expect(createActionProposal({
      ...baseDecision,
      reply: "将配色改为深蓝和青色，保持内容与版式不变。",
      nextAction: "change-palette",
      revision: {
        instruction: "把配色改成深蓝和青色",
        requiresOutlineReview: false,
      },
    }, {
      deckId: "deck-1",
      version: 4,
      proposalId: "proposal-palette",
      createdAt: "2026-07-13T00:00:00.000Z",
    })).toMatchObject({
      action: "change-palette",
      instruction: "把配色改成深蓝和青色",
      baseVersion: 4,
      status: "pending",
    });
  });
});

describe("proposal execution reply", () => {
  it("describes a confirmed palette proposal as a palette change", () => {
    expect(buildProposalExecutionReply(pendingProposal({
      action: "change-palette",
      instruction: "把配色改成深蓝和青色",
      requiresOutlineReview: false,
    }))).toContain("配色修改");
  });

  it("describes an outline-review proposal as an outline change", () => {
    expect(buildProposalExecutionReply(pendingProposal({
      requiresOutlineReview: true,
    }))).toContain("大纲修改");
  });
});

describe("resolveProposalExecution deterministic gating", () => {
  beforeEach(() => {
    resetAgentProposalStore();
  });

  it("executes a valid pending proposal that matches the current deck version", () => {
    saveAgentProposal(pendingProposal());

    const outcome = resolveProposalExecution(
      "proposal-1",
      { deckId: "deck-1", version: 4 },
      "op-1",
    );

    expect(outcome.result).toBe("executed");
    expect(outcome.payload.nextAction).toBe("execute-proposal");
    expect(outcome.payload.executeProposalId).toBe("proposal-1");
    expect(outcome.payload.proposal?.status).toBe("executing");
    expect(outcome.payload.revision).toMatchObject({
      instruction: "增加一页 Mastra Workflow 实战案例",
      requiresOutlineReview: true,
    });
  });

  it("rejects execution when no deck context is supplied", () => {
    saveAgentProposal(pendingProposal());

    const outcome = resolveProposalExecution("proposal-1", undefined, "op-1");

    expect(outcome.result).toBe("invalid-or-missing");
    expect(outcome.payload.nextAction).toBe("chat");
    expect(outcome.payload.executeProposalId).toBeNull();
  });

  it("rejects execution when the proposal id is unknown", () => {
    const outcome = resolveProposalExecution(
      "missing",
      { deckId: "deck-1", version: 4 },
      "op-1",
    );

    expect(outcome.result).toBe("invalid-or-missing");
    expect(outcome.payload.executeProposalId).toBeNull();
  });

  it("rejects execution when the proposal is bound to an older deck version", () => {
    saveAgentProposal(pendingProposal({ baseVersion: 3 }));

    const outcome = resolveProposalExecution(
      "proposal-1",
      { deckId: "deck-1", version: 4 },
      "op-1",
    );

    expect(outcome.result).toBe("stale-version");
    expect(outcome.payload.nextAction).toBe("chat");
  });

  it("deduplicates a proposal that is already executing", () => {
    saveAgentProposal(pendingProposal({ status: "executing" }));

    const outcome = resolveProposalExecution(
      "proposal-1",
      { deckId: "deck-1", version: 4 },
      "op-1",
    );

    expect(outcome.result).toBe("deduplicated");
    expect(outcome.payload.nextAction).toBe("chat");
  });
});

describe("agent decision state gating", () => {
  it("downgrades generation while another generation is in progress", () => {
    const result = enforceAgentDecisionState({
      ...baseDecision,
      reply: "请确认后执行。",
      readyToGenerate: true,
      nextAction: "generate",
      brief: {
        topic: "Mastra 教程",
        audience: "开发者",
        pageCount: 10,
        style: "Paper & Ink",
        requirements: "",
        purpose: "teaching-tutorial",
        density: "speaker-led",
        contentReadiness: "ready",
      },
    }, { isGenerating: true });

    expect(result.decision.readyToGenerate).toBe(false);
    expect(result.decision.nextAction).toBe("chat");
    expect(result.decision.brief).toBeNull();
    expect(result.reason).toBe("generation-in-progress");
  });

  it("downgrades a revision decision with contradictory generation readiness", () => {
    const result = enforceAgentDecisionState({
      ...baseDecision,
      readyToGenerate: true,
      nextAction: "revise-structure",
      revision: {
        instruction: "增加一页框架对比",
        requiresOutlineReview: true,
      },
    }, { isGenerating: false });

    expect(result.decision.readyToGenerate).toBe(false);
    expect(result.decision.nextAction).toBe("chat");
    expect(result.decision.revision).toBeNull();
    expect(result.reason).toBe("inconsistent-decision");
  });

  it("marks a generating-time revision for deferred orchestration without changing its intent", () => {
    const result = enforceAgentDecisionState({
      ...baseDecision,
      nextAction: "revise-structure",
      revision: {
        instruction: "增加一页框架对比",
        requiresOutlineReview: true,
      },
    }, { isGenerating: true });

    expect(result.decision.readyToGenerate).toBe(false);
    expect(result.decision.nextAction).toBe("revise-structure");
    expect(result.reason).toBe("generation-in-progress");
  });
});

describe("failed generation conversation context", () => {
  it("marks the old run as stopped and routes visual requests to style discovery", () => {
    const context = buildFailedGenerationSystemContext({
      topic: "Mastra 教程",
      audience: "开发者",
      pageCount: 15,
      style: "Vellum",
    });

    expect(context).toContain("is no longer running");
    expect(context).toContain('nextAction to "discover-styles"');
    expect(context).toContain('"pageCount":15');
  });
});
