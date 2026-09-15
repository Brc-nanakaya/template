import { NextResponse } from "next/server";
import {
  type ChatMessage,
  isChatMockMode,
  mockChatReply,
  runChat,
} from "@/lib/ai/chat";

export const runtime = "nodejs";

/** messages 配列が ChatMessage[] として妥当かを検証する。 */
function isValidMessages(value: unknown): value is ChatMessage[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (m) =>
        m &&
        typeof m === "object" &&
        ["system", "user", "assistant"].includes((m as ChatMessage).role) &&
        typeof (m as ChatMessage).content === "string",
    )
  );
}

/**
 * チャット応答 API。
 * POST { messages: ChatMessage[] } → { reply: string }
 */
export async function POST(req: Request) {
  let messages: unknown;
  try {
    ({ messages } = await req.json());
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!isValidMessages(messages)) {
    return NextResponse.json(
      { error: "messages は空でない ChatMessage 配列である必要があります" },
      { status: 400 },
    );
  }

  if (isChatMockMode()) {
    return NextResponse.json({ reply: mockChatReply(messages) });
  }

  try {
    const reply = await runChat(messages);
    return NextResponse.json({ reply });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "チャット応答の生成に失敗しました", detail },
      { status: 500 },
    );
  }
}
