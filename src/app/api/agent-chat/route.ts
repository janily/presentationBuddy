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
    const result = await conversationAgent.generate(history, {
      structuredOutput: {
        schema: briefDecisionSchema,
      },
    });

    const decision = result.object;

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
