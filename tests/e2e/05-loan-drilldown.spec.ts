import { test, expect } from "./_helpers";

test.describe("T21-05: 個別債権ドリルダウン", () => {
  test("アコーディオン展開と検索フィルタが機能する", async ({ page }) => {
    await page.goto("/dashboard");
    const accordion = page.getByTestId("dashboard-loan-accordion");
    await expect(accordion).toBeVisible();

    // delinquent は既定で展開
    const delPanel = page.getByTestId("dashboard-loan-panel-delinquent");
    await expect(delPanel).toBeVisible();
    const rowsBefore = await delPanel.locator('[data-testid^="dashboard-loan-row-"]').count();
    expect(rowsBefore).toBeGreaterThan(0);

    // 検索で絞り込み（延滞債権には東京都がないため神奈川県で検証）
    await page.getByTestId("dashboard-loan-search").fill("神奈川");
    const rowsAfter = await delPanel
      .locator('[data-testid^="dashboard-loan-row-"]')
      .count();
    expect(rowsAfter).toBeLessThanOrEqual(rowsBefore);
    expect(rowsAfter).toBeGreaterThan(0);
  });

  test("「現在残高」列でソート（昇降両方）", async ({ page }) => {
    await page.goto("/dashboard");
    const sortBtn = page.getByTestId("dashboard-loan-sort-current-balance").first();

    // 初期: desc（コンポーネント初期設定）
    await expect(sortBtn).toHaveAttribute("data-sort-dir", "desc");
    // 1 クリックで asc
    await sortBtn.click();
    await expect(sortBtn).toHaveAttribute("data-sort-dir", "asc");
    // さらにクリックで desc
    await sortBtn.click();
    await expect(sortBtn).toHaveAttribute("data-sort-dir", "desc");
  });

  test("行クリックで詳細ページへ遷移し、該当債権情報を表示", async ({ page }) => {
    await page.goto("/dashboard");
    const delPanel = page.getByTestId("dashboard-loan-panel-delinquent");
    const firstRow = delPanel.locator('[data-testid^="dashboard-loan-row-"]').first();
    const loanId = await firstRow.getAttribute("data-testid");
    await firstRow.click();
    await page.waitForURL(/\/dashboard\/loan-detail\/[A-Z0-9]+/);
    await expect(page.getByTestId("loan-detail-id")).toBeVisible();
    if (loanId) {
      const actual = await page.getByTestId("loan-detail-id").textContent();
      const expectedId = loanId.replace("dashboard-loan-row-", "");
      expect(actual).toContain(expectedId);
    }
    await expect(page.getByTestId("loan-detail-current-balance")).toBeVisible();
  });
});
