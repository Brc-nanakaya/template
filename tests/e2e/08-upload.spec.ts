import path from "node:path";
import { test, expect } from "./_helpers";

const FIXTURES = path.resolve(__dirname, "fixtures");

test.describe("T22-08: CSV アップロード", () => {
  test("valid-loan-tape.csv を選択するとダッシュボード遷移ボタンが活性化", async ({ page }) => {
    await page.goto("/");
    const input = page.getByTestId("home-input-file");
    await input.setInputFiles(path.join(FIXTURES, "valid-loan-tape.csv"));
    const goBtn = page.getByTestId("home-btn-go-dashboard");
    await expect(goBtn).toBeEnabled();
    await expect(page.getByTestId("home-upload-filename")).toContainText(
      "valid-loan-tape.csv",
    );
  });

  test("ダッシュボードへの遷移が機能する（サンプル fallback 経路）", async ({ page }) => {
    await page.goto("/");
    const input = page.getByTestId("home-input-file");
    await input.setInputFiles(path.join(FIXTURES, "valid-loan-tape.csv"));
    await page.getByTestId("home-btn-go-dashboard").click();
    await page.waitForURL("**/dashboard");
    await expect(page.getByTestId("dashboard-main")).toBeVisible();
  });
});
