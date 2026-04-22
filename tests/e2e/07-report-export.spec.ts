import { test, expect } from "./_helpers";

test.describe("T22-07: レポート出力", () => {
  test("/report がプレビューと 3 操作ボタンを表示する", async ({ page }) => {
    await page.goto("/report");
    await expect(page.getByTestId("report-preview-container")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId("report-btn-download-pdf")).toBeVisible();
    await expect(page.getByTestId("report-btn-copy-md")).toBeVisible();
    await expect(page.getByTestId("report-btn-download-md")).toBeVisible();
    // 8 セクションが描画されている（報告基準月が H3 以上で含まれる）
    await expect(page.getByTestId("report-preview-container")).toContainText(
      "案件概要",
    );
    await expect(page.getByTestId("report-preview-container")).toContainText(
      "当月サマリー",
    );
    await expect(page.getByTestId("report-preview-container")).toContainText(
      "翌月留意事項",
    );
  });

  test("Markdown ダウンロードで .md ファイルが保存される", async ({ page }) => {
    await page.goto("/report");
    await expect(page.getByTestId("report-preview-container")).toBeVisible({
      timeout: 15_000,
    });
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("report-btn-download-md").click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^trust-report.*\.md$/);
    const stream = await download.createReadStream();
    if (stream) {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk as Buffer);
      const content = Buffer.concat(chunks).toString("utf-8");
      expect(content).toContain("## 1. 案件概要");
      expect(content).toContain("96,651");
    }
  });

  test("PDF ボタンで window.print が呼ばれる", async ({ page }) => {
    await page.goto("/report");
    await expect(page.getByTestId("report-preview-container")).toBeVisible({
      timeout: 15_000,
    });
    await page.evaluate(() => {
      (window as unknown as { __printCalled: number }).__printCalled = 0;
      window.print = () => {
        (window as unknown as { __printCalled: number }).__printCalled += 1;
      };
    });
    await page.getByTestId("report-btn-download-pdf").click();
    const called = await page.evaluate(
      () => (window as unknown as { __printCalled: number }).__printCalled,
    );
    expect(called).toBeGreaterThanOrEqual(1);
  });
});
