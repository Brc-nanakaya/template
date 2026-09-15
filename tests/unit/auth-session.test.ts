// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createSession,
  deleteSession,
  deleteUserSessions,
  getUserByToken,
  pruneExpiredSessions,
  verifyCredentials,
} from "@/lib/auth";
import { hashPassword } from "@/lib/auth/password";
import { closeDb, getDb } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import { isDbAvailable } from "./_db-available";

/**
 * セッション認証の結合テスト。専用のテストユーザーを作って毎回削除する。
 * DB が無い環境ではスキップする（`npm run db:up`）。
 */

const TEST_LOGIN_ID = "__test__session@example.com";
const TEST_PASSWORD = "test-pass-1234";

describe.runIf(process.env.DATABASE_URL)("auth/session", () => {
  let dbUp = false;
  let userId = "";

  beforeAll(async () => {
    dbUp = await isDbAvailable();
    if (!dbUp) return;
    const [row] = await getDb()
      .insert(users)
      .values({
        loginId: TEST_LOGIN_ID,
        name: "テストユーザー",
        role: "member",
        passwordHash: await hashPassword(TEST_PASSWORD),
      })
      .onConflictDoUpdate({
        target: users.loginId,
        set: { passwordHash: await hashPassword(TEST_PASSWORD) },
      })
      .returning({ id: users.id });
    userId = row!.id;
  });

  afterEach(async () => {
    if (!dbUp) return;
    await deleteUserSessions(userId);
  });

  afterAll(async () => {
    if (!dbUp) return;
    await getDb().delete(users).where(eq(users.loginId, TEST_LOGIN_ID));
    await closeDb();
  });

  it("正しい ID / パスワードで認証できる", async () => {
    if (!dbUp) return;
    const user = await verifyCredentials(TEST_LOGIN_ID, TEST_PASSWORD);
    expect(user?.id).toBe(userId);
    expect(user?.role).toBe("member");
  });

  it("ログイン ID は大文字小文字を無視する", async () => {
    if (!dbUp) return;
    const user = await verifyCredentials(
      TEST_LOGIN_ID.toUpperCase(),
      TEST_PASSWORD,
    );
    expect(user?.id).toBe(userId);
  });

  it("パスワードが違えば null", async () => {
    if (!dbUp) return;
    expect(await verifyCredentials(TEST_LOGIN_ID, "wrong-password")).toBeNull();
  });

  it("存在しないユーザーは null（例外にしない）", async () => {
    if (!dbUp) return;
    expect(
      await verifyCredentials("__test__nobody@example.com", TEST_PASSWORD),
    ).toBeNull();
  });

  it("セッションを発行してトークンからユーザーを引ける", async () => {
    if (!dbUp) return;
    const { token, expiresAt } = await createSession(userId);
    expect(token.length).toBeGreaterThan(20);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

    const user = await getUserByToken(token);
    expect(user?.id).toBe(userId);
  });

  it("生トークンは DB に保存されない（ハッシュのみ）", async () => {
    if (!dbUp) return;
    const { token } = await createSession(userId);
    const rows = await getDb()
      .select({ tokenHash: sessions.tokenHash })
      .from(sessions)
      .where(eq(sessions.userId, userId));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.tokenHash).not.toBe(token);
  });

  it("ログアウトでセッションが失効する", async () => {
    if (!dbUp) return;
    const { token } = await createSession(userId);
    await deleteSession(token);
    expect(await getUserByToken(token)).toBeNull();
  });

  it("不正・空のトークンは null", async () => {
    if (!dbUp) return;
    expect(await getUserByToken(undefined)).toBeNull();
    expect(await getUserByToken("")).toBeNull();
    expect(await getUserByToken("bogus-token")).toBeNull();
  });

  it("期限切れセッションは通らず、prune で掃除される", async () => {
    if (!dbUp) return;
    const { token } = await createSession(userId);
    // 期限を過去に書き換える
    await getDb()
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(sessions.userId, userId));

    expect(await getUserByToken(token)).toBeNull();

    await pruneExpiredSessions();
    const remaining = await getDb()
      .select({ tokenHash: sessions.tokenHash })
      .from(sessions)
      .where(eq(sessions.userId, userId));
    expect(remaining).toHaveLength(0);
  });
});
