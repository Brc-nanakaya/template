import { NextResponse } from "next/server";
import { pingDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * readiness プローブ。DB へ到達できるかまで確認する。
 * 認証不要（`middleware.ts` の PUBLIC_PATHS）。
 *
 * オーケストレータの「生存確認」には DB に依存しない
 * `/api/health/live` を使うこと（DB 障害での再起動ループを避ける）。
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    await pingDb();
    return NextResponse.json({
      status: "ok",
      db: "ok",
      latencyMs: Date.now() - startedAt,
    });
  } catch (e) {
    return NextResponse.json(
      {
        status: "degraded",
        db: "error",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 503 },
    );
  }
}
