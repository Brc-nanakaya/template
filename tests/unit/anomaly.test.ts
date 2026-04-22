// @vitest-environment node
import { describe, it, expect } from "vitest";
import { detectAnomalies } from "@/lib/anomaly";
import { loadAllSampleData } from "@/lib/loaders";
import type {
  DealInfo,
  DefaultRecord,
  MonthlyPerformance,
  TriggerTest,
  WaterfallRecord,
} from "@/lib/types";

// -----------------------------------------------------------------------------
// fixtures — 単月テンプレとトリガー・ウォーターフォールの最小セット
// -----------------------------------------------------------------------------
const DEAL: DealInfo = {
  deal_id: "TEST",
  deal_name: "test deal",
  contract_number: "TR-TEST",
  asset_type: "住宅ローン",
  originator: "X",
  servicer: "Y",
  backup_servicer: "Z",
  trustee: "T",
  servicer_rating: "A+",
  servicer_rating_agency: "JCR",
  closing_date: "2024-01-01",
  report_month: "2026-03",
  report_cutoff_date: "2026-03-31",
  initial_pool_balance_yen: 120_000_000_000,
  initial_pool_balance_mm: 120_000,
  senior_coupon_rate: 0.01,
  subordinated_coupon_rate: 0.02,
  senior_initial_balance_mm: 108_000,
  subordinated_initial_balance_mm: 12_000,
  trigger_thresholds: {
    cumulative_default_rate: 0.03,
    delinquency_90_rate: 0.015,
    cpr_annual: 0.25,
    subordination_ratio_min: 0.07,
  },
  waterfall_priority: [],
};

function mkMonthly(overrides: Partial<MonthlyPerformance> & { month: string }): MonthlyPerformance {
  return {
    pool_balance_mm: 100_000,
    scheduled_principal_mm: 800,
    prepayment_principal_mm: 600,
    prepayment_count: 20,
    default_principal_mm: 20,
    default_count: 3,
    recovery_mm: 14,
    delinquency_30_59_rate: 0.01,
    delinquency_60_89_rate: 0.005,
    delinquency_90_plus_rate: 0.005,
    cpr_annual: 0.07,
    cdr_annual: 0.003,
    cumulative_default_rate: 0.003,
    cumulative_prepayment_rate: 0.1,
    senior_balance_mm: 90_000,
    subordinated_balance_mm: 10_000,
    subordination_ratio: 0.1,
    servicer_recovery_rate: 0.72,
    ...overrides,
  };
}

