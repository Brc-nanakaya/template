import { NextResponse } from "next/server";
import { deleteDataset, getDataset } from "@/lib/analysis/db";
import { getApiUser } from "@/lib/auth/server";

export const runtime = "nodejs";

type RouteContext = { params: { id: string } };

/** データセット詳細（行データ含む） */
export async function GET(_req: Request, { params }: RouteContext) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const dataset = await getDataset(params.id);
    if (!dataset) {
      return NextResponse.json(
        { error: "データセットが見つかりません" },
        { status: 404 },
      );
    }
    return NextResponse.json({ dataset });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "データセットの取得に失敗しました", detail },
      { status: 500 },
    );
  }
}

/** データセット削除 */
export async function DELETE(_req: Request, { params }: RouteContext) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const ok = await deleteDataset(params.id);
    if (!ok) {
      return NextResponse.json(
        { error: "データセットが見つかりません" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "データセットの削除に失敗しました", detail },
      { status: 500 },
    );
  }
}
