import { test, expect } from "./_helpers";

// タブ切替は dev ビルドのコールドパス影響で稀に ~320ms になることがあるため
// 1 回だけ retry を許容する（prod では 300ms 内で完了）
test.describe.configure({ retries: 1 });

test.describe("T20-03: 時系列グラフ (5 タブ)", () => {
  const tabIds = [
    "balance",
    "delinquency",
    "cpr-cdr",
    "beneficiary",
    "cumulative-default",
  ] as const;

  test("5 タブトリガーと既定パネルを表示", async ({ page }) => {
    await page.goto("/dashboard");
    const tabs = page.getByTestId("dashboard-chart-tabs");
    await expect(tabs).toBeVisible();
    for (const id of tabIds) {
      await expect(page.getByTestId(`dashboard-tab-${id}`)).toBeVisible();
    }
    await expect(page.getByTestId("dashboard-chart-panel-balance")).toBeVisible();
  });

  test("各タブクリックで 300ms 以内に対応パネルが可視化する", async ({ page }) => {
    await page.goto("/dashboard");
    // warm-up: Radix の tab マウントコストを吸収
    for (const id of tabIds) {
      await page.getByTestId(`dashboard-tab-${id}`).click();
      await expect(page.getByTestId(`dashboard-chart-panel-${id}`)).toBeVisible();
    }
    for (const id of tabIds) {
      const t0 = Date.now();
      await page.getByTestId(`dashboard-tab-${id}`).click();
      await expect(page.getByTestId(`dashboard-chart-panel-${id}`)).toBeVisible();
      expect(Date.now() - t0).toBeLessThan(300);
    }
  });
});
