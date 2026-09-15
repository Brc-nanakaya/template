import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { askRag } from "@/lib/rag/ask";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  let question: unknown;
  try {
    ({ question } = await req.json());
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (typeof question !== "string") {
    return NextResponse.json(
      { error: "question は文字列である必要があります" },
      { status: 400 },
    );
  }

  try {
    const result = await askRag(question);
    return NextResponse.json(result);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "回答の生成に失敗しました", detail },
      { status: 500 },
    );
  }
}
