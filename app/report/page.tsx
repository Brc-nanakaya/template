"use client";

/**
 * レポートプレビュー画面 (T15 + T14 連携)。
 *
 * ダッシュボードの AI 所見エディタ（T14）で生成された所見を
 * sessionStorage `trust:commentary` 経由で受け取り、`buildReport` に差し込んで
 * 再描画する。sessionStorage に値が無い場合はプレースホルダ所見で描画。
 *
 * 実装は Client Component。サンプルデータは `loadAllSampleData` が
 * isomorphic 実装のため、ブラウザ側でも `/sample-data/*` を fetch して読み込む。
 */

import { useEffect, useState } from "react";
import { loadAllSampleData } from "@/lib/loaders";
import { buildReport } from "@/lib/report-builder";
import { ReportPreview } from "@/components/report/ReportPreview";
import type { TrustDataset } from "@/lib/types";

const PLACEHOLDER_COMMENTARY = `### 当月サマリー
プール残高は計画線上で順調に償却。期限前弁済・デフォルトの発生水準は前月並みで、大きな異常は観測されず。

### 延滞デフォルト
90日以上延滞率が 3 ヶ月連続で上昇傾向、当月はトリガー閾値に対して余裕が縮小。個別債権のサービサー対応状況を継続モニタリング。

### トリガー
累積デフォルト率は閾値の 70% 水準に到達。抵触リスクを前提とした早期是正措置の事前検討を開始すべき局面。

### 翌月留意事項
4 月は借換繁忙期にあたり CPR 上振れの可能性。受益権キャッシュフロー見通しと劣後配当への影響を再計算し、投資家向けにアップデートを準備する。`;

export default function ReportPage() {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ready"; dataset: TrustDataset; markdown: string; commentarySource: "session" | "placeholder" }
    | { kind: "error"; message: string }
  >({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dataset = await loadAllSampleData();
        const stored =
          typeof window !== "undefined"
            ? window.sessionStorage.getItem("trust:commentary")
            : null;
        const aiCommentary = stored && stored.trim().length > 0 ? stored : PLACEHOLDER_COMMENTARY;
        const markdown = buildReport({ dataset, aiCommentary });
        if (!cancelled) {
          setState({
            kind: "ready",
            dataset,
            markdown,
            commentarySource: stored ? "session" : "placeholder",
          });
        }
      } catch (e) {
        if (!cancelled) {
          setState({
            kind: "error",
            message: e instanceof Error ? e.message : String(e),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "loading") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8" data-testid="report-loading">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-2/3 rounded bg-slate-200" />
          <div className="h-4 w-1/2 rounded bg-slate-200" />
          <div className="h-64 w-full rounded bg-white ring-1 ring-slate-200" />
        </div>
      </main>
    );
  }

  if (state.kind === "error") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-8" data-testid="report-error">
        <h1 className="text-xl font-bold text-red-700">レポート生成エラー</h1>
        <p className="mt-2 text-sm text-slate-600">{state.message}</p>
      </main>
    );
  }

  const { dataset, markdown, commentarySource } = state;
  const filenameBase = `trust-report_${dataset.deal.report_month}`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 print:hidden">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          TrustReport · レポートプレビュー
        </p>
        <h1 className="mt-1 text-2xl font-bold text-[#0B2545]">
          {dataset.deal.deal_name}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          報告基準月 {dataset.deal.report_month} / 契約番号 {dataset.deal.contract_number}
        </p>
        <p
          className="mt-1 text-xs text-slate-500"
          data-testid="report-commentary-source"
        >
          AI 所見:{" "}
          {commentarySource === "session"
            ? "ダッシュボードから反映された所見を使用"
            : "プレースホルダ所見を使用（ダッシュボードで生成 → 「レポートに反映」で差し替え可能）"}
        </p>
      </header>
      <ReportPreview markdown={markdown} filenameBase={filenameBase} />
    </main>
  );
}
