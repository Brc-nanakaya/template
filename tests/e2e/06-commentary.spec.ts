import { test, expect } from "./_helpers";

test.describe("T21-06: AI 所見生成 (モックモード)", () => {
  test("生成ボタン押下から 5 秒以内に 4 セクションを含む所見を表示", async ({ page }) => {
    await page.goto("/dashboard");
    const btn = page.getByTestId("dashboard-btn-generate-commentary");
    await expect(btn).toBeVisible();

    const t0 = Date.now();
    await btn.click();
    const editor = page.getByTestId("dashboard-commentary-editor");
    await expect(editor).not.toHaveValue("", { timeout: 5_000 });
    expect(Date.now() - t0).toBeLessThan(5_000);

    const value = await editor.inputValue();
    expect(value).toContain("### 当月サマリー");
    expect(value).toContain("### 延滞デフォルト");
    expect(value).toContain("### トリガー");
    expect(value).toContain("### 翌月留意事項");
  });

  test("textarea で所見を編集できる", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-btn-generate-commentary").click();
    const editor = page.getByTestId("dashboard-commentary-editor");
    await expect(editor).not.toHaveValue("", { timeout: 5_000 });
    await editor.fill("### 手入力セクション\n自由編集テキスト");
    await expect(editor).toHaveValue(
      "### 手入力セクション\n自由編集テキスト",
    );
  });

  test("再生成ボタンで再度 API を呼び出せる", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-btn-generate-commentary").click();
    await expect(page.getByTestId("dashboard-commentary-editor")).not.toHaveValue("", {
      timeout: 5_000,
    });
    const regen = page.getByTestId("dashboard-btn-regenerate");
    await expect(regen).toBeVisible();
    await regen.click();
    // 応答が返ってきた後、モード表示が「モック」のまま維持されていることを確認
    await expect(page.getByTestId("dashboard-commentary-status")).toContainText("モック", {
      timeout: 5_000,
    });
  });
});
