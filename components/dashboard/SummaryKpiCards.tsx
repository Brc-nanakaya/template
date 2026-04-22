import type { DealInfo, MonthlyPerformance } from "@/lib/types";
import type { MonthlyMetrics } from "@/lib/metrics";
import {
  fmtMm,
  fmtMonth,
  fmtPct,
  fmtSignedMm,
  fmtSignedPct,
  fmtSignedPp,
} from "@/lib/formatters";
import { KpiCard, type KpiTone } from "./KpiCard";

/** KPI カード群（6枚）。ダッシュボード冒頭に配置する。 */
export interface SummaryKpiCardsProps {
  deal: DealInfo;
  monthly: MonthlyPerformance[];
  metrics: MonthlyMetrics;
}

/** 前月比（差分）を「良し悪し」で色付けする方向。
 *  - increase_good: 増加が望ましい（例: 残存率＝x、回収率）
 *  - decrease_good: 減少が望ましい（例: 延滞率・累積デフォルト率・優先受益権残高減少は償還進捗）
 */
type Direction = "increase_good" | "decrease_good" | "neutral";

function classifyTone(diff: number, direction: Direction): KpiTone {
  if (direction === "neutral" || diff === 0) return "neutral";
  const positive = diff > 0;
  if (direction === "increase_good") return positive ? "good" : "danger";
  // decrease_good
  return positive ? "danger" : "good";
}

function lastN<T>(arr: T[], n: number): T[] {
  return arr.slice(Math.max(0, arr.length - n));
}

export function SummaryKpiCards({ deal, monthly, metrics }: SummaryKpiCardsProps) {
  const last12 = lastN(monthly, 12);
  const prev = monthly.length >= 2 ? monthly[monthly.length - 2] : null;

  const servicerDelta = prev
    ? metrics.servicer_recovery_rate - prev.servicer_recovery_rate
    : 0;

  return (
    <section
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      data-testid="dashboard-kpi-summary"
    >
      <KpiCard
        testId="pool-balance"
        label="プール残高"
        valueText={fmtMm(metrics.pool_balance_mm)}
        deltaText={`${fmtSignedMm(metrics.pool_balance_mom)} / ${fmtSignedPct(metrics.pool_balance_mom_pct, 2)}`}
        deltaTone={classifyTone(metrics.pool_balance_mom, "neutral")}
        caption={`基準月 ${fmtMonth(metrics.month)}`}
        sparkline={last12.map((m) => m.pool_balance_mm)}
        sparklineStroke="#0B2545"
      />

      <KpiCard
        testId="retention-rate"
        label="残存率"
        valueText={fmtPct(metrics.remaining_ratio, 2)}
        deltaText={`初期残高 ${fmtMm(deal.initial_pool_balance_mm)}`}
        deltaTone="neutral"
        caption="初期プール対比"
        sparkline={last12.map((m) => m.pool_balance_mm / deal.initial_pool_balance_mm)}
        sparklineStroke="#0B2545"
      />

      <KpiCard
        testId="delinquency-90"
        label="90日以上延滞率"
        valueText={fmtPct(metrics.delinquency_90_plus_rate, 2)}
        deltaText={`前月比 ${fmtSignedPp(metrics.delinquency_90_mom_pp, 2)}`}
        deltaTone={classifyTone(metrics.delinquency_90_mom_pp, "decrease_good")}
        caption={`トリガー閾値 ${fmtPct(deal.trigger_thresholds.delinquency_90_rate, 2)}`}
        sparkline={last12.map((m) => m.delinquency_90_plus_rate)}
        sparklineStroke="#B91C1C"
      />

      <KpiCard
        testId="cumulative-default"
        label="累積デフォルト率"
        valueText={fmtPct(metrics.cumulative_default_rate, 3)}
        deltaText={
          prev
            ? `前月比 ${fmtSignedPp(metrics.cumulative_default_rate - prev.cumulative_default_rate, 3)}`
            : "前月比 —"
        }
        deltaTone={
          prev
            ? classifyTone(
                metrics.cumulative_default_rate - prev.cumulative_default_rate,
                "decrease_good",
              )
            : "neutral"
        }
        caption={`トリガー閾値 ${fmtPct(deal.trigger_thresholds.cumulative_default_rate, 2)}`}
        sparkline={last12.map((m) => m.cumulative_default_rate)}
        sparklineStroke="#B91C1C"
      />

      <KpiCard
        testId="senior-balance"
        label="優先受益権残高"
        valueText={fmtMm(metrics.senior_balance_mm)}
        deltaText={
          prev
            ? `前月比 ${fmtSignedMm(metrics.senior_balance_mm - prev.senior_balance_mm)}`
            : "前月比 —"
        }
        deltaTone="neutral"
        caption={`発行時 ${fmtMm(deal.senior_initial_balance_mm)}`}
        sparkline={last12.map((m) => m.senior_balance_mm)}
        sparklineStroke="#0B2545"
      />

      <KpiCard
        testId="servicer-recovery"
        label="サービサー回収率"
        valueText={fmtPct(metrics.servicer_recovery_rate, 2)}
        deltaText={`前月比 ${fmtSignedPp(servicerDelta, 2)}`}
        deltaTone={classifyTone(servicerDelta, "increase_good")}
        caption="直近12ヶ月トレンド"
        sparkline={last12.map((m) => m.servicer_recovery_rate)}
        sparklineStroke="#D4A017"
      />
    </section>
  );
}
