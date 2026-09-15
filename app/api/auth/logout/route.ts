import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, deleteSession } from "@/lib/auth";
import { clearedSessionCookieOptions } from "@/lib/auth/server";

export const runtime = "nodejs";

export async function POST() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  try {
    await deleteSession(token);
  } catch {
    // DB に届かなくても Cookie は必ず消す
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(clearedSessionCookieOptions());
  return res;
}
