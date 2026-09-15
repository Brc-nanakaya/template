import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { getGraphStats } from "@/lib/rag/graph";
import { refreshReferencesAndGraph } from "@/lib/rag/graph-sync";

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
    const result = await refreshReferencesAndGraph();
    return NextResponse.json({
      ok: true,
      ...result,
      graph: await getGraphStats(),
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "グラフ同期に失敗しました", detail },
      { status: 500 },
    );
  }
}
