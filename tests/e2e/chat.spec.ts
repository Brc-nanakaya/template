import { test, expect, Page } from "@playwright/test";

/** localStorage を初期化してからチャットページへ。 */
async function gotoClean(page: Page) {
  await page.goto("/chat");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByTestId("chat-title")).toBeVisible();
}

async function send(page: Page, text: string) {
  await page.getByTestId("chat-input").fill(text);
  await page.getByTestId("chat-send").click();
}

test.describe("チャット（モックモード・履歴保持）", () => {
  test.beforeEach(async ({ page }) => {
    await gotoClean(page);
  });

  test("送信するとユーザーと AI の吹き出しが表示される", async ({ page }) => {
    await send(page, "こんにちは");
    await expect(page.getByTestId("chat-message-user")).toContainText("こんにちは");
    await expect(page.getByTestId("chat-message-assistant")).toContainText(
      "モック応答",
    );
  });

  test("リロード後も会話履歴が保持される", async ({ page }) => {
    await send(page, "保存テスト");
    await expect(page.getByTestId("chat-message-assistant")).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("chat-title")).toBeVisible();
    await expect(page.getByTestId("chat-message-user")).toContainText("保存テスト");
    await expect(page.getByTestId("chat-session")).toHaveCount(1);
  });

  test("「新しい会話」で別スレッドを作成できる", async ({ page }) => {
    await send(page, "一つ目の会話");
    await expect(page.getByTestId("chat-message-assistant")).toBeVisible();

    await page.getByTestId("chat-new").click();
    await expect(page.getByTestId("chat-message-user")).toHaveCount(0);

    await send(page, "二つ目の会話");
    await expect(page.getByTestId("chat-session")).toHaveCount(2);
  });
});
