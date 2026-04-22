/**
 * 期中管理レポート Markdown ビルダー (T15)。
 *
 * `buildReport({ dataset, aiCommentary })` は `TrustDataset` と AI 所見文字列を受け取り、
 * Markdown 形式のレポート本文を 1 本の文字列として返す純粋関数。
 *
 * セクション構成 (process.md T15):
 *   1. 表紙
 *   2. 案件概要
 *   3. 当月サマリー
 *   4. プール実績
 *   5. キャッシュフロー配分
 *   6. トリガー状況
 *   7. ポートフォリオ特性
 *   8. 翌月留意事項（AI 所見）
 *
 * 数値フォーマットは `lib/formatters.ts` に集約（`1,234百万円 (12.3億円)`）。
 */

import {
  aggregateDefaultsByCause,
  aggregateDefaultsByDisposalStatus,
  aggregatePrepaymentsByReason,
  calculateMonthlyMetrics,
  calculatePortfolioStats,
} from "./metrics";
import {
  fmtMm,
  fmtNumber,
  fmtPct,
  fmtSignedMm,
  fmtSignedPp,
  fmtMonth,
} from "./formatters";
import type { TrustDataset, WaterfallRecord, TriggerTest } from "./types";

export interface BuildReportInput {
  dataset: TrustDataset;
  /** T14 AI 所見 API 出力。未指定時は規定のプレースホルダを挿入。 */
  aiCommentary?: string;
  /** 作成日時（決定的テストのため注入可能）。 */
  generatedAt?: Date;
}

const DEFAULT_AI_COMMENTARY = `> （AI 所見は未生成です。ダッシュボードの「AI 所見を生成」ボタンから所見を生成してください。）`;

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------
export function buildReport(input: BuildReportInput): string {
  const { dataset, aiCommentary, generatedAt = new Date() } = input;
  const { deal, monthly, loans, waterfall, triggers, regional, prepayments, defaults } = dataset;

  if (monthly.length === 0) {
    throw new Error("buildReport: monthly が空のデータセットはレポート化できません");
  }

  const cur = calculateMonthlyMetrics(monthly, {
    initialPoolMm: deal.initial_pool_balance_mm,
  });
  const portfolio = calculatePortfolioStats(loans);

  const sections: string[] = [
    renderCoverPage(deal, cur.month, generatedAt),
    renderDealOverview(deal),
    renderSummary(deal, cur),
    renderPoolPerformance(cur, deal, monthly, regional, prepayments, defaults),
    renderWaterfall(waterfall, cur.month),
    renderTriggerStatus(triggers, cur.month, deal),
    renderPortfolio(portfolio),
    renderNextMonthNotes(aiCommentary),
  ];
  return sections.join("\n\n");
}

// -----------------------------------------------------------------------------
// Section 1. 表紙
// -----------------------------------------------------------------------------
function renderCoverPage(
  deal: TrustDataset["deal"],
  reportMonth: string,
  generatedAt: Date,
): string {
  const ts = formatTimestamp(generatedAt);
  return [
    `# ${deal.deal_name}`,
    `## 期中管理レポート`,
    ``,
    `- 報告基準月: **${fmtMonth(reportMonth)}**`,
    `- 契約番号: ${deal.contract_number}`,
    `- 作成日時: ${ts}`,
    `- 作成: ${deal.trustee}`,
  ].join("\n");
}

// -----------------------------------------------------------------------------
// Section 2. 案件概要
// -----------------------------------------------------------------------------
function renderDealOverview(deal: TrustDataset["deal"]): string {
  return [
    `## 1. 案件概要`,
    ``,
    `| 項目 | 内容 |`,
    `| --- | --- |`,
    `| 案件 ID | ${deal.deal_id} |`,
    `| 資産種類 | ${deal.asset_type} |`,
    `| オリジネーター | ${deal.originator} |`,
    `| サービサー | ${deal.servicer}（格付 ${deal.servicer_rating} / ${deal.servicer_rating_agency}） |`,
    `| バックアップサービサー | ${deal.backup_servicer} |`,
    `| 受託者 | ${deal.trustee} |`,
    `| クロージング日 | ${deal.closing_date} |`,
    `| 初期プール残高 | ${fmtMm(deal.initial_pool_balance_mm)} |`,
    `| 優先受益権初期残高 | ${fmtMm(deal.senior_initial_balance_mm)}（クーポン ${fmtPct(deal.senior_coupon_rate, 3)}） |`,
    `| 劣後受益権初期残高 | ${fmtMm(deal.subordinated_initial_balance_mm)}（クーポン ${fmtPct(deal.subordinated_coupon_rate, 3)}） |`,
  ].join("\n");
}

