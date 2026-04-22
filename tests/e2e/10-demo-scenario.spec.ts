import { test, expect } from "./_helpers";

/**
 * T23: デモシナリオ通し E2E
 * トップ → サンプル読込 → アラートクリック → 延滞タブ → 債権一覧展開 →
 * 東京都検索 → 詳細遷移 → 戻る → AI 所見生成 → Markdownダウンロード
 */

test.describe("T23-10: デモ通しシナリオ", () => {
  test("トップから Markdown ダウンロードまで通貫する", async ({ page }) => {
    // 0. 既存の localStorage をクリアしてツアー挙動を固定化
    await page.context().addInitScript(() => {
      try {
        window.localStorage.setItem("trust:tour-seen", "true");
      } catch {}
    });

    // 1. トップ
    await page.goto("/");
    await expect(page.getByTestId("home-title")).toBeVisible();
    await page.getByTestId("home-btn-load-sample").click();
    await page.waitForURL("**/dashboard");

    // 2. ダッシュボード着地
    await expect(page.getByTestId("dashboard-main")).toBeVisible();
    await expect(page.getByTestId("dashboard-anomaly-banner")).toBeVisible();

    // 3. アラートクリック（最初の high）
    await page.getByTestId("dashboard-anomaly-item-0").click();
    await page.waitForTimeout(300);

    // 4. 延滞タブ
    await page.getByTestId("dashboard-tab-delinquency").click();
    await expect(page.getByTestId("dashboard-chart-panel-delinquency")).toBeVisible();

    // 5. 個別債権アコーディオンの delinquent パネル
    const delPanel = page.getByTestId("dashboard-loan-panel-delinquent");
    await expect(delPanel).toBeVisible();

    // 6. 神奈川県で検索（延滞債権が複数ヒットする）
    await page.getByTestId("dashboard-loan-search").fill("神奈川");
    const firstFiltered = delPanel
      .locator('[data-testid^="dashboard-loan-row-"]')
      .first();
    await expect(firstFiltered).toBeVisible();

    // 7. 詳細ページへ遷移
    const firstId = await firstFiltered.getAttribute("data-testid");
    await firstFiltered.click();
    await page.waitForURL(/\/dashboard\/loan-detail\/[A-Z0-9]+/);
    await expect(page.getByTestId("loan-detail-id")).toBeVisible();

    // 8. 戻る
    await page.getByTestId("loan-detail-back").click();
    await page.waitForURL("**/dashboard");
    await expect(page.getByTestId("dashboard-main")).toBeVisible();

    // 9. AI 所見生成
    await page.getByTestId("dashboard-btn-generate-commentary").click();
    const editor = page.getByTestId("dashboard-commentary-editor");
    await expect(editor).not.toHaveValue("", { timeout: 5_000 });
    const text = await editor.inputValue();
    expect(text).toContain("### 当月サマリー");

    // 10. レポートに反映 → /report へ
    await page.getByTestId("dashboard-btn-apply-commentary").click();
    await page.waitForURL("**/report");
    await expect(page.getByTestId("report-preview-container")).toBeVisible({
      timeout: 10_000,
    });

    // 11. Markdown ダウンロード
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("report-btn-download-md").click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^trust-report.*\.md$/);

    // firstId は参考情報として検証
    expect(firstId).toMatch(/^dashboard-loan-row-[A-Z0-9]+$/);
  });
});
