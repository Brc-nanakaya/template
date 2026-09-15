import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { deleteRagDocument, getRagDocument } from "@/lib/rag/db";
import { deleteOrdinanceGraph } from "@/lib/rag/graph";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const doc = await getRagDocument(params.id);
    if (!doc) {
      return NextResponse.json({ error: "文書が見つかりません" }, { status: 404 });
    }
    await deleteOrdinanceGraph(doc.lawId);
    const ok = await deleteRagDocument(params.id);
    if (!ok) {
      return NextResponse.json({ error: "文書が見つかりません" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "削除に失敗しました", detail },
      { status: 500 },
    );
  }
}
