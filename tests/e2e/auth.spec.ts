import { expect, test } from "@playwright/test";

/**
 * 認証まわりの E2E。ログイン前の状態を見たいので storageState を空にする。
 */
test.describe("認証", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("未ログインで保護ページを開くと /login へ飛ばされる", async ({ page }) => {
    await page.goto("/analysis");
    await expect(page).toHaveURL(/\/login\?next=%2Fanalysis$/);
    await expect(page.getByTestId("login-title")).toBeVisible();
  });

  test("未ログインの API は 401 を返す", async ({ request }) => {
    const res = await request.get("/api/analysis/datasets");
    expect(res.status()).toBe(401);
  });

  test("ヘルスチェックは認証不要で通る", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBe(true);
    expect((await res.json()).db).toBe("ok");
  });

  test("誤ったパスワードではエラーが表示される", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-id").fill("demo@example.com");
    await page.getByTestId("login-password").fill("wrong-password");
    await page.getByTestId("login-submit").click();

    await expect(page.getByTestId("login-error")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("ログインすると元のページへ戻る", async ({ page }) => {
    await page.goto("/analysis");
    await expect(page).toHaveURL(/\/login/);

    await page.getByTestId("login-id").fill("demo@example.com");
    await page.getByTestId("login-password").fill("demo1234");
    await page.getByTestId("login-submit").click();

    await expect(page).toHaveURL(/\/analysis$/);
    await expect(page.getByTestId("header-user-name")).toBeVisible();
  });

  test("ログアウトすると保護ページに入れなくなる", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("login-id").fill("demo@example.com");
    await page.getByTestId("login-password").fill("demo1234");
    await page.getByTestId("login-submit").click();
    await expect(page.getByTestId("header-user-name")).toBeVisible();

    await page.getByTestId("logout-button").click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/todo");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("ログイン済み", () => {
  test("ヘッダーにユーザー名とログアウトが出る", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("header-user-name")).toContainText("デモ管理者");
    await expect(page.getByTestId("logout-button")).toBeVisible();
  });

  test("ログイン済みで /login を開くとトップへリダイレクトされる", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/$/);
  });

  test("/api/auth/me でログイン中のユーザーが返る", async ({ request }) => {
    const res = await request.get("/api/auth/me");
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.user.loginId).toBe("demo@example.com");
    expect(body.user.role).toBe("admin");
    // パスワードハッシュを返していない
    expect(JSON.stringify(body)).not.toContain("scrypt");
  });
});