// -----------------------------------------------------------------------------
// Section 3. 当月サマリー
// -----------------------------------------------------------------------------
function renderSummary(
  deal: TrustDataset["deal"],
  cur: ReturnType<typeof calculateMonthlyMetrics>,
): string {
  return [
    `## 2. 当月サマリー`,
    ``,
    `| KPI | 当月値 | 前月比 / 参考 |`,
    `| --- | --- | --- |`,
    `| プール残高 | ${fmtMm(cur.pool_balance_mm)} | ${fmtSignedMm(cur.pool_balance_mom)} |`,
    `| 残存率 | ${fmtPct(cur.remaining_ratio)} | 初期残高 ${fmtMm(deal.initial_pool_balance_mm)} |`,
    `| 90日以上延滞率 | ${fmtPct(cur.delinquency_90_plus_rate)} | ${fmtSignedPp(cur.delinquency_90_mom_pp)} |`,
    `| 累積デフォルト率 | ${fmtPct(cur.cumulative_default_rate)} | 閾値 ${fmtPct(deal.trigger_thresholds.cumulative_default_rate)} |`,
    `| 優先受益権残高 | ${fmtMm(cur.senior_balance_mm)} | 劣後比率 ${fmtPct(cur.subordination_ratio)} |`,
    `| サービサー回収率 | ${fmtPct(cur.servicer_recovery_rate)} | CPR年率 ${fmtPct(cur.cpr_annual)} / CDR年率 ${fmtPct(cur.cdr_annual)} |`,
  ].join("\n");
}

// -----------------------------------------------------------------------------
// Section 4. プール実績
// -----------------------------------------------------------------------------
function renderPoolPerformance(
  cur: ReturnType<typeof calculateMonthlyMetrics>,
  deal: TrustDataset["deal"],
  monthly: TrustDataset["monthly"],
  regional: TrustDataset["regional"],
  prepayments: TrustDataset["prepayments"],
  defaults: TrustDataset["defaults"],
): string {
  const curRow = monthly[monthly.length - 1];
  const topRegions = [...regional]
    .sort((a, b) => b.balance_mm - a.balance_mm)
    .slice(0, 5);
  const regionTable = [
    `| 順位 | 都道府県 | 残高 | シェア | 90日以上延滞率 |`,
    `| --- | --- | --- | --- | --- |`,
    ...topRegions.map(
      (r, i) =>
        `| ${i + 1} | ${r.prefecture} | ${fmtMm(r.balance_mm)} | ${fmtPct(r.share)} | ${fmtPct(r.delinquency_90_plus_rate)} |`,
    ),
  ].join("\n");

  const prepayReasons = aggregatePrepaymentsByReason(prepayments);
  const defaultCauses = aggregateDefaultsByCause(defaults);
  const disposal = aggregateDefaultsByDisposalStatus(defaults);

  const prepayLines = prepayReasons
    .map(
      (b) =>
        `- ${b.label}: ${fmtNumber(b.count)} 件 / ${fmtMm(b.amount_mm)}（構成比 ${fmtPct(b.share)}）`,
    )
    .join("\n");
  const causeLines = defaultCauses
    .map(
      (b) =>
        `- ${b.label}: ${fmtNumber(b.count)} 件 / ${fmtMm(b.amount_mm)}（構成比 ${fmtPct(b.share)}）`,
    )
    .join("\n");
  const disposalLines = disposal
    .map(
      (b) =>
        `- ${b.label}: ${fmtNumber(b.count)} 件（回収 ${fmtMm(b.recovery_amount_mm)} / 損失 ${fmtMm(b.loss_amount_mm)}）`,
    )
    .join("\n");

  return [
    `## 3. プール実績`,
    ``,
    `### 3.1 延滞状況`,
    `- 30-59日延滞率: ${fmtPct(cur.delinquency_30_59_rate)}`,
    `- 60-89日延滞率: ${fmtPct(cur.delinquency_60_89_rate)}`,
    `- 90日以上延滞率: ${fmtPct(cur.delinquency_90_plus_rate)}（閾値 ${fmtPct(deal.trigger_thresholds.delinquency_90_rate)}）`,
    ``,
    `### 3.2 当月動向`,
    `- 期限前弁済: ${fmtNumber(curRow.prepayment_count)} 件 / ${fmtMm(curRow.prepayment_principal_mm)}`,
    `- デフォルト: ${fmtNumber(curRow.default_count)} 件 / ${fmtMm(curRow.default_principal_mm)}`,
    `- 回収: ${fmtMm(curRow.recovery_mm)}`,
    ``,
    `### 3.3 期限前弁済理由別（過去12ヶ月）`,
    prepayLines,
    ``,
    `### 3.4 デフォルト事由別`,
    causeLines,
    ``,
    `### 3.5 担保処分状況`,
    disposalLines,
    ``,
    `### 3.6 都道府県別 Top 5`,
    regionTable,
  ].join("\n");
}

