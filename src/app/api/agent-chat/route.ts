import { mastra } from "@/src/mastra";
import { NextResponse } from "next/server";
import z from "zod";

const agentChatRequestSchema = z.object({
  message: z.string().trim().min(1),
  pendingRequest: z.string().trim().optional(),
});

function fallbackBriefReply(message: string, pendingRequest?: string) {
  const combined = [pendingRequest, message].filter(Boolean).join("\n");

  return `我理解你想做的是：${combined}\n\n在开始生成前，我还需要确认几个关键信息：\n1. 目标受众是谁？\n2. 期望页数是多少？\n3. 风格更偏技术教程、商务汇报，还是产品发布？\n\n如果这些信息已经包含在你的描述里，并且方向没问题，请回复“确认生成”。`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const validation = agentChatRequestSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json({ error: "Invalid agent chat request" }, { status: 400 });
  }

  const { message, pendingRequest } = validation.data;
  const conversationAgent = mastra.getAgent("presentationBriefConversationAgent");

  try {
    const result = await conversationAgent.generate([
      {
        role: "user",
        content: `Existing unconfirmed requirements:\n${pendingRequest || "(none)"}\n\nLatest user message:\n${message}\n\nRespond as the brief conversation agent.`,
      },
    ]);
    const reply = result.text?.trim() || fallbackBriefReply(message, pendingRequest);

    return NextResponse.json({ reply });
  } catch (error) {
    console.error("Presentation brief conversation failed:", error);

    return NextResponse.json({ reply: fallbackBriefReply(message, pendingRequest) });
  }
}
