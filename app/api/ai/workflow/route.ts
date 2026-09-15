import { NextResponse } from "next/server";
import { mockWorkflowResult } from "@/lib/ai/mock";
import { isMockMode, runAdkAgent } from "@/lib/ai/run";
import { createTextPipelineWorkflow } from "@/lib/ai/workflow";

export const runtime = "nodejs";

/**
 * AI ワークフロー実行 API。
 * POST { text: string } → { reply: string, steps: AiStep[] }
 */
export async function POST(req: Request) {
  let text: unknown;
  try {
    ({ text } = await req.json());
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (typeof text !== "string" || text.trim() === "") {
    return NextResponse.json({ error: "text は必須です" }, { status: 400 });
  }

  if (isMockMode()) {
    return NextResponse.json(mockWorkflowResult(text));
  }

  try {
    const result = await runAdkAgent(createTextPipelineWorkflow(), text);
    return NextResponse.json(result);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "ワークフローの実行に失敗しました", detail },
      { status: 500 },
    );
  }
}
