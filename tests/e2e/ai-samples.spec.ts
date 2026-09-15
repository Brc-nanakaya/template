import { test, expect } from "@playwright/test";

test.describe("AI サンプルページ（モックモード）", () => {
  test("ワークフローを実行して結果が表示される", async ({ page }) => {
    await page.goto("/ai-samples");
    await expect(page.getByTestId("ai-samples-title")).toBeVisible();

    await page.getByTestId("workflow-input").fill("テスト用の長い文章です。");
    await page.getByTestId("workflow-run").click();

    await expect(page.getByTestId("workflow-reply")).toContainText(
      "タイトル案",
    );
    await expect(page.getByTestId("ai-steps").locator("li")).toHaveCount(3);
  });

  test("エージェントに質問して結果が表示される", async ({ page }) => {
    await page.goto("/ai-samples");
    await page.getByTestId("tab-agent").click();

    await page.getByTestId("agent-input").fill("6 × 7 はいくつ？");
    await page.getByTestId("agent-run").click();

    await expect(page.getByTestId("agent-reply")).toContainText("モック応答");
    await expect(page.getByTestId("agent-result")).toContainText("calculate");
  });
});
