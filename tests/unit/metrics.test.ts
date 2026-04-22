// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  aggregateDefaultsByCause,
  aggregateDefaultsByDisposalStatus,
  aggregatePrepaymentsByReason,
  calculateMonthlyMetrics,
  calculatePortfolioStats,
  predictTriggerBreach,
} from "@/lib/metrics";
import type {
  DefaultRecord,
  LoanRecord,
  MonthlyPerformance,
  PrepaymentRecord,
  TriggerTest,
} from "@/lib/types";

// -----------------------------------------------------------------------------
// fixtures
// -----------------------------------------------------------------------------
function mk<T>(base: T, overrides: Partial<T> = {}): T {
  return { ...base, ...overrides };
}

const monthlyBase: MonthlyPerformance = {
  month: "2026-02",
  pool_balance_mm: 100_000,
  scheduled_principal_mm: 800,
  prepayment_principal_mm: 600,
  prepayment_count: 20,
  default_principal_mm: 30,
  default_count: 3,
  recovery_mm: 18,
  delinquency_30_59_rate: 0.01,
  delinquency_60_89_rate: 0.005,
  delinquency_90_plus_rate: 0.006,
  cpr_annual: 0.07,
  cdr_annual: 0.0035,
  cumulative_default_rate: 0.004,
  cumulative_prepayment_rate: 0.10,
  senior_balance_mm: 90_000,
  subordinated_balance_mm: 10_000,
  subordination_ratio: 0.10,
  servicer_recovery_rate: 0.72,
};

const monthlyMar: MonthlyPerformance = mk(monthlyBase, {
  month: "2026-03",
  pool_balance_mm: 96_651,
  delinquency_90_plus_rate: 0.0065,
  prepayment_principal_mm: 720,
  default_principal_mm: 35,
  cumulative_default_rate: 0.00435,
});

const loanBase: LoanRecord = {
  loan_id: "L00001",
  borrower_age: 42,
  prefecture: "東京都",
  property_type: "マンション",
  interest_type: "固定",
  interest_rate: 0.012,
  original_balance_mm: 45,
  current_balance_mm: 30,
  original_term_months: 360,
  remaining_term_months: 280,
  ltv_original: 0.85,
  ltv_current: 0.65,
  dti: 0.28,
  status: "正常",
  delinquency_days: 0,
  origination_date: "2020-04-15",
};

// -----------------------------------------------------------------------------
// calculateMonthlyMetrics
// -----------------------------------------------------------------------------
describe("calculateMonthlyMetrics", () => {
  it("returns latest row KPI and 前月比 correctly", () => {
    const m = calculateMonthlyMetrics([monthlyBase, monthlyMar], { initialPoolMm: 120_000 });
    expect(m.month).toBe("2026-03");
    expect(m.pool_balance_mm).toBe(96_651);
    expect(m.pool_balance_mom).toBe(-3349);
    expect(m.pool_balance_mom_pct).toBeCloseTo(-0.03349, 5);
    expect(m.remaining_ratio).toBeCloseTo(96_651 / 120_000, 6);
    expect(m.delinquency_total_rate).toBeCloseTo(0.01 + 0.005 + 0.0065, 6);
    expect(m.delinquency_90_mom_pp).toBeCloseTo(0.0005, 6);
  });

  it("handles single-month input (no 前月比)", () => {
    const m = calculateMonthlyMetrics([monthlyMar], { initialPoolMm: 120_000 });
    expect(m.pool_balance_mom).toBe(0);
    expect(m.pool_balance_mom_pct).toBe(0);
    expect(m.delinquency_90_mom_pp).toBe(0);
  });

  it("throws on empty monthly array", () => {
    expect(() => calculateMonthlyMetrics([], { initialPoolMm: 120_000 })).toThrow();
  });
});

// -----------------------------------------------------------------------------
// calculatePortfolioStats
// -----------------------------------------------------------------------------
describe("calculatePortfolioStats", () => {
  it("computes balance-weighted average interest rate", () => {
    // 2本: 30百万円×1.0% と 60百万円×2.0% → 加重平均 (30*0.01 + 60*0.02)/90 = 1.6667%
    const loans: LoanRecord[] = [
      mk(loanBase, { loan_id: "A", current_balance_mm: 30, interest_rate: 0.01 }),
      mk(loanBase, { loan_id: "B", current_balance_mm: 60, interest_rate: 0.02 }),
    ];
    const stats = calculatePortfolioStats(loans);
    expect(stats.weighted_avg_interest_rate).toBeCloseTo((30 * 0.01 + 60 * 0.02) / 90, 6);
    expect(stats.total_balance_mm).toBe(90);
  });

  it("builds composition sorted by balance desc", () => {
    const loans: LoanRecord[] = [
      mk(loanBase, { loan_id: "A", property_type: "戸建", current_balance_mm: 10 }),
      mk(loanBase, { loan_id: "B", property_type: "マンション", current_balance_mm: 40 }),
      mk(loanBase, { loan_id: "C", property_type: "マンション", current_balance_mm: 30 }),
    ];
    const stats = calculatePortfolioStats(loans);
    expect(stats.property_type_composition[0].label).toBe("マンション");
    expect(stats.property_type_composition[0].balance_mm).toBeCloseTo(70, 4);
    expect(stats.property_type_composition[0].share).toBeCloseTo(70 / 80, 4);
  });

  it("returns zeros on empty input (ゼロ除算回避)", () => {
    const stats = calculatePortfolioStats([]);
    expect(stats.loan_count).toBe(0);
    expect(stats.weighted_avg_interest_rate).toBe(0);
    expect(stats.interest_type_composition).toEqual([]);
  });

  it("bins borrower_age in 5-year buckets", () => {
    const ages = [28, 30, 34, 35, 41, 60];
    const loans = ages.map((a, i) =>
      mk(loanBase, { loan_id: `L${i}`, borrower_age: a, current_balance_mm: 10 }),
    );
    const stats = calculatePortfolioStats(loans);
    const bin30 = stats.age_histogram.find((b) => b.label === "30-34");
    expect(bin30?.count).toBe(2); // 30, 34
    const bin25 = stats.age_histogram.find((b) => b.label === "25-29");
    expect(bin25?.count).toBe(1); // 28
    const bin35 = stats.age_histogram.find((b) => b.label === "35-39");
    expect(bin35?.count).toBe(1); // 35
  });
});