function seqMonths(n: number, start = "2024-04"): string[] {
  const [y0, m0] = start.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(y0, m0 - 1 + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

// -----------------------------------------------------------------------------
// Rule-specific tests
// -----------------------------------------------------------------------------
describe("detectAnomalies — Rule 1 延滞率急増", () => {
  it("fires high severity when 90+ rate jumps >15% MoM", () => {
    const months = seqMonths(3);
    const monthly = [
      mkMonthly({ month: months[0], delinquency_90_plus_rate: 0.005 }),
      mkMonthly({ month: months[1], delinquency_90_plus_rate: 0.005 }),
      mkMonthly({ month: months[2], delinquency_90_plus_rate: 0.007 }), // +40%
    ];
    const result = detectAnomalies({ monthly, defaults: [], triggers: [], deal: DEAL, waterfall: [] });
    const hit = result.find((a) => a.kind === "delinquency_surge");
    expect(hit).toBeDefined();
    expect(hit?.severity).toBe("high");
  });

  it("does not fire for small MoM changes and flat trend", () => {
    const months = seqMonths(3);
    const monthly = [
      mkMonthly({ month: months[0], delinquency_90_plus_rate: 0.005 }),
      mkMonthly({ month: months[1], delinquency_90_plus_rate: 0.00505 }),
      mkMonthly({ month: months[2], delinquency_90_plus_rate: 0.00502 }),
    ];
    const result = detectAnomalies({ monthly, defaults: [], triggers: [], deal: DEAL, waterfall: [] });
    expect(result.find((a) => a.kind === "delinquency_surge")).toBeUndefined();
  });
});

describe("detectAnomalies — Rule 2 デフォルト急増", () => {
  it("fires when current count > 1.5x 6-month avg", () => {
    const months = seqMonths(7);
    const monthly = months.map((m, i) =>
      mkMonthly({
        month: m,
        default_count: i < 6 ? 3 : 8, // 6ヶ月平均3、当月8 → 2.67x
      }),
    );
    const result = detectAnomalies({ monthly, defaults: [], triggers: [], deal: DEAL, waterfall: [] });
    const hit = result.find((a) => a.kind === "default_surge");
    expect(hit?.severity).toBe("high");
  });

  it("does not fire within 1.5x threshold", () => {
    const months = seqMonths(7);
    const monthly = months.map((m, i) =>
      mkMonthly({ month: m, default_count: i < 6 ? 4 : 5 }),
    );
    const result = detectAnomalies({ monthly, defaults: [], triggers: [], deal: DEAL, waterfall: [] });
    expect(result.find((a) => a.kind === "default_surge")).toBeUndefined();
  });
});

describe("detectAnomalies — Rule 3 トリガー接近", () => {
  it("fires when current_value reaches 70% of above_breach threshold", () => {
    const months = seqMonths(3);
    const monthly = months.map((m) => mkMonthly({ month: m }));
    const triggers: TriggerTest[] = [
      { month: months[2], trigger_name: "累積デフォルト率", threshold: 0.03, current_value: 0.022, breach: false, direction: "above_breach" },
    ];
    const result = detectAnomalies({ monthly, defaults: [], triggers, deal: DEAL, waterfall: [] });
    const hit = result.find((a) => a.kind === "trigger_approaching");
    expect(hit?.severity).toBe("high");
    expect(hit?.description).toContain("累積デフォルト率");
  });

  it("does not fire below 70% ratio", () => {
    const months = seqMonths(3);
    const monthly = months.map((m) => mkMonthly({ month: m }));
    const triggers: TriggerTest[] = [
      { month: months[2], trigger_name: "累積デフォルト率", threshold: 0.03, current_value: 0.015, breach: false, direction: "above_breach" },
    ];
    const result = detectAnomalies({ monthly, defaults: [], triggers, deal: DEAL, waterfall: [] });
    expect(result.find((a) => a.kind === "trigger_approaching")).toBeUndefined();
  });
});

describe("detectAnomalies — Rule 4 CPR 急変", () => {
  it("fires when CPR swings more than ±30%", () => {
    const months = seqMonths(2);
    const monthly = [
      mkMonthly({ month: months[0], cpr_annual: 0.08 }),
      mkMonthly({ month: months[1], cpr_annual: 0.12 }), // +50%
    ];
    const result = detectAnomalies({ monthly, defaults: [], triggers: [], deal: DEAL, waterfall: [] });
    const hit = result.find((a) => a.kind === "cpr_swing");
    expect(hit?.severity).toBe("medium");
  });
});

describe("detectAnomalies — Rule 5 サービサー回収率低下", () => {
  it("fires when recent 12m avg drops 0.5pp or more vs prior 12m", () => {
    const months = seqMonths(24);
    const monthly = months.map((m, i) =>
      mkMonthly({
        month: m,
        servicer_recovery_rate: i < 12 ? 0.78 : 0.72, // -6pp drop
      }),
    );
    const result = detectAnomalies({ monthly, defaults: [], triggers: [], deal: DEAL, waterfall: [] });
    const hit = result.find((a) => a.kind === "servicer_recovery_decline");
    expect(hit?.severity).toBe("medium");
  });
});

describe("detectAnomalies — Rule 6 サービサー格付変動", () => {
  it("fires high when previousServicerRating differs", () => {
    const months = seqMonths(3);
    const monthly = months.map((m) => mkMonthly({ month: m }));
    const result = detectAnomalies({
      monthly,
      defaults: [],
      triggers: [],
      deal: DEAL,
      waterfall: [],
      previousServicerRating: "A",
    });
    const hit = result.find((a) => a.kind === "servicer_rating_change");
    expect(hit?.severity).toBe("high");
  });

  it("does not fire when ratings match", () => {
    const months = seqMonths(3);
    const monthly = months.map((m) => mkMonthly({ month: m }));
    const result = detectAnomalies({
      monthly,
      defaults: [],
      triggers: [],
      deal: DEAL,
      waterfall: [],
      previousServicerRating: DEAL.servicer_rating,
    });
    expect(result.find((a) => a.kind === "servicer_rating_change")).toBeUndefined();
  });
});

describe("detectAnomalies — Rule 7 劣後受益権配当減少", () => {
  it("fires low when 3 consecutive months decrease", () => {
    const months = seqMonths(3);
    const monthly = months.map((m) => mkMonthly({ month: m }));
    const waterfall: WaterfallRecord[] = [
      { month: months[0], priority_order: 6, tier_name: "劣後受益権 配当", amount_mm: 12 },
      { month: months[1], priority_order: 6, tier_name: "劣後受益権 配当", amount_mm: 10 },
      { month: months[2], priority_order: 6, tier_name: "劣後受益権 配当", amount_mm: 7 },
    ];
    const result = detectAnomalies({ monthly, defaults: [], triggers: [], deal: DEAL, waterfall });
    const hit = result.find((a) => a.kind === "subordinated_dividend_decline");
    expect(hit?.severity).toBe("low");
  });
});

describe("detectAnomalies — Rule 8 累積デフォルト率加速", () => {
  it("fires medium when recent 3m slope > 1.5x prior 3m slope", () => {
    const months = seqMonths(6);
    // prior 3m slope = 0.001 (0.001→0.002)、recent 3m slope = 0.003 (0.002→0.005) → 3x
    const values = [0.001, 0.0015, 0.002, 0.003, 0.004, 0.005];
    const monthly = months.map((m, i) =>
      mkMonthly({ month: m, cumulative_default_rate: values[i] }),
    );
    const result = detectAnomalies({ monthly, defaults: [], triggers: [], deal: DEAL, waterfall: [] });
    const hit = result.find((a) => a.kind === "cumulative_default_acceleration");
    expect(hit?.severity).toBe("medium");
  });
});

// -----------------------------------------------------------------------------
// Integration: full sample data produces >=3 high alerts
// -----------------------------------------------------------------------------
describe("detectAnomalies — sample data integration", () => {
  it("produces at least 3 high alerts across the generated dataset", async () => {
    const ds = await loadAllSampleData();
    // サービサー格付変動も擬似的にテスト（A+ → AA-）
    const anomalies = detectAnomalies({
      monthly: ds.monthly,
      defaults: ds.defaults as DefaultRecord[],
      triggers: ds.triggers,
      deal: ds.deal,
      waterfall: ds.waterfall,
      previousServicerRating: "AA-", // 前月 AA- → 当月 A+ で格下げ扱い
    });
    const highCount = anomalies.filter((a) => a.severity === "high").length;
    expect(highCount).toBeGreaterThanOrEqual(3);
  });
});
