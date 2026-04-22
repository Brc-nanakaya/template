/**
 * KPI 計算ロジック。
 *
 * 主要関数:
 *   - calculateMonthlyMetrics: 当月 KPI（CPR年率/CDR年率/延滞率/残存率/前月比）を算出
 *   - calculatePortfolioStats: ローンテープの静的特性（加重平均金利・構成比・年齢分布）
 *   - aggregatePrepaymentsByReason: 期限前弁済の理由別件数・金額
 *   - aggregateDefaultsByCause / aggregateDefaultsByDisposalStatus: デフォルト事由・処分状況別集計
 *   - predictTriggerBreach: 過去 6 ヶ月の線形回帰で閾値到達月を予測
 */

import type {
  DefaultRecord,
  LoanRecord,
  MonthlyPerformance,
  PrepaymentRecord,
  TriggerTest,
} from "./types";

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------
const safeDiv = (n: number, d: number): number => (d === 0 ? 0 : n / d);

function monthlyToAnnualRate(monthlyRate: number): number {
  if (!Number.isFinite(monthlyRate) || monthlyRate <= 0) return 0;
  return 1 - Math.pow(1 - monthlyRate, 12);
}

// -----------------------------------------------------------------------------
// calculateMonthlyMetrics — 当月の主要 KPI
// -----------------------------------------------------------------------------
export interface MonthlyMetrics {
  month: string;
  pool_balance_mm: number;
  pool_balance_mom: number; // 前月比（差分、百万円）
  pool_balance_mom_pct: number; // 前月比（率）
  remaining_ratio: number; // 初期残高に対する残存率
  delinquency_30_59_rate: number;
  delinquency_60_89_rate: number;
  delinquency_90_plus_rate: number;
  delinquency_total_rate: number;
  delinquency_90_mom_pp: number; // 前月比（pp）
  cpr_annual: number;
  cdr_annual: number;
  cumulative_default_rate: number;
  cumulative_prepayment_rate: number;
  servicer_recovery_rate: number;
  senior_balance_mm: number;
  subordinated_balance_mm: number;
  subordination_ratio: number;
}

export function calculateMonthlyMetrics(
  monthly: MonthlyPerformance[],
  opts: { initialPoolMm: number; monthIndex?: number } = { initialPoolMm: 0 },
): MonthlyMetrics {
  if (monthly.length === 0) throw new Error("calculateMonthlyMetrics: monthly is empty");
  const idx = opts.monthIndex ?? monthly.length - 1;
  const cur = monthly[idx];
  const prev = idx > 0 ? monthly[idx - 1] : null;

  const cprMonthly = safeDiv(cur.prepayment_principal_mm, prev?.pool_balance_mm ?? cur.pool_balance_mm);
  const cdrMonthly = safeDiv(cur.default_principal_mm, prev?.pool_balance_mm ?? cur.pool_balance_mm);

  return {
    month: cur.month,
    pool_balance_mm: cur.pool_balance_mm,
    pool_balance_mom: prev ? cur.pool_balance_mm - prev.pool_balance_mm : 0,
    pool_balance_mom_pct: prev ? safeDiv(cur.pool_balance_mm - prev.pool_balance_mm, prev.pool_balance_mm) : 0,
    remaining_ratio: opts.initialPoolMm > 0 ? cur.pool_balance_mm / opts.initialPoolMm : 0,
    delinquency_30_59_rate: cur.delinquency_30_59_rate,
    delinquency_60_89_rate: cur.delinquency_60_89_rate,
    delinquency_90_plus_rate: cur.delinquency_90_plus_rate,
    delinquency_total_rate:
      cur.delinquency_30_59_rate + cur.delinquency_60_89_rate + cur.delinquency_90_plus_rate,
    delinquency_90_mom_pp: prev ? cur.delinquency_90_plus_rate - prev.delinquency_90_plus_rate : 0,
    cpr_annual: cur.cpr_annual > 0 ? cur.cpr_annual : monthlyToAnnualRate(cprMonthly),
    cdr_annual: cur.cdr_annual > 0 ? cur.cdr_annual : monthlyToAnnualRate(cdrMonthly),
    cumulative_default_rate: cur.cumulative_default_rate,
    cumulative_prepayment_rate: cur.cumulative_prepayment_rate,
    servicer_recovery_rate: cur.servicer_recovery_rate,
    senior_balance_mm: cur.senior_balance_mm,
    subordinated_balance_mm: cur.subordinated_balance_mm,
    subordination_ratio: cur.subordination_ratio,
  };
}

