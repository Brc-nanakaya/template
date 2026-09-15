import { test, expect } from "@playwright/test";

test.describe("トップページ（機能ハブ）", () => {
  test("タイトルと各機能へのカードが表示される", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("app-title")).toBeVisible();
    await expect(page.getByTestId("nav-todo")).toBeVisible();
    await expect(page.getByTestId("nav-analysis")).toBeVisible();
    await expect(page.getByTestId("nav-health-voice")).toBeVisible();
    await expect(page.getByTestId("nav-chat")).toBeVisible();
    await expect(page.getByTestId("nav-rag")).toBeVisible();
    await expect(page.getByTestId("nav-ai-samples")).toBeVisible();
  });

  test("ToDo カードから ToDo 管理ページへ遷移できる", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("nav-todo").click();
    await expect(page).toHaveURL(/\/todo$/);
    await expect(page.getByTestId("todo-form")).toBeVisible();
  });

  test("チャットカードからチャットページへ遷移できる", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("nav-chat").click();
    await expect(page).toHaveURL(/\/chat$/);
    await expect(page.getByTestId("chat-title")).toBeVisible();
  });

  test("AI サンプルカードから AI サンプルページへ遷移できる", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("nav-ai-samples").click();
    await expect(page).toHaveURL(/\/ai-samples$/);
    await expect(page.getByTestId("ai-samples-title")).toBeVisible();
  });
});
