import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { hashPassword, normalizeLoginId, PASSWORD_MIN_LENGTH } from "@/lib/auth/password";
import { connectForScript } from "@/lib/db/env";
import * as schema from "@/lib/db/schema";
import { sessions, users } from "@/lib/db/schema";

/**
 * ユーザーの追加 / パスワード変更 / 一覧 / 削除。
 * 営業担当のアカウントを増やすときに使う。
 *
 *   npm run db:user -- add <loginId> <password> [--name "表示名"] [--admin]
 *   npm run db:user -- passwd <loginId> <newPassword>
 *   npm run db:user -- list
 *   npm run db:user -- remove <loginId>
 */

function usage(): never {
  console.log(
    [
      "使い方:",
      "  npm run db:user -- add <loginId> <password> [--name \"表示名\"] [--admin]",
      "  npm run db:user -- passwd <loginId> <newPassword>",
      "  npm run db:user -- list",
      "  npm run db:user -- remove <loginId>",
    ].join("\n"),
  );
  process.exit(1);
}

function flagValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  if (!command) usage();

  const sql = connectForScript();
  const db = drizzle(sql, { schema });

  try {
    if (command === "list") {
      const rows = await db
        .select({
          loginId: users.loginId,
          name: users.name,
          role: users.role,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(users.createdAt);
      if (rows.length === 0) {
        console.log("ユーザーがいません。`npm run db:seed` を実行してください");
        return;
      }
      for (const r of rows) {
        console.log(
          `${r.loginId.padEnd(28)} ${r.role.padEnd(7)} ${r.name}  (${r.createdAt.toISOString().slice(0, 10)})`,
        );
      }
      return;
    }

    if (command === "add" || command === "passwd") {
      const loginIdRaw = args[1];
      const password = args[2];
      if (!loginIdRaw || !password) usage();
      if (password.length < PASSWORD_MIN_LENGTH) {
        console.error(`❌ パスワードは ${PASSWORD_MIN_LENGTH} 文字以上にしてください`);
        process.exit(1);
      }

      const loginId = normalizeLoginId(loginIdRaw);
      const passwordHash = await hashPassword(password);

      if (command === "add") {
        const name = flagValue(args, "--name") ?? loginId;
        const role = args.includes("--admin") ? "admin" : "member";
        await db
          .insert(users)
          .values({ loginId, name, role, passwordHash })
          .onConflictDoUpdate({
            target: users.loginId,
            set: { name, role, passwordHash, updatedAt: new Date() },
          });
        console.log(`✅ ${loginId} を登録しました（role=${role}）`);
        return;
      }

      const updated = await db
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.loginId, loginId))
        .returning({ id: users.id });

      if (updated.length === 0) {
        console.error(`❌ ${loginId} が見つかりません`);
        process.exit(1);
      }
      // パスワード変更時は既存セッションを全て失効させる
      await db.delete(sessions).where(eq(sessions.userId, updated[0]!.id));
      console.log(`✅ ${loginId} のパスワードを変更し、既存セッションを失効させました`);
      return;
    }

    if (command === "remove") {
      const loginIdRaw = args[1];
      if (!loginIdRaw) usage();
      const loginId = normalizeLoginId(loginIdRaw);
      const deleted = await db
        .delete(users)
        .where(eq(users.loginId, loginId))
        .returning({ id: users.id });
      if (deleted.length === 0) {
        console.error(`❌ ${loginId} が見つかりません`);
        process.exit(1);
      }
      console.log(`✅ ${loginId} を削除しました`);
      return;
    }

    usage();
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error("❌ 失敗\n", e);
  process.exit(1);
});
