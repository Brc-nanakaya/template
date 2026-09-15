import { test, expect, Page } from "@playwright/test";

/** localStorage を初期化してから ToDo ページへ。テスト間の独立性を確保する。 */
async function gotoClean(page: Page) {
  await page.goto("/todo");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByTestId("app-title")).toBeVisible();
}

async function addTodo(page: Page, title: string) {
  await page.getByTestId("todo-input-title").fill(title);
  await page.getByTestId("todo-add-button").click();
}

test.describe("ToDo 管理", () => {
  test.beforeEach(async ({ page }) => {
    await gotoClean(page);
  });

  test("タスクを追加すると一覧に表示される", async ({ page }) => {
    await addTodo(page, "資料を作成する");
    const items = page.getByTestId("todo-item");
    await expect(items).toHaveCount(1);
    await expect(page.getByTestId("todo-title")).toHaveText("資料を作成する");
    await expect(page.getByTestId("stat-total")).toContainText("1");
  });

  test("完了トグルで打ち消し線スタイルになる", async ({ page }) => {
    await addTodo(page, "牛乳を買う");
    await page.getByTestId("todo-toggle").check();
    await expect(page.getByTestId("todo-item")).toHaveAttribute(
      "data-completed",
      "true",
    );
    await expect(page.getByTestId("stat-rate")).toContainText("100%");
  });

  test("「未完了」フィルタで完了タスクが隠れる", async ({ page }) => {
    await addTodo(page, "タスクA");
    await addTodo(page, "タスクB");
    // 先頭（タスクB）を完了にする
    await page.getByTestId("todo-toggle").first().check();
    await page.getByTestId("todo-filter-status").selectOption("active");
    await expect(page.getByTestId("todo-item")).toHaveCount(1);
    await expect(page.getByTestId("todo-title")).toHaveText("タスクA");
  });

  test("検索で絞り込める", async ({ page }) => {
    await addTodo(page, "請求書を送る");
    await addTodo(page, "ジムに行く");
    await page.getByTestId("todo-search").fill("請求");
    await expect(page.getByTestId("todo-item")).toHaveCount(1);
    await expect(page.getByTestId("todo-title")).toHaveText("請求書を送る");
  });

  test("削除すると一覧から消える", async ({ page }) => {
    await addTodo(page, "消すタスク");
    await page.getByTestId("todo-delete-button").click();
    await expect(page.getByTestId("todo-item")).toHaveCount(0);
    await expect(page.getByTestId("todo-empty")).toBeVisible();
  });

  test("リロード後もデータが保持される", async ({ page }) => {
    await addTodo(page, "永続化テスト");
    await expect(page.getByTestId("todo-item")).toHaveCount(1);
    await page.reload();
    await expect(page.getByTestId("app-title")).toBeVisible();
    await expect(page.getByTestId("todo-item")).toHaveCount(1);
    await expect(page.getByTestId("todo-title")).toHaveText("永続化テスト");
  });
});
