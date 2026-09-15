import { test, expect } from "@playwright/test";

test.describe("法令 RAG（制度確認）", () => {
  test("トップから遷移し、評価セットの質問で根拠が出る", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("nav-rag").click();
    await expect(page).toHaveURL(/\/rag$/);
    await expect(page.getByTestId("rag-title")).toBeVisible();
    await expect(page.getByTestId("rag-verifiable")).toBeVisible();

    await page.getByTestId("rag-sample-retention-years").click();
    await page.getByTestId("rag-ask").click();
    await expect(page.getByTestId("rag-answer")).toContainText("7年");
    await expect(page.getByTestId("rag-citations")).toContainText("第6条");
  });

  test("評価セットを実行できる", async ({ page }) => {
    await page.goto("/rag");
    await page.getByTestId("rag-eval").click();
    await expect(page.getByTestId("rag-eval-report")).toContainText("5 / 5");
  });
});
