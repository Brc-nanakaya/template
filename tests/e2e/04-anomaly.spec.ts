import { test, expect } from "./_helpers";

test.describe("T21-04: 異常値アラートバナー", () => {
  test("少なくとも 1 件の high 重要度アラートを表示する", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("dashboard-anomaly-banner")).toBeVisible();
    const first = page.getByTestId("dashboard-anomaly-item-0");
    await expect(first).toBeVisible();
    await expect(first).toHaveAttribute("data-severity", "high");
  });

  test("severity による色分けが CSS に反映されている (high=赤)", async ({ page }) => {
    await page.goto("/dashboard");
    const first = page.getByTestId("dashboard-anomaly-item-0");
    const borderColor = await first.evaluate(
      (el) => window.getComputedStyle(el).borderLeftColor,
    );
    // trust-danger #B91C1C = rgb(185, 28, 28)
    expect(borderColor).toBe("rgb(185, 28, 28)");
  });

  test("クリックで対応セクションにスクロールする", async ({ page }) => {
    await page.goto("/dashboard");
    const first = page.getByTestId("dashboard-anomaly-item-0");
    await first.click();
    // 少し待ってスクロール位置が上部から離れることを確認
    await page.waitForTimeout(400);
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(100);
  });
});
