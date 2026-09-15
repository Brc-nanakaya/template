"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExcelUploader, type ExcelPreview } from "@/components/analysis/ExcelUploader";
import { DataPreviewTable } from "@/components/analysis/DataPreviewTable";
import { DatasetList } from "@/components/analysis/DatasetList";
import { MonthlySummaryTable } from "@/components/analysis/MonthlySummaryTable";
import { Button } from "@/components/ui/button";
import { useAnalysisDatasets } from "@/hooks/useAnalysisDatasets";
import { aggregateMonthly } from "@/lib/analysis/aggregate";
import {
  ANALYSIS_COLUMNS,
  SALES_TABLE_NAME,
  columnLabelMap,
} from "@/lib/analysis/schema";
import { toastError, toastSuccess } from "@/lib/toast";

const COLUMN_LABELS = columnLabelMap();

export default function AnalysisPage() {
  const {
    datasets,
    selected,
    loading,
    saving,
    error,
    select,
    importFile,
    remove,
  } = useAnalysisDatasets();

  const [preview, setPreview] = useState<ExcelPreview | null>(null);
  const [datasetName, setDatasetName] = useState("");

  const previewSummary = useMemo(
    () => (preview ? aggregateMonthly(preview.parsed.rows) : []),
    [preview],
  );
  const storedRows = selected?.rows.map((r) => r.values) ?? [];
  const storedSummary = useMemo(
    () => aggregateMonthly(selected?.rows.map((r) => r.values) ?? []),
    [selected],
  );

  async function handleSave() {
    if (!preview) return;
    try {
      const saved = await importFile(
        preview.file,
        datasetName.trim() || undefined,
      );
      const skipped =
        preview.parsed.skippedTotalRows > 0
          ? ` / 合計 ${preview.parsed.skippedTotalRows} 件除外`
          : "";
      toastSuccess(
        "データベースに保存しました",
        `${saved.name}（${saved.rowCount} 行 → ${SALES_TABLE_NAME}）${skipped}`,
      );
      setPreview(null);
      setDatasetName("");
    } catch (e) {
      toastError(
        "保存に失敗しました",
        e instanceof Error ? e.message : undefined,
      );
    }
  }

  async function handleSelect(id: string) {
    try {
      await select(id);
    } catch (e) {
      toastError(
        "読み込みに失敗しました",
        e instanceof Error ? e.message : undefined,
      );
    }
  }

  async function handleDelete(id: string) {
    try {
      await remove(id);
      toastSuccess("データセットを削除しました");
    } catch (e) {
      toastError(
        "削除に失敗しました",
        e instanceof Error ? e.message : undefined,
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#ececec]">
      <section className="bg-[#050505] text-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5">
          <Link
            href="/"
            className="text-xs text-white/75 transition hover:text-white"
            data-testid="back-to-top"
          >
            ← トップへ戻る
          </Link>
          <p className="text-xs text-white/75">売上データ取込 / {SALES_TABLE_NAME}</p>
        </div>
      </section>

      <section className="bg-gradient-to-b from-[#bc0017] via-[#d30a1a] to-[#a80014] text-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 text-center sm:py-20">
          <p className="text-sm font-medium tracking-[0.2em] text-[#f7dda8]">
            DATA ANALYSIS
          </p>
          <h1
            className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl"
            data-testid="analysis-title"
          >
            データ分析
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-white/90 sm:text-base">
            売上 Excel を取り込み、合計行を除いて {SALES_TABLE_NAME} へ格納します。
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
        <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.1)] sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#050505]">Excel 取込</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                日付・地域・担当者・カテゴリ・商品・数量・単価・売上金額をプレビューし、
                問題なければデータベースに保存します。合計行と月次サマリーシートは除外します。
              </p>
            </div>
            <p
              data-testid="columns-defined"
              className="rounded-md bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800"
            >
              テーブル: {SALES_TABLE_NAME}（{ANALYSIS_COLUMNS.length} カラム）
            </p>
          </div>

          <div className="mt-5">
            <ExcelUploader
              preview={preview}
              busy={saving}
              onPreview={(next) => {
                setPreview(next);
                if (next) {
                  setDatasetName(next.file.name.replace(/\.[^.]+$/, ""));
                } else {
                  setDatasetName("");
                }
              }}
              onError={(message) => toastError("ファイルエラー", message)}
            />
          </div>

          {preview && (
            <div className="mt-5 space-y-4" data-testid="excel-preview-section">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="block flex-1 text-sm">
                  <span className="mb-1 block font-medium text-[#050505]">
                    データセット名
                  </span>
                  <input
                    data-testid="dataset-name-input"
                    value={datasetName}
                    onChange={(e) => setDatasetName(e.target.value)}
                    disabled={saving}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-[#bc0017]"
                    placeholder="保存名"
                  />
                </label>
                <Button
                  type="button"
                  data-testid="save-to-db"
                  disabled={saving}
                  onClick={() => void handleSave()}
                  className="bg-[#bc0017] hover:bg-[#a80014]"
                >
                  {saving ? "保存中…" : "データベースに保存"}
                </Button>
              </div>

              {preview.parsed.warnings.length > 0 && (
                <ul
                  data-testid="excel-preview-warnings"
                  className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800"
                >
                  {preview.parsed.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              )}

              <MonthlySummaryTable rows={previewSummary} />

              <DataPreviewTable
                columns={preview.parsed.columns}
                rows={preview.parsed.rows}
                columnLabels={COLUMN_LABELS}
              />
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.1)] sm:p-5">
            <h2 className="text-lg font-bold text-[#050505]">保存済みデータ</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {SALES_TABLE_NAME} に格納されたデータセット一覧です。
            </p>
            <div className="mt-4">
              {loading ? (
                <p
                  data-testid="dataset-loading"
                  className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  読み込み中…
                </p>
              ) : (
                <DatasetList
                  datasets={datasets}
                  selectedId={selected?.id ?? null}
                  busy={saving}
                  onSelect={(id) => void handleSelect(id)}
                  onDelete={(id) => void handleDelete(id)}
                />
              )}
            </div>
            {error && (
              <p className="mt-3 text-xs text-red-600" data-testid="dataset-error">
                {error}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.1)] sm:p-5">
            <h2 className="text-lg font-bold text-[#050505]">格納データプレビュー</h2>
            {selected ? (
              <div className="mt-4 space-y-4" data-testid="stored-preview">
                <p className="text-sm text-muted-foreground">
                  {selected.name} · {selected.tableName ?? SALES_TABLE_NAME} · シート{" "}
                  {selected.sheetName} · {selected.rowCount} 行
                </p>
                <MonthlySummaryTable rows={storedSummary} />
                <DataPreviewTable
                  columns={selected.columns}
                  rows={storedRows}
                  columnLabels={COLUMN_LABELS}
                  testId="stored-data-table"
                />
              </div>
            ) : (
              <p
                data-testid="stored-preview-empty"
                className="mt-4 rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground"
              >
                左の一覧からデータセットを選択してください
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
