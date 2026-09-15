import { test, expect } from "@playwright/test";

test.describe("健康アシスタント音声ページ", () => {
  test("トップから遷移できる", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("nav-health-voice").click();
    await expect(page).toHaveURL(/\/health-voice$/);
    await expect(page.getByTestId("health-voice-title")).toBeVisible();
    await expect(page.getByTestId("voice-controls")).toBeVisible();
    await expect(page.getByTestId("health-disclaimer")).toBeVisible();
  });

  test("通話開始ボタンと文字起こしエリアが表示される", async ({ page }) => {
    await page.goto("/health-voice");
    await expect(page.getByTestId("voice-connect")).toBeVisible();
    await expect(page.getByTestId("transcript-empty")).toBeVisible();
    await expect(page.getByTestId("voice-status")).toHaveText("待機中");
  });

  test("API キー未設定時は接続エラーメッセージを出す", async ({ page }) => {
    await page.route("**/api/realtime/session", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ configured: false }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/health-voice");
    await expect(page.getByTestId("voice-key-hint")).toBeVisible();

    await page.getByTestId("voice-connect").click();
    await expect(page.getByTestId("voice-error")).toBeVisible();
    await expect(page.getByTestId("voice-error")).toContainText(
      "OPENAI_API_KEY",
    );
  });
});

