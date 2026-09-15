import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { getRagRuntimeStatus } from "@/lib/rag/config";
import { listRagDocuments } from "@/lib/rag/db";

export const runtime = "nodejs";

export async function GET() {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const documents = await listRagDocuments();
    return NextResponse.json({
      ...getRagRuntimeStatus(),
      documents,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "RAG 状態の取得に失敗しました", detail },
      { status: 500 },
    );
  }
}
