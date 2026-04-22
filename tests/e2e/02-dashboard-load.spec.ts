import { test, expect } from "./_helpers";

test.describe("T20-02: ダッシュボードロード", () => {
  test("10秒以内にロードし、案件ヘッダーと 6 KPI を表示", async ({ page }) => {
    const start = Date.now();
    await page.goto("/dashboard");
    await expect(page.getByTestId("dashboard-header")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("dashboard-header-deal-name")).toContainText(
      "SBI新生住宅ローン信託",
    );
    await expect(page.getByTestId("dashboard-header-report-month")).toContainText("2026年03月");

    const kpiIds = [
      "pool-balance",
      "retention-rate",
      "delinquency-90",
      "cumulative-default",
      "senior-balance",
      "servicer-recovery",
    ] as const;
    for (const id of kpiIds) {
      await expect(page.getByTestId(`dashboard-kpi-${id}`)).toBeVisible();
    }

    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(10_000);
  });

  test("プール残高 96,651±100 百万円・延滞率 0.5-0.7% を表示", async ({ page }) => {
    await page.goto("/dashboard");
    const poolText = await page.getByTestId("dashboard-kpi-pool-balance-value").textContent();
    expect(poolText).toMatch(/96,6\d\d(\.\d)?百万円/);
    const delinqText = await page
      .getByTestId("dashboard-kpi-delinquency-90-value")
      .textContent();
    const m = delinqText?.match(/([\d.]+)%/);
    expect(m).not.toBeNull();
    const rate = Number(m![1]);
    expect(rate).toBeGreaterThanOrEqual(0.5);
    expect(rate).toBeLessThanOrEqual(0.7);
  });

  test("4 分割のポートフォリオ構成と「借換」最大シェアを表示", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("dashboard-portfolio-grid")).toBeVisible();
    for (const id of [
      "dashboard-portfolio-interest-type",
      "dashboard-portfolio-property-type",
      "dashboard-portfolio-prefecture",
      "dashboard-portfolio-age",
    ]) {
      await expect(page.getByTestId(id)).toBeVisible();
    }
    await expect(page.getByTestId("dashboard-prepayment-breakdown")).toContainText(
      "最大シェア: 借換",
    );
  });
});
