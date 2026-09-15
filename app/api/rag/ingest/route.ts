import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { ingestDemoCorpus } from "@/lib/rag/ingest";

export const runtime = "nodejs";

export async function POST() {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const ingested = await ingestDemoCorpus({ force: true });
    return NextResponse.json({ ingested });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "デモ条文の取り込みに失敗しました", detail },
      { status: 500 },
    );
  }
}