// -----------------------------------------------------------------------------
// Section 5. キャッシュフロー配分
// -----------------------------------------------------------------------------
function renderWaterfall(waterfall: WaterfallRecord[], month: string): string {
  const current = waterfall
    .filter((w) => w.month === month)
    .sort((a, b) => a.priority_order - b.priority_order);
  const rows = current
    .map(
      (w) => `| ${w.priority_order} | ${w.tier_name} | ${fmtMm(w.amount_mm)} |`,
    )
    .join("\n");
  const total = current.reduce((s, w) => s + w.amount_mm, 0);
  return [
    `## 4. キャッシュフロー配分（当月）`,
    ``,
    `| 優先順位 | 階層 | 配分額 |`,
    `| --- | --- | --- |`,
    rows || `| - | データなし | 0百万円 |`,
    `| - | **合計** | **${fmtMm(total)}** |`,
  ].join("\n");
}

// -----------------------------------------------------------------------------
// Section 6. トリガー状況
// -----------------------------------------------------------------------------
function renderTriggerStatus(
  triggers: TriggerTest[],
  month: string,
  deal: TrustDataset["deal"],
): string {
  const current = triggers.filter((t) => t.month === month);
  if (current.length === 0) {
    return [`## 5. トリガー状況`, ``, `当月のトリガーデータなし。`].join("\n");
  }
  const rows = current
    .map((t) => {
      const margin =
        t.direction === "above_breach"
          ? (t.threshold - t.current_value) / t.threshold
          : (t.current_value - t.threshold) / t.threshold;
      const state = t.breach
        ? "**抵触**"
        : Math.abs(margin) < 0.15
          ? "警戒"
          : "未抵触";
      return `| ${t.trigger_name} | ${fmtPct(t.threshold, 2)} | ${fmtPct(t.current_value, 2)} | ${fmtSignedPp(-margin * t.threshold)} | ${state} |`;
    })
    .join("\n");
  return [
    `## 5. トリガー状況`,
    ``,
    `| トリガー | 閾値 | 当月値 | 閾値までの余裕 | 状態 |`,
    `| --- | --- | --- | --- | --- |`,
    rows,
    ``,
    `_閾値定義: 累積デフォルト率=${fmtPct(deal.trigger_thresholds.cumulative_default_rate)}、90日以上延滞率=${fmtPct(deal.trigger_thresholds.delinquency_90_rate)}、CPR=${fmtPct(deal.trigger_thresholds.cpr_annual)}、劣後比率下限=${fmtPct(deal.trigger_thresholds.subordination_ratio_min)}_`,
  ].join("\n");
}

// -----------------------------------------------------------------------------
// Section 7. ポートフォリオ特性
// -----------------------------------------------------------------------------
function renderPortfolio(
  portfolio: ReturnType<typeof calculatePortfolioStats>,
): string {
  const interestRows = portfolio.interest_type_composition
    .map(
      (b) =>
        `| ${b.label} | ${fmtNumber(b.count)} | ${fmtMm(b.balance_mm)} | ${fmtPct(b.share)} |`,
    )
    .join("\n");
  const propertyRows = portfolio.property_type_composition
    .map(
      (b) =>
        `| ${b.label} | ${fmtNumber(b.count)} | ${fmtMm(b.balance_mm)} | ${fmtPct(b.share)} |`,
    )
    .join("\n");
  return [
    `## 6. ポートフォリオ特性`,
    ``,
    `- 有効債権数: ${fmtNumber(portfolio.active_loan_count)} 件 / 総債権数 ${fmtNumber(portfolio.loan_count)} 件`,
    `- 加重平均金利: ${fmtPct(portfolio.weighted_avg_interest_rate, 3)}`,
    `- 加重平均 LTV（現在）: ${fmtPct(portfolio.weighted_avg_ltv_current)}`,
    `- 加重平均 DTI: ${fmtPct(portfolio.weighted_avg_dti)}`,
    `- 加重平均残存期間: ${portfolio.weighted_avg_remaining_term_months.toFixed(1)} ヶ月`,
    ``,
    `### 6.1 金利タイプ構成`,
    `| タイプ | 件数 | 残高 | シェア |`,
    `| --- | --- | --- | --- |`,
    interestRows,
    ``,
    `### 6.2 物件種別構成`,
    `| 種別 | 件数 | 残高 | シェア |`,
    `| --- | --- | --- | --- |`,
    propertyRows,
  ].join("\n");
}

// -----------------------------------------------------------------------------
// Section 8. 翌月留意事項（AI 所見）
// -----------------------------------------------------------------------------
function renderNextMonthNotes(aiCommentary?: string): string {
  const body = aiCommentary && aiCommentary.trim().length > 0 ? aiCommentary.trim() : DEFAULT_AI_COMMENTARY;
  return [`## 7. 翌月留意事項`, ``, body].join("\n");
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------
function formatTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
