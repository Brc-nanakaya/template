import { test, expect } from "@playwright/test";

test.describe("トップページ（業界別アプリ）", () => {
  test("業界セクションと各アプリカードが表示される", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("app-title")).toHaveText("アプリ一覧");
    await expect(page.getByTestId("industry-nav")).toBeVisible();
    await expect(page.getByTestId("industry-automotive")).toBeVisible();
    await expect(page.getByTestId("industry-finance")).toBeVisible();
    await expect(page.getByTestId("industry-healthcare")).toBeVisible();
    await expect(page.getByTestId("industry-common")).toBeVisible();
    await expect(page.getByTestId("nav-todo")).toBeVisible();
    await expect(page.getByTestId("nav-analysis")).toBeVisible();
    await expect(page.getByTestId("nav-health-voice")).toBeVisible();
    await expect(page.getByTestId("nav-chat")).toBeVisible();
    await expect(page.getByTestId("nav-rag")).toBeVisible();
    await expect(page.getByTestId("nav-ai-samples")).toBeVisible();
  });

  test("業界ナビから金融セクションへ移動できる", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("industry-nav-finance").click();
    await expect(page).toHaveURL(/#industry-finance$/);
    await expect(page.getByTestId("industry-finance")).toBeInViewport();
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
