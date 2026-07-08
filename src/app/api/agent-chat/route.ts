import { mastra } from "@/src/mastra";
import { briefDecisionSchema } from "@/src/mastra/agents/presentation-brief-conversation-agent";
import type { ModelMessage } from "ai";
import { NextResponse } from "next/server";
import z from "zod";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1),
});

const agentChatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1),
  hasGeneratedDeck: z.boolean().optional(),
});

// Keep the request bounded; the agent only needs recent turns to stay coherent.
const MAX_HISTORY_MESSAGES = 20;

type BriefDecision = z.infer<typeof briefDecisionSchema>;
type ConversationAgent = ReturnType<typeof mastra.getAgent>;

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    const objectMatch = candidate.match(/\{[\s\S]*\}/);
    if (!objectMatch?.[0]) {
      throw new Error("Model did not return a JSON object");
    }

    return JSON.parse(objectMatch[0]);
  }
}

async function generateBriefDecisionStructured(
  conversationAgent: ConversationAgent,
  history: ModelMessage[],
): Promise<BriefDecision | undefined> {
  const result = await conversationAgent.generate(history, {
    structuredOutput: {
      schema: briefDecisionSchema,
    },
  });

  return result.object as BriefDecision | undefined;
}

async function generateBriefDecisionFallback(
  conversationAgent: ConversationAgent,
  history: ModelMessage[],
): Promise<BriefDecision> {
  const result = await conversationAgent.generate([
    ...history,
    {
      role: "user",
      content: `Return the next assistant decision as strict JSON only. Do not wrap it in Markdown.

The JSON shape must be:
{
  "reply": "string shown to the user",
  "readyToGenerate": boolean,
  "brief": null | {
    "topic": "string",
    "audience": "string",
    "pageCount": number,
    "style": "string",
    "requirements": "string"
  }
}`,
    },
  ]);

  const text = typeof result.text === "string" ? result.text : "";
  const parsed = parseJsonObject(text);

  return briefDecisionSchema.parse(parsed);
}

async function generateBriefDecision(
  conversationAgent: ConversationAgent,
  history: ModelMessage[],
) {
  try {
    return await generateBriefDecisionStructured(conversationAgent, history);
  } catch (structuredError) {
    console.warn("Presentation brief structured output failed; retrying with JSON text fallback:", {
      message: structuredError instanceof Error ? structuredError.message : String(structuredError),
    });

    return generateBriefDecisionFallback(conversationAgent, history);
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const validation = agentChatRequestSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json({ error: "Invalid agent chat request" }, { status: 400 });
  }

  const { messages, hasGeneratedDeck } = validation.data;
  const conversationAgent = mastra.getAgent("presentationBriefConversationAgent");
  const history: ModelMessage[] = messages
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => message.role === "user"
      ? { role: "user", content: message.content }
      : { role: "assistant", content: message.content });

  if (hasGeneratedDeck) {
    history.unshift({
      role: "assistant",
      content: "(context note: a deck has already been generated for this conversation; treat further requests as revisions)",
    });
  }

  try {
    const decision = await generateBriefDecision(conversationAgent, history);

    if (!decision?.reply) {
      throw new Error("Brief agent returned no structured decision");
    }

    return NextResponse.json({
      reply: decision.reply,
      readyToGenerate: decision.readyToGenerate && Boolean(decision.brief),
      brief: decision.brief,
    });
  } catch (error) {
    console.error("Presentation brief conversation failed:", error);

    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      { error: `对话模型调用失败：${message}` },
      { status: 502 },
    );
  }
}

