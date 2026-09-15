import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, verifyCredentials } from "@/lib/auth";
import { sessionCookieOptions } from "@/lib/auth/server";

export const runtime = "nodejs";

const bodySchema = z.object({
  loginId: z.string().min(1, "ログイン ID を入力してください"),
  password: z.string().min(1, "パスワードを入力してください"),
});

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "不正なリクエストです" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" },
      { status: 400 },
    );
  }

  try {
    const user = await verifyCredentials(parsed.data.loginId, parsed.data.password);
    if (!user) {
      // ID とパスワードのどちらが違うかは伝えない
      return NextResponse.json(
        { error: "ログイン ID またはパスワードが違います" },
        { status: 401 },
      );
    }

    const { token, expiresAt } = await createSession(user.id);
    const res = NextResponse.json({ user });
    res.cookies.set({ ...sessionCookieOptions(expiresAt), value: token });
    return res;
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "ログイン処理に失敗しました（DB に接続できていない可能性があります）", detail },
      { status: 500 },
    );
  }
}
