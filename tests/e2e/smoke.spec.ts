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

test("dashboard anomaly banner shows at least one high severity alert with color coding", async ({
  page,
}) => {
  await page.goto("/dashboard");
  const banner = page.getByTestId("dashboard-anomaly-banner");
  await expect(banner).toBeVisible();
  const firstItem = page.getByTestId("dashboard-anomaly-item-0");
  await expect(firstItem).toBeVisible();
  // Top alert must be high (anomalies are sorted high→low)
  await expect(firstItem).toHaveAttribute("data-severity", "high");

  // Color coding differs per severity: high uses border-trust-danger (#B91C1C)
  const borderColor = await firstItem.evaluate(
    (el) => window.getComputedStyle(el).borderLeftColor,
  );
  // tailwind trust-danger = #B91C1C → rgb(185, 28, 28)
  expect(borderColor).toBe("rgb(185, 28, 28)");
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

test("dashboard trend charts render 5 tabs and switch within 300ms", async ({ page }) => {
  await page.goto("/dashboard");
  const tabs = page.getByTestId("dashboard-chart-tabs");
  await expect(tabs).toBeVisible();

  const tabIds = [
    "balance",
    "delinquency",
    "cpr-cdr",
    "beneficiary",
    "cumulative-default",
  ] as const;

  // All 5 tab triggers exist
  for (const id of tabIds) {
    await expect(page.getByTestId(`dashboard-tab-${id}`)).toBeVisible();
  }

  // Default tab (balance) panel should be visible
  await expect(page.getByTestId("dashboard-chart-panel-balance")).toBeVisible();

  // Switching each tab must surface its panel within 300ms (warm up first)
  for (const id of tabIds) {
    await page.getByTestId(`dashboard-tab-${id}`).click();
    await expect(page.getByTestId(`dashboard-chart-panel-${id}`)).toBeVisible();
  }
  for (const id of tabIds) {
    const start = Date.now();
    await page.getByTestId(`dashboard-tab-${id}`).click();
    await expect(page.getByTestId(`dashboard-chart-panel-${id}`)).toBeVisible();
    expect(Date.now() - start).toBeLessThan(300);
  }
});

test("dashboard portfolio breakdown shows 4 charts and 東京都 is the top prefecture", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page.getByTestId("dashboard-portfolio-grid")).toBeVisible();

  for (const id of [
    "dashboard-portfolio-interest-type",
    "dashboard-portfolio-property-type",
    "dashboard-portfolio-prefecture",
    "dashboard-portfolio-age",
  ]) {
    const card = page.getByTestId(id);
    await expect(card).toBeVisible();
    await expect(card.locator("svg").first()).toBeVisible();
  }

  // First Y-axis tick in the prefecture bar chart is the top-ranked prefecture (東京都)
  const prefCard = page.getByTestId("dashboard-portfolio-prefecture");
  const firstYTick = prefCard.locator(".recharts-yAxis .recharts-cartesian-axis-tick").first();
  await expect(firstYTick).toHaveText("東京都");
});

test("prepayment/default analysis shows 3 visuals and 借換 leads prepayment reasons", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page.getByTestId("dashboard-prepayment-default-grid")).toBeVisible();

  for (const id of [
    "dashboard-prepayment-breakdown",
    "dashboard-default-cause",
    "dashboard-default-disposal",
  ]) {
    const card = page.getByTestId(id);
    await expect(card).toBeVisible();
    await expect(card.locator("svg").first()).toBeVisible();
  }

  // 借換 must be the top-share prepayment reason — subtitle surfaces it as the max
  await expect(page.getByTestId("dashboard-prepayment-breakdown")).toContainText(
    "最大シェア: 借換",
  );
});
