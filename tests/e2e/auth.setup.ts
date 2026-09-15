import { expect, test as setup } from "@playwright/test";
import { STORAGE_STATE } from "../../playwright.config";

/**
 * 全 E2E テストの前に 1 回だけログインし、Cookie を storageState に保存する。
 *
 * 前提: DB が起動しシードが投入されていること。
 *   npm run db:setup
 */
const LOGIN_ID = process.env.E2E_LOGIN_ID ?? "demo@example.com";
const PASSWORD = process.env.E2E_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? "demo1234";

setup("ログインしてセッションを保存する", async ({ page, request }) => {
  // DB が生きているか先に確認し、落ちている場合は原因が分かるメッセージを出す
  const health = await request.get("/api/health");
  expect(
    health.ok(),
    `DB に接続できません。\`npm run db:setup\` を実行してください（${health.status()}: ${await health.text()}）`,
  ).toBe(true);

  await page.goto("/login");
  await page.getByTestId("login-id").fill(LOGIN_ID);
  await page.getByTestId("login-password").fill(PASSWORD);
  await page.getByTestId("login-submit").click();

  // ログイン後はトップへ遷移し、共通ヘッダーにユーザー名が出る
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("header-user-name")).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
