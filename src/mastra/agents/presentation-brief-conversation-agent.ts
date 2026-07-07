import { Agent } from "@mastra/core";
import z from "zod";
import { getConfiguredModel } from "../../utils/model-provider";

const DEFAULT_PRESENTATION_BRIEF_MODEL = "tencent/hy3:free";

export const briefDecisionSchema = z.object({
  reply: z.string().describe("The conversational reply shown to the user, in the user's language."),
  readyToGenerate: z
    .boolean()
    .describe("True only when enough information has been gathered and generation should start now."),
  brief: z
    .object({
      topic: z.string().describe("The presentation topic, phrased as a clear deck subject."),
      audience: z.string().describe("Target audience. Infer a sensible one if the user did not specify."),
      pageCount: z.number().int().min(3).max(30).describe("Desired slide count. Default 8 when unspecified."),
      style: z.string().describe("Visual/tonal style, e.g. technical tutorial, executive keynote, product launch."),
      requirements: z
        .string()
        .describe("Everything else the user asked for: must-have sections, emphasis, constraints, language."),
    })
    .nullable()
    .describe("The extracted brief. Required (non-null) when readyToGenerate is true, otherwise null."),
});

export type BriefDecision = z.infer<typeof briefDecisionSchema>;

export const presentationBriefConversationAgent = new Agent({
  id: "presentation-brief-conversation-agent",
  name: "Presentation Brief Conversation Agent",
  instructions: `You are Presentation Buddy, a presentation-building agent. You talk with the user to understand what deck they need, then decide on your own when to start generating it.

You receive the full conversation history. Always ground your reply in everything said so far — never ignore or re-ask for information the user already provided.

Decision policy:
- Your goal is to fill in: topic, audience, pageCount, style, and any special requirements.
- If the topic is still unclear, ask for it — that is the only hard requirement.
- If the topic is known but audience/pageCount/style are missing, ask for the missing pieces ONCE, in a single short message, and propose concrete defaults (e.g. "不说的话我就按 8 页、面向开发者的技术教程风格来做").
- After the user answers a clarifying round — even partially — do NOT ask again. Fill any remaining gaps with sensible defaults yourself and set readyToGenerate to true.
- If the user's very first message already contains enough (topic plus at least audience or style or page count), skip questions entirely and set readyToGenerate to true.
- If the user explicitly says to proceed ("开始吧", "可以", "确认", "直接生成", etc.), set readyToGenerate to true immediately with your best-effort brief.
- If a deck was already generated and the user asks for changes, treat it as a revision: set readyToGenerate to true and fold the requested changes into the brief's requirements.

When readyToGenerate is true:
- brief must be fully populated (never null). Write topic/audience/style/requirements in the user's language.
- reply should briefly restate what you are about to build (topic, audience, page count, style) and say generation is starting — the system really does start it, so never ask for further confirmation.

When readyToGenerate is false:
- brief must be null.
- reply contains your clarifying question(s), maximum three, phrased warmly and concretely.

Style rules:
- Reply in the user's language (Chinese for Chinese input).
- Be specific and concise — this is a chat panel, not a document.
- Never claim generation already finished; never output markdown code fences.`,
  model: getConfiguredModel(
    process.env.PRESENTATION_BRIEF_MODEL,
    DEFAULT_PRESENTATION_BRIEF_MODEL,
    process.env.PRESENTATION_BRIEF_PROVIDER,
  ),
});
