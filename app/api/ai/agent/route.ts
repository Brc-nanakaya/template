import { NextResponse } from "next/server";
import { createAssistantAgent } from "@/lib/ai/agent";
import { mockAgentResult } from "@/lib/ai/mock";
import { isMockMode, runAdkAgent } from "@/lib/ai/run";

export const runtime = "nodejs";

/**
 * AI エージェント実行 API。
 * POST { message: string } → { reply: string, steps: AiStep[] }
 */
export async function POST(req: Request) {
  let message: unknown;
  try {
    ({ message } = await req.json());
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (typeof message !== "string" || message.trim() === "") {
    return NextResponse.json(
      { error: "message は必須です" },
      { status: 400 },
    );
  }

  if (isMockMode()) {
    return NextResponse.json(mockAgentResult(message));
  }

  try {
    const result = await runAdkAgent(createAssistantAgent(), message);
    return NextResponse.json(result);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "エージェントの実行に失敗しました", detail },
      { status: 500 },
    );
  }
}