// -----------------------------------------------------------------------------
// calculatePortfolioStats — ローンテープの静的特性
// -----------------------------------------------------------------------------
export interface CompositionBucket {
  label: string;
  count: number;
  balance_mm: number;
  share: number; // 残高シェア
}

export interface AgeHistogramBin {
  label: string; // 例: "30-34"
  min: number;
  max: number;
  count: number;
  share: number;
}

export interface PortfolioStats {
  loan_count: number;
  total_balance_mm: number;
  weighted_avg_interest_rate: number;
  weighted_avg_ltv_current: number;
  weighted_avg_dti: number;
  weighted_avg_remaining_term_months: number;
  interest_type_composition: CompositionBucket[];
  property_type_composition: CompositionBucket[];
  age_histogram: AgeHistogramBin[];
  active_loan_count: number; // status が "正常" or 延滞中
}

function buildComposition(
  loans: LoanRecord[],
  key: keyof LoanRecord,
): CompositionBucket[] {
  const map = new Map<string, { count: number; balance: number }>();
  let totalBal = 0;
  for (const l of loans) {
    const label = String(l[key]);
    const cur = map.get(label) ?? { count: 0, balance: 0 };
    cur.count += 1;
    cur.balance += l.current_balance_mm;
    totalBal += l.current_balance_mm;
    map.set(label, cur);
  }
  return [...map.entries()]
    .map(([label, v]) => ({
      label,
      count: v.count,
      balance_mm: Math.round(v.balance * 100) / 100,
      share: safeDiv(v.balance, totalBal),
    }))
    .sort((a, b) => b.balance_mm - a.balance_mm);
}

export function calculatePortfolioStats(loans: LoanRecord[]): PortfolioStats {
  if (loans.length === 0) {
    return {
      loan_count: 0,
      total_balance_mm: 0,
      weighted_avg_interest_rate: 0,
      weighted_avg_ltv_current: 0,
      weighted_avg_dti: 0,
      weighted_avg_remaining_term_months: 0,
      interest_type_composition: [],
      property_type_composition: [],
      age_histogram: [],
      active_loan_count: 0,
    };
  }

  const totalBal = loans.reduce((s, l) => s + l.current_balance_mm, 0);
  const wavg = (field: keyof LoanRecord): number => {
    if (totalBal === 0) return 0;
    const num = loans.reduce(
      (s, l) => s + (Number(l[field]) || 0) * l.current_balance_mm,
      0,
    );
    return num / totalBal;
  };

  // Age histogram 5歳刻み
  const bins: AgeHistogramBin[] = [];
  for (let b = 25; b < 70; b += 5) {
    bins.push({ label: `${b}-${b + 4}`, min: b, max: b + 4, count: 0, share: 0 });
  }
  const totalLoans = loans.length;
  for (const l of loans) {
    const bucket = bins.find((b) => l.borrower_age >= b.min && l.borrower_age <= b.max);
    if (bucket) bucket.count += 1;
  }
  for (const b of bins) b.share = safeDiv(b.count, totalLoans);

  return {
    loan_count: totalLoans,
    total_balance_mm: Math.round(totalBal * 10) / 10,
    weighted_avg_interest_rate: wavg("interest_rate"),
    weighted_avg_ltv_current: wavg("ltv_current"),
    weighted_avg_dti: wavg("dti"),
    weighted_avg_remaining_term_months: wavg("remaining_term_months"),
    interest_type_composition: buildComposition(loans, "interest_type"),
    property_type_composition: buildComposition(loans, "property_type"),
    age_histogram: bins,
    active_loan_count: loans.filter(
      (l) => l.status !== "期限前弁済" && l.status !== "デフォルト",
    ).length,
  };
}

// -----------------------------------------------------------------------------
// Aggregations
// -----------------------------------------------------------------------------
export interface ReasonBucket {
  label: string;
  count: number;
  amount_mm: number;
  share: number;
}

