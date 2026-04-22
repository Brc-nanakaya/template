import { test, expect } from "@playwright/test";

test("home page renders title, subtitle, primary CTA and upload area", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("home-title")).toBeVisible();
  await expect(page.getByTestId("home-subtitle")).toBeVisible();
  await expect(page.getByTestId("home-btn-load-sample")).toBeVisible();
  await expect(page.getByTestId("home-upload-area")).toBeVisible();
  await expect(page.getByTestId("home-input-file")).toBeAttached();
  // go-to-dashboard button is rendered but disabled until a file is chosen
  const goBtn = page.getByTestId("home-btn-go-dashboard");
  await expect(goBtn).toBeVisible();
  await expect(goBtn).toBeDisabled();
});

test("sample-data CTA navigates to /dashboard", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("home-btn-load-sample").click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByTestId("dashboard-main")).toBeVisible();
});

test("dashboard shows header and 6 KPI cards with anchored values", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByTestId("dashboard-header")).toBeVisible();
  await expect(page.getByTestId("dashboard-header-deal-name")).toContainText("SBI新生住宅ローン信託");
  await expect(page.getByTestId("dashboard-header-report-month")).toContainText("2026年03月");

  // 6 KPI cards rendered
  for (const testId of [
    "pool-balance",
    "retention-rate",
    "delinquency-90",
    "cumulative-default",
    "senior-balance",
    "servicer-recovery",
  ]) {
    await expect(page.getByTestId(`dashboard-kpi-${testId}`)).toBeVisible();
  }

  // Anchored numeric values: pool balance ≈ 96,651百万円, delinquency 0.5-0.7%
  const poolText = await page.getByTestId("dashboard-kpi-pool-balance-value").textContent();
  expect(poolText).toMatch(/96,6\d\d\.?\d*百万円/);
  const delinqText = await page.getByTestId("dashboard-kpi-delinquency-90-value").textContent();
  const match = delinqText?.match(/([\d.]+)%/);
  expect(match).not.toBeNull();
  const rate = Number(match![1]);
  expect(rate).toBeGreaterThanOrEqual(0.5);
  expect(rate).toBeLessThanOrEqual(0.7);
});
