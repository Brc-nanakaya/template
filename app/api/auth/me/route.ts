import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";

export const runtime = "nodejs";

/** ログイン中ユーザーの取得。クライアント側の表示切り替えに使う */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  return NextResponse.json({ user });
}