// -----------------------------------------------------------------------------
// aggregations
// -----------------------------------------------------------------------------
describe("aggregatePrepaymentsByReason", () => {
  const prepayments: PrepaymentRecord[] = [
    { loan_id: "L1", prepayment_date: "2026-02-01", prepayment_amount_mm: 40, reason: "借換", remaining_balance_before_mm: 40, original_balance_mm: 50 },
    { loan_id: "L2", prepayment_date: "2026-02-15", prepayment_amount_mm: 30, reason: "借換", remaining_balance_before_mm: 30, original_balance_mm: 50 },
    { loan_id: "L3", prepayment_date: "2026-03-01", prepayment_amount_mm: 20, reason: "売却", remaining_balance_before_mm: 20, original_balance_mm: 40 },
  ];
  it("sums amount by reason and sorts desc", () => {
    const agg = aggregatePrepaymentsByReason(prepayments);
    expect(agg[0].label).toBe("借換");
    expect(agg[0].amount_mm).toBe(70);
    expect(agg[0].count).toBe(2);
    expect(agg[0].share).toBeCloseTo(70 / 90, 4);
  });

  it("returns empty array for empty input", () => {
    expect(aggregatePrepaymentsByReason([])).toEqual([]);
  });
});

describe("aggregateDefaultsByCause / ByDisposalStatus", () => {
  const defaults: DefaultRecord[] = [
    { loan_id: "L1", default_date: "2025-12-01", default_balance_mm: 25, cause: "リストラ等収入減", disposal_status: "任意売却完了", recovery_amount_mm: 18, loss_amount_mm: 7, disposal_date: "2026-02-10" },
    { loan_id: "L2", default_date: "2026-01-15", default_balance_mm: 30, cause: "離婚", disposal_status: "任意売却完了", recovery_amount_mm: 22, loss_amount_mm: 8, disposal_date: "2026-03-01" },
    { loan_id: "L3", default_date: "2026-02-20", default_balance_mm: 20, cause: "リストラ等収入減", disposal_status: "競売申立済", recovery_amount_mm: 0, loss_amount_mm: 0, disposal_date: "" },
  ];
  it("aggregateDefaultsByCause sums balance by cause", () => {
    const agg = aggregateDefaultsByCause(defaults);
    expect(agg[0].label).toBe("リストラ等収入減");
    expect(agg[0].amount_mm).toBe(45);
    expect(agg[0].count).toBe(2);
  });

  it("aggregateDefaultsByDisposalStatus accumulates recovery/loss", () => {
    const agg = aggregateDefaultsByDisposalStatus(defaults);
    const taniIt = agg.find((a) => a.label === "任意売却完了");
    expect(taniIt?.count).toBe(2);
    expect(taniIt?.recovery_amount_mm).toBe(40);
    expect(taniIt?.loss_amount_mm).toBe(15);
  });
});

// -----------------------------------------------------------------------------
// predictTriggerBreach
// -----------------------------------------------------------------------------
describe("predictTriggerBreach", () => {
  function mkHistory(values: number[], threshold: number, direction: "above_breach" | "below_breach"): TriggerTest[] {
    return values.map((v, i) => ({
      month: `2025-${String(i + 1).padStart(2, "0")}`,
      trigger_name: "累積デフォルト率",
      threshold,
      current_value: v,
      breach: direction === "above_breach" ? v > threshold : v < threshold,
      direction,
    }));
  }

  it("predicts future breach when trending toward threshold", () => {
    // 0.010 → 0.015 → 0.020 → 0.025 → 0.030 → 0.035 (slope 0.005/mo), threshold 0.05
    const history = mkHistory([0.010, 0.015, 0.020, 0.025, 0.030, 0.035], 0.05, "above_breach");
    const p = predictTriggerBreach(history, "累積デフォルト率");
    expect(p.current_breach).toBe(false);
    expect(p.slope_per_month).toBeCloseTo(0.005, 5);
    expect(p.months_until_breach).toBeCloseTo((0.05 - 0.035) / 0.005, 3);
    expect(p.breach_month).toMatch(/^2025-\d{2}$|^2026-\d{2}$/);
  });

  it("returns null months_until_breach when trending away", () => {
    const history = mkHistory([0.030, 0.028, 0.026, 0.024, 0.022, 0.020], 0.05, "above_breach");
    const p = predictTriggerBreach(history, "累積デフォルト率");
    expect(p.months_until_breach).toBeNull();
    expect(p.breach_month).toBeNull();
  });

  it("flags current_breach=true when already past threshold", () => {
    const history = mkHistory([0.040, 0.045, 0.048, 0.050, 0.053, 0.055], 0.05, "above_breach");
    const p = predictTriggerBreach(history, "累積デフォルト率");
    expect(p.current_breach).toBe(true);
    expect(p.months_until_breach).toBeNull();
  });
});
