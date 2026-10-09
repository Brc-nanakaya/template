"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, LayoutDashboard } from "lucide-react";
import {
  ExcelUploader,
  type ExcelPreview,
} from "@/components/analysis/ExcelUploader";
import { DataPreviewTable } from "@/components/analysis/DataPreviewTable";
import { DatasetList } from "@/components/analysis/DatasetList";
import { MonthlySummaryTable } from "@/components/analysis/MonthlySummaryTable";
import { SalesDashboard } from "@/components/analysis/SalesDashboard";
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
  /** 保存方法: 追加保存 / 既存データを全て入れ替え */
  const [saveMode, setSaveMode] = useState<"append" | "replace">("append");
  /** 全件入れ替えは管理者のみ（API 側でも 403 で拒否する） */
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { user?: { role?: string } } | null) => {
        if (!cancelled) setIsAdmin(body?.user?.role === "admin");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  /** 直前に取り込んだデータセット ID（ダッシュボードの「更新しました」表示用） */
  const [justImportedId, setJustImportedId] = useState<string | null>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  // 取り込み後にダッシュボードが新しいデータへ切り替わったら、そこまでスクロールする
  useEffect(() => {
    if (justImportedId && selected?.id === justImportedId) {
      dashboardRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [justImportedId, selected?.id]);

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
    const replaceAll = saveMode === "replace";
    if (
      replaceAll &&
      datasets.length > 0 &&
      !window.confirm(
        `保存済みのデータセット ${datasets.length} 件を全て削除し、このファイルの内容に入れ替えます。\n削除したデータは元に戻せません。実行しますか？`,
      )
    ) {
      return;
    }
    try {
      const { dataset: saved, replacedCount } = await importFile(
        preview.file,
        datasetName.trim() || undefined,
        { replaceAll },
      );
      const skipped =
        preview.parsed.skippedTotalRows > 0
          ? ` / 合計 ${preview.parsed.skippedTotalRows} 件除外`
          : "";
      toastSuccess(
        replaceAll
          ? "既存データを全て入れ替えました"
          : "データベースに保存しました",
        `${saved.name}（${saved.rowCount} 行 → ${SALES_TABLE_NAME}）${skipped}` +
          (replaceAll ? ` / 既存 ${replacedCount} 件を削除` : ""),
      );
      setPreview(null);
      setDatasetName("");
      setSaveMode("append");
      setJustImportedId(saved.id);
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
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
          <Link
            href="/"
            className="text-xs text-white/75 transition hover:text-white"
            data-testid="back-to-top"
          >
            ← トップへ戻る
          </Link>
          <p className="text-xs text-white/75">
            売上ダッシュボード / {SALES_TABLE_NAME}
          </p>
        </div>
      </section>

      <section className="bg-gradient-to-b from-[#bc0017] via-[#d30a1a] to-[#a80014] text-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 text-center sm:py-14">
          <p className="mt-3 text-sm font-medium tracking-[0.2em] text-[#f7dda8]">
            DATA ANALYSIS
          </p>
          <h1
            className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl"
            data-testid="analysis-title"
          >
            データ分析
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-white/90 sm:text-base">
            売上 Excel を取り込むと、合計行を除いて {SALES_TABLE_NAME}{" "}
            へ格納し、ダッシュボードに反映します。
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
        <div
          ref={dashboardRef}
          className="scroll-mt-4 rounded-2xl border border-black/5 bg-[#f7f7f7] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.1)] sm:p-6"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[#050505]">
              <LayoutDashboard className="h-5 w-5 text-[#bc0017]" aria-hidden />
              売上ダッシュボード
            </h2>
            {datasets.length > 1 && (
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                表示データ
                <select
                  data-testid="dashboard-dataset-select"
                  value={selected?.id ?? ""}
                  disabled={saving}
                  onChange={(e) => void handleSelect(e.target.value)}
                  className="h-9 max-w-[16rem] rounded-md border border-input bg-white px-2 text-sm text-[#050505] outline-none focus-visible:ring-2 focus-visible:ring-[#bc0017]"
                >
                  {!selected && <option value="">選択してください</option>}
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {selected ? (
            <SalesDashboard
              key={selected.id}
              dataset={selected}
              justUpdated={selected.id === justImportedId}
            />
          ) : (
            <p
              data-testid="dashboard-empty"
              className="rounded-xl border border-dashed border-black/15 bg-white px-4 py-12 text-center text-sm text-muted-foreground"
            >
              {loading
                ? "読み込み中…"
                : "データを取り込むと、ここに売上の KPI と推移が表示されます"}
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.1)] sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#050505]">データ取込</h2>
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
              {isAdmin && (
                <fieldset className="text-sm" disabled={saving}>
                  <legend className="mb-1.5 font-medium text-[#050505]">
                    保存方法
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        {
                          value: "append",
                          label: "追加して保存",
                          desc: "既存のデータセットは残したまま、新しいデータセットとして追加します",
                        },
                        {
                          value: "replace",
                          label: "既存データを全て入れ替え",
                          desc: "保存済みのデータセットを全て削除し、このファイルの内容だけにします",
                        },
                      ] as const
                    ).map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition ${
                          saveMode === opt.value
                            ? opt.value === "replace"
                              ? "border-red-600 bg-red-50"
                              : "border-[#bc0017] bg-[#bc0017]/5"
                            : "border-black/10 bg-white hover:border-black/25"
                        }`}
                      >
                        <input
                          type="radio"
                          name="save-mode"
                          value={opt.value}
                          data-testid={`save-mode-${opt.value}`}
                          checked={saveMode === opt.value}
                          onChange={() => setSaveMode(opt.value)}
                          className="mt-0.5 accent-[#bc0017]"
                        />
                        <span>
                          <span className="block font-semibold text-[#050505]">
                            {opt.label}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {opt.desc}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              {saveMode === "replace" && datasets.length > 0 && (
                <p
                  data-testid="replace-warning"
                  className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
                >
                  <AlertTriangle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden
                  />
                  <span>
                    保存すると、保存済みのデータセット {datasets.length} 件（計{" "}
                    {datasets
                      .reduce((s, d) => s + d.rowCount, 0)
                      .toLocaleString("ja-JP")}{" "}
                    行）が削除されます。削除したデータは元に戻せません。
                  </span>
                </p>
              )}

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
                  className={
                    saveMode === "replace"
                      ? "bg-red-700 hover:bg-red-800"
                      : "bg-[#bc0017] hover:bg-[#a80014]"
                  }
                >
                  {saving
                    ? "保存中…"
                    : saveMode === "replace"
                      ? "全て入れ替えて保存"
                      : "データベースに保存"}
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
              <p
                className="mt-3 text-xs text-red-600"
                data-testid="dataset-error"
              >
                {error}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.1)] sm:p-5">
            <h2 className="text-lg font-bold text-[#050505]">
              格納データプレビュー
            </h2>
            {selected ? (
              <div className="mt-4 space-y-4" data-testid="stored-preview">
                <p className="text-sm text-muted-foreground">
                  {selected.name} · {selected.tableName ?? SALES_TABLE_NAME} ·
                  シート {selected.sheetName} · {selected.rowCount} 行
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