export function aggregatePrepaymentsByReason(prepayments: PrepaymentRecord[]): ReasonBucket[] {
  const map = new Map<string, { count: number; amount: number }>();
  let total = 0;
  for (const p of prepayments) {
    const cur = map.get(p.reason) ?? { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += p.prepayment_amount_mm;
    total += p.prepayment_amount_mm;
    map.set(p.reason, cur);
  }
  return [...map.entries()]
    .map(([label, v]) => ({
      label,
      count: v.count,
      amount_mm: Math.round(v.amount * 100) / 100,
      share: safeDiv(v.amount, total),
    }))
    .sort((a, b) => b.amount_mm - a.amount_mm);
}

export function aggregateDefaultsByCause(defaults: DefaultRecord[]): ReasonBucket[] {
  const map = new Map<string, { count: number; amount: number }>();
  let total = 0;
  for (const d of defaults) {
    const cur = map.get(d.cause) ?? { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += d.default_balance_mm;
    total += d.default_balance_mm;
    map.set(d.cause, cur);
  }
  return [...map.entries()]
    .map(([label, v]) => ({
      label,
      count: v.count,
      amount_mm: Math.round(v.amount * 100) / 100,
      share: safeDiv(v.amount, total),
    }))
    .sort((a, b) => b.amount_mm - a.amount_mm);
}

export interface DisposalBucket {
  label: string;
  count: number;
  default_balance_mm: number;
  recovery_amount_mm: number;
  loss_amount_mm: number;
}

export function aggregateDefaultsByDisposalStatus(
  defaults: DefaultRecord[],
): DisposalBucket[] {
  const map = new Map<string, DisposalBucket>();
  for (const d of defaults) {
    const cur = map.get(d.disposal_status) ?? {
      label: d.disposal_status,
      count: 0,
      default_balance_mm: 0,
      recovery_amount_mm: 0,
      loss_amount_mm: 0,
    };
    cur.count += 1;
    cur.default_balance_mm += d.default_balance_mm;
    cur.recovery_amount_mm += d.recovery_amount_mm;
    cur.loss_amount_mm += d.loss_amount_mm;
    map.set(d.disposal_status, cur);
  }
  return [...map.values()]
    .map((b) => ({
      ...b,
      default_balance_mm: Math.round(b.default_balance_mm * 100) / 100,
      recovery_amount_mm: Math.round(b.recovery_amount_mm * 100) / 100,
      loss_amount_mm: Math.round(b.loss_amount_mm * 100) / 100,
    }))
    .sort((a, b) => b.default_balance_mm - a.default_balance_mm);
}

// -----------------------------------------------------------------------------
// predictTriggerBreach — 線形回帰による抵触月予測
// -----------------------------------------------------------------------------
export interface TriggerPrediction {
  trigger_name: string;
  threshold: number;
  direction: "above_breach" | "below_breach";
  latest_value: number;
  slope_per_month: number;
  months_until_breach: number | null; // null = 既に抵触 or 方向違いで到達しない
  breach_month: string | null;
  current_breach: boolean;
}

function linearRegression(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0 };
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - meanX) * (values[i] - meanY);
    den += (i - meanX) * (i - meanX);
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: meanY - slope * meanX };
}

function addMonths(ym: string, months: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function predictTriggerBreach(
  history: TriggerTest[],
  triggerName: string,
  opts: { lookbackMonths?: number } = {},
): TriggerPrediction {
  const lookback = opts.lookbackMonths ?? 6;
  const series = history
    .filter((h) => h.trigger_name === triggerName)
    .sort((a, b) => a.month.localeCompare(b.month));
  if (series.length === 0) {
    throw new Error(`predictTriggerBreach: no history for ${triggerName}`);
  }
  const recent = series.slice(-lookback);
  const values = recent.map((r) => r.current_value);
  const latest = recent[recent.length - 1];
  const { slope } = linearRegression(values);
  const direction = latest.direction;
  const threshold = latest.threshold;
  const latestValue = latest.current_value;
  const currentBreach = direction === "above_breach" ? latestValue > threshold : latestValue < threshold;

  let months: number | null = null;
  if (!currentBreach) {
    const diff = threshold - latestValue;
    if (direction === "above_breach" && slope > 0) {
      months = diff / slope;
    } else if (direction === "below_breach" && slope < 0) {
      months = diff / slope; // diff<0, slope<0 → positive
    }
    if (months !== null && (months <= 0 || !Number.isFinite(months))) months = null;
  }

  return {
    trigger_name: triggerName,
    threshold,
    direction,
    latest_value: latestValue,
    slope_per_month: slope,
    months_until_breach: months,
    breach_month: months !== null ? addMonths(latest.month, Math.ceil(months)) : null,
    current_breach: currentBreach,
  };
}
