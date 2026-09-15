import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  getUserByToken,
  type AuthUser,
} from "./session";

/**
 * サーバーコンポーネント / API ルート（Node ランタイム）向けの認証ヘルパー。
 * middleware は Cookie の有無しか見ないため、実際の検証はここで行う。
 */

/** Cookie 属性。本番（HTTPS）では Secure を付ける */
export function sessionCookieOptions(expiresAt: Date) {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

export function clearedSessionCookieOptions() {
  return {
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}

/** ログイン中のユーザー。未ログインなら null */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    return await getUserByToken(token);
  } catch {
    // DB 未起動でもページが 500 で落ちないようにする（未ログイン扱い）
    return null;
  }
}

/**
 * ログイン必須のサーバーコンポーネントで使う。
 * 未ログインなら /login へリダイレクトする。
 */
export async function requireUser(redirectTo?: string): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) {
    const next = redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : "";
    redirect(`/login${next}`);
  }
  return user;
}

/** API ルートでログイン必須にする。未ログインなら null を返す */
export async function getApiUser(): Promise<AuthUser | null> {
  return getCurrentUser();
}
