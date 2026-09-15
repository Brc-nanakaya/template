import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * liveness プローブ。プロセスが生きているかだけを見る（DB を叩かない）。
 *
 * DB の一時的な障害でコンテナが再起動ループに入るのを防ぐため、
 * ロードバランサやオーケストレータの「生存確認」にはこちらを使う。
 *   - ECS / ALB のターゲットグループ ヘルスチェック
 *   - App Runner のヘルスチェックパス
 *   - Container Apps の Liveness プローブ
 *
 * DB まで含めた確認（readiness）は `/api/health` を使う。
 */
export async function GET() {
  return NextResponse.json({ status: "ok", uptimeSec: Math.round(process.uptime()) });
}
