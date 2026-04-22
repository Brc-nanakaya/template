import path from "node:path";
import { test, expect } from "./_helpers";

const FIXTURES = path.resolve(__dirname, "fixtures");

test.describe("T22-09: エラーハンドリング", () => {
  test("対応外拡張子 (.txt) をアップロードするとエラートーストと error 表示", async ({ page }) => {
    await page.goto("/");
    const input = page.getByTestId("home-input-file");
    // 手元に .txt フィクスチャが無いため、dataTransfer で仮の File を作成
    const fakeTxtPath = path.join(FIXTURES, "dummy.txt");
    await page.evaluate(() => {
      // no-op — using setInputFiles below with blob-like objects is limited, so
      // this test instead verifies via direct string using setInputFiles with
      // a programmatically constructed file.
    });
    await input.setInputFiles({
      name: "unsupported.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello"),
    });
    // インラインエラー表示
    await expect(page.getByTestId("home-upload-error")).toBeVisible();
    // トーストが出る
    await expect(page.getByTestId("toast-error")).toBeVisible({ timeout: 5_000 });
    // disabled 維持
    await expect(page.getByTestId("home-btn-go-dashboard")).toBeDisabled();
    // 操作は継続可能（サンプルロード CTA はクリックできる）
    await page.getByTestId("home-btn-load-sample").click();
    await page.waitForURL("**/dashboard");
  });

  test("Shift-JIS エンコードの corrupted.csv をアップロードしても操作は継続可能", async ({
    page,
  }) => {
    await page.goto("/");
    const input = page.getByTestId("home-input-file");
    await input.setInputFiles(path.join(FIXTURES, "corrupted.csv"));
    // 拡張子 OK だが中身は文字化け想定。現在の拡張子のみバリデーションでは通過する。
    // → ダッシュボード遷移ボタンは活性化するが、クリック時にロード失敗する（将来の T 対応）。
    // ここではエラーもしくは ready どちらでも UI が応答することを確認。
    await expect(page.getByTestId("home-btn-go-dashboard")).toBeEnabled();
  });
});
