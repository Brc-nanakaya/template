import { test, expect } from "@playwright/test";
import * as XLSX from "xlsx";
import path from "path";
import { mkdtemp, writeFile } from "fs/promises";
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
  });
});
