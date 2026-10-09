import { test, expect } from "@playwright/test";
import * as XLSX from "xlsx";
import path from "path";
import { mkdtemp, readFile, writeFile } from "fs/promises";
import { tmpdir } from "os";

async function createSalesExcel(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "analysis-e2e-"));
  const filePath = path.join(dir, "sales.xlsx");
  const detail = XLSX.utils.aoa_to_sheet([
    [
      "日付",
      "地域",
      "営業担当者",
      "商品カテゴリ",
      "商品名",
      "数量",
      "単価",
      "売上金額",
    ],
    [
      "2026-04-01",
      "東京",
      "佐藤",
      "コンサルティング",
      "業務プロセス診断",
      2,
      300000,
      600000,
    ],
    [
      "2026-05-10",
      "大阪",
      "鈴木",
      "トレーニング",
      "AX基礎研修（使う）",
      1,
      80000,
      80000,
    ],
    ["合計", null, null, null, null, null, null, 680000],
  ]);
  const summary = XLSX.utils.aoa_to_sheet([
    ["月", "売上合計", "件数", "平均単価"],
    ["2026-04", 600000, 1, 300000],
    ["2026-05", 80000, 1, 80000],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, detail, "売上データ");
  XLSX.utils.book_append_sheet(wb, summary, "月次サマリー");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  await writeFile(filePath, buffer);
  return filePath;
}

/** テストが保存したデータセットを DB から消す（デモデータには触らない） */
const E2E_DATASET_NAME = "E2E売上";

test.describe("データ分析ページ", () => {
  // 同じ DB のデータセット一覧を見るため、並列にすると後片付け・件数比較が干渉する
  test.describe.configure({ mode: "default" });

  test.afterEach(async ({ request }) => {
    const res = await request.get("/api/analysis/datasets");
    if (!res.ok()) return;
    const { datasets } = (await res.json()) as {
      datasets: { id: string; name: string }[];
    };
    for (const d of datasets.filter((d) => d.name === E2E_DATASET_NAME)) {
      await request.delete(`/api/analysis/datasets/${d.id}`);
    }
  });

  test("トップから遷移できる", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("nav-analysis").click();
    await expect(page).toHaveURL(/\/analysis$/);
    await expect(page.getByTestId("analysis-title")).toBeVisible();
    await expect(page.getByTestId("excel-uploader")).toBeVisible();
    await expect(page.getByTestId("columns-defined")).toContainText("sales_data");
  });

  test("売上 Excel を取り込んでプレビューし DB に保存できる", async ({ page }) => {
    const filePath = await createSalesExcel();
    await page.goto("/analysis");

    await page.getByTestId("excel-file-input").setInputFiles(filePath);
    await expect(page.getByTestId("excel-preview-section")).toBeVisible();
    await expect(page.getByTestId("data-preview-table")).toBeVisible();
    await expect(page.getByTestId("excel-preview-meta")).toContainText("行: 2");
    await expect(page.getByTestId("excel-preview-meta")).toContainText("合計 1 件除外");
    await expect(page.getByTestId("data-preview-table")).toContainText("業務プロセス診断");
    await expect(page.getByTestId("data-preview-table")).not.toContainText("合計");
    await expect(page.getByTestId("monthly-summary")).toBeVisible();

    await page.getByTestId("dataset-name-input").fill(E2E_DATASET_NAME);
    await page.getByTestId("save-to-db").click();

    await expect(page.getByTestId("toast-success")).toBeVisible();
    await expect(page.getByTestId("dataset-list")).toBeVisible();
    await expect(page.getByTestId("stored-preview")).toBeVisible();
    await expect(page.getByTestId("stored-data-table")).toContainText("業務プロセス診断");
    await expect(page.getByTestId("stored-data-table")).not.toContainText("合計");

    // 取り込み後はダッシュボードが新しいデータセットで更新される
    await expect(page.getByTestId("sales-dashboard")).toBeVisible();
    await expect(page.getByTestId("dashboard-dataset-name")).toHaveText(E2E_DATASET_NAME);
    await expect(page.getByTestId("dashboard-updated-at")).toContainText("取込データで更新しました");
    await expect(page.getByTestId("kpi-row-count")).toContainText("2 件");
    await expect(page.getByTestId("dashboard-by-region")).toBeVisible();
  });

  test("全件入れ替えを選ぶと警告が出てボタンが切り替わる（保存はしない）", async ({ page }) => {
    const filePath = await createSalesExcel();
    await page.goto("/analysis");
    await page.getByTestId("excel-file-input").setInputFiles(filePath);
    await expect(page.getByTestId("save-to-db")).toHaveText("データベースに保存");

    await page.getByTestId("save-mode-replace").check();
    await expect(page.getByTestId("save-to-db")).toHaveText("全て入れ替えて保存");

    // 確認ダイアログでキャンセルすると何も変わらない
    const before = await page.request.get("/api/analysis/datasets").then((r) => r.json());
    if (before.datasets.length > 0) {
      await expect(page.getByTestId("replace-warning")).toBeVisible();
      page.once("dialog", (d) => void d.dismiss());
      await page.getByTestId("save-to-db").click();
      await expect(page.getByTestId("excel-preview-section")).toBeVisible();
      const after = await page.request.get("/api/analysis/datasets").then((r) => r.json());
      expect(after.datasets.length).toBe(before.datasets.length);
    }
  });

  test("API は不正な mode を 400 で拒否する", async ({ request }) => {
    const res = await request.post("/api/analysis/datasets", {
      multipart: {
        file: { name: "x.csv", mimeType: "text/csv", buffer: Buffer.from("a,b\n1,2") },
        mode: "drop",
      },
    });
    expect(res.status()).toBe(400);
  });

  test("一般ユーザーは全件入れ替えできない（API は 403、画面に選択肢が出ない）", async ({
    browser,
    baseURL,
  }) => {
    // ログイン済み状態を引き継がない新しいコンテキストで一般ユーザーとしてログインする
    const context = await browser.newContext({ storageState: undefined, baseURL });
    try {
      const login = await context.request.post("/api/auth/login", {
        data: {
          loginId: "sales1@example.com",
          password: process.env.SEED_MEMBER_PASSWORD ?? "demo1234",
        },
      });
      expect(login.ok()).toBeTruthy();

      const filePath = await createSalesExcel();
      const res = await context.request.post("/api/analysis/datasets", {
        multipart: {
          file: {
            name: "sales.xlsx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            buffer: await readFile(filePath),
          },
          name: E2E_DATASET_NAME,
          mode: "replace",
        },
      });
      expect(res.status()).toBe(403);

      const page = await context.newPage();
      await page.goto("/analysis");
      await page.getByTestId("excel-file-input").setInputFiles(filePath);
      await expect(page.getByTestId("excel-preview-section")).toBeVisible();
      await expect(page.getByTestId("save-mode-replace")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
