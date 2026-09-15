import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { loadMemoryCorpus } from "@/lib/rag/db";
import { evaluateCorpus } from "@/lib/rag/eval";

export const runtime = "nodejs";

export async function POST() {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const corpus = await loadMemoryCorpus();
    if (corpus.chunks.length === 0) {
      return NextResponse.json(
        { error: "条文が未取り込みです。npm run db:seed を実行してください" },
        { status: 409 },
      );
    }
    return NextResponse.json(evaluateCorpus(corpus));
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "評価の実行に失敗しました", detail },
      { status: 500 },
    );
  }
}
