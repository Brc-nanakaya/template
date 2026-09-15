import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import { normalizeLoginId, verifyPassword } from "./password";

/**
 * DB セッション方式の認証。
 *
 * - Cookie には生トークンのみを入れ、DB には SHA-256 ハッシュを保存する
 * - サーバー側で失効させられる（JWT と違い即時ログアウトが可能）
 * - Cookie 検証は Node ランタイム限定。middleware（Edge）では
 *   Cookie の有無だけを見る安価なゲートに留める（`middleware.ts` 参照）
 */

export const SESSION_COOKIE = "session";
/** セッション有効期間（日）。営業デモ用途なので長めに 7 日 */
export const SESSION_TTL_DAYS = 7;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

export interface AuthUser {
  id: string;
  loginId: string;
  name: string;
  role: "admin" | "member";
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Cookie に載せる 32 バイトのランダムトークン */
function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

/** ユーザーに対して新しいセッションを発行する */
export async function createSession(userId: string): Promise<CreatedSession> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await getDb()
    .insert(sessions)
    .values({ tokenHash: hashToken(token), userId, expiresAt });

  return { token, expiresAt };
}

/** トークンからユーザーを解決する。無効・期限切れなら null */
export async function getUserByToken(
  token: string | undefined | null,
): Promise<AuthUser | null> {
  if (!token) return null;

  const rows = await getDb()
    .select({
      id: users.id,
      loginId: users.loginId,
      name: users.name,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

/** セッションを 1 件失効させる（ログアウト） */
export async function deleteSession(
  token: string | undefined | null,
): Promise<void> {
  if (!token) return;
  await getDb().delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

/** そのユーザーの全セッションを失効させる（パスワード変更時など） */
export async function deleteUserSessions(userId: string): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.userId, userId));
}

/** 期限切れセッションを掃除する */
export async function pruneExpiredSessions(): Promise<void> {
  await getDb().delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

/**
 * ログイン ID とパスワードを検証する。
 * ユーザーが存在しない場合もダミー検証を行い、応答時間からの存在推測を防ぐ。
 */
export async function verifyCredentials(
  loginId: string,
  password: string,
): Promise<AuthUser | null> {
  const normalized = normalizeLoginId(loginId);

  const rows = await getDb()
    .select({
      id: users.id,
      loginId: users.loginId,
      name: users.name,
      role: users.role,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.loginId, normalized))
    .limit(1);

  const user = rows[0];
  if (!user) {
    // タイミング差を消すためのダミー検証
    await verifyPassword(password, DUMMY_HASH);
    return null;
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;

  return {
    id: user.id,
    loginId: user.loginId,
    name: user.name,
    role: user.role,
  };
}

/** 存在しないユーザー向けのダミーハッシュ（`password` の scrypt 値） */
const DUMMY_HASH =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
  "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

/** 文字列の定数時間比較（テスト・ユーティリティ用） */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
