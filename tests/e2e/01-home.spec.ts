import { test, expect } from "./_helpers";

test.describe("T20-01: トップページ", () => {
  test("タイトル・サブタイトル・CTA・アップロード領域が表示される", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("home-title")).toBeVisible();
    await expect(page.getByTestId("home-subtitle")).toBeVisible();
    await expect(page.getByTestId("home-btn-load-sample")).toBeVisible();
    await expect(page.getByTestId("home-upload-area")).toBeVisible();
    await expect(page.getByTestId("home-input-file")).toBeAttached();
  });

  test("アップロード前の「データで進む」ボタンは disabled", async ({ page }) => {
    await page.goto("/");
    const goBtn = page.getByTestId("home-btn-go-dashboard");
    await expect(goBtn).toBeVisible();
    await expect(goBtn).toBeDisabled();
  });

  test("サンプルデータ CTA で /dashboard に遷移する", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("home-btn-load-sample").click();
    await page.waitForURL("**/dashboard");
    await expect(page.getByTestId("dashboard-main")).toBeVisible();
  });
});
