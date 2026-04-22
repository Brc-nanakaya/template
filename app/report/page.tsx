/**
 * レポートプレビュー画面 (T15)。
 * `/report` にアクセスされたとき、`/public/sample-data/` のデモデータから
 * 当月レポートを Markdown 生成し `ReportPreview` で描画する。
 *
 * T14 の AI 所見 API 連携は本ページでは行わず、静的プレースホルダを埋め込む。
 * ダッシュボード（T17）からは、AI 所見生成後の Markdown 文字列を URL / セッション
 * ストレージ経由で受け渡す形で連携する予定。
 */

import { loadAllSampleData } from "@/lib/loaders";
import { buildReport } from "@/lib/report-builder";
import { ReportPreview } from "@/components/report/ReportPreview";

// Next.js に対しては毎回サーバ側で実行させる（サンプルデータを都度読込み）。
export const dynamic = "force-dynamic";

const PLACEHOLDER_COMMENTARY = `### 当月サマリー
プール残高は計画線上で順調に償却。期限前弁済・デフォルトの発生水準は前月並みで、大きな異常は観測されず。

### 延滞デフォルト
90日以上延滞率が 3 ヶ月連続で上昇傾向、当月はトリガー閾値に対して余裕が縮小。個別債権のサービサー対応状況を継続モニタリング。

### トリガー
累積デフォルト率は閾値の 70% 水準に到達。抵触リスクを前提とした早期是正措置の事前検討を開始すべき局面。

### 翌月留意事項
4 月は借換繁忙期にあたり CPR 上振れの可能性。受益権キャッシュフロー見通しと劣後配当への影響を再計算し、投資家向けにアップデートを準備する。`;

export default async function ReportPage() {
  const dataset = await loadAllSampleData();
  const markdown = buildReport({
    dataset,
    aiCommentary: PLACEHOLDER_COMMENTARY,
  });
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
      </header>
      <ReportPreview markdown={markdown} filenameBase={filenameBase} />
    </main>
  );
}
