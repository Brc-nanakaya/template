/**
 * 信託期中管理レポート向けドメイン型定義。
 * CSV ヘッダーと完全一致する（数値は number、ID・区分は string、日付は ISO "YYYY-MM-DD" または "YYYY-MM" 文字列）。
 *
 * 命名規約:
 *   - `*_mm` は百万円単位
 *   - `*_rate` は小数（0.0065 = 0.65%）
 *   - `*_date` は ISO "YYYY-MM-DD"、`*_month` は "YYYY-MM"
 */

// -----------------------------------------------------------------------------
// deal_info.json
// -----------------------------------------------------------------------------
export interface TriggerThresholds {
  cumulative_default_rate: number;
  delinquency_90_rate: number;
  cpr_annual: number;
  subordination_ratio_min: number;
}

export interface DealInfo {
  deal_id: string;
  deal_name: string;
  contract_number: string;
  asset_type: string;
  originator: string;
  servicer: string;
  backup_servicer: string;
  trustee: string;
  servicer_rating: string;
  servicer_rating_agency: string;
  closing_date: string;
  report_month: string;
  report_cutoff_date: string;
  initial_pool_balance_yen: number;
  initial_pool_balance_mm: number;
  senior_coupon_rate: number;
  subordinated_coupon_rate: number;
  senior_initial_balance_mm: number;
  subordinated_initial_balance_mm: number;
  trigger_thresholds: TriggerThresholds;
  waterfall_priority: string[];
}

// -----------------------------------------------------------------------------
// monthly_performance.csv
// -----------------------------------------------------------------------------
export interface MonthlyPerformance {
  month: string; // "YYYY-MM"
  pool_balance_mm: number;
  scheduled_principal_mm: number;
  prepayment_principal_mm: number;
  prepayment_count: number;
  default_principal_mm: number;
  default_count: number;
  recovery_mm: number;
  delinquency_30_59_rate: number;
  delinquency_60_89_rate: number;
  delinquency_90_plus_rate: number;
  cpr_annual: number;
  cdr_annual: number;
  cumulative_default_rate: number;
  cumulative_prepayment_rate: number;
  senior_balance_mm: number;
  subordinated_balance_mm: number;
  subordination_ratio: number;
  servicer_recovery_rate: number;
}

// -----------------------------------------------------------------------------
// loan_tape.csv
// -----------------------------------------------------------------------------
export type LoanStatus =
  | "正常"
  | "延滞30-59日"
  | "延滞60-89日"
  | "延滞90日以上"
  | "デフォルト"
  | "期限前弁済";

export type PropertyType = "戸建" | "マンション" | "土地" | "その他";
export type InterestType = "固定" | "変動" | "固定期間選択";

export interface LoanRecord {
  loan_id: string;
  borrower_age: number;
  prefecture: string;
  property_type: PropertyType;
  interest_type: InterestType;
  interest_rate: number;
  original_balance_mm: number;
  current_balance_mm: number;
  original_term_months: number;
  remaining_term_months: number;
  ltv_original: number;
  ltv_current: number;
  dti: number;
  status: LoanStatus;
  delinquency_days: number;
  origination_date: string;
}

// -----------------------------------------------------------------------------
// delinquency_aging_history.csv
// -----------------------------------------------------------------------------
export type DelinquencyBucket = "30-59日" | "60-89日" | "90日以上";

export interface DelinquencyAging {
  month: string;
  bucket: DelinquencyBucket;
  loan_count: number;
  balance_mm: number;
}

// -----------------------------------------------------------------------------
// prepayment_detail.csv
// -----------------------------------------------------------------------------
export type PrepaymentReason = "借換" | "売却" | "自己資金" | "相続" | "その他";

export interface PrepaymentRecord {
  loan_id: string;
  prepayment_date: string;
  prepayment_amount_mm: number;
  reason: PrepaymentReason;
  remaining_balance_before_mm: number;
  original_balance_mm: number;
}

// -----------------------------------------------------------------------------
// default_recovery.csv
// -----------------------------------------------------------------------------
export type DefaultCause =
  | "リストラ等収入減"
  | "病気・事故"
  | "離婚"
  | "事業不振"
  | "死亡"
  | "その他";

export type DisposalStatus =
  | "任意売却完了"
  | "競売申立済"
  | "競売完了"
  | "担保処分中"
  | "交渉中";

export interface DefaultRecord {
  loan_id: string;
  default_date: string;
  default_balance_mm: number;
  cause: DefaultCause;
  disposal_status: DisposalStatus;
  recovery_amount_mm: number;
  loss_amount_mm: number;
  disposal_date: string;
}

// -----------------------------------------------------------------------------
// cf_waterfall_history.csv
// -----------------------------------------------------------------------------
export type WaterfallTier =
  | "信託報酬・諸費用"
  | "サービシング手数料"
  | "優先受益権 利息"
  | "優先受益権 元本"
  | "準備金積立"
  | "劣後受益権 配当";

export interface WaterfallRecord {
  month: string;
  priority_order: number;
  tier_name: WaterfallTier;
  amount_mm: number;
}

// -----------------------------------------------------------------------------
// trigger_test_history.csv
// -----------------------------------------------------------------------------
export type TriggerName =
  | "累積デフォルト率"
  | "90日以上延滞率"
  | "CPR（年率）"
  | "劣後比率下限";

export type TriggerDirection = "above_breach" | "below_breach";

export interface TriggerTest {
  month: string;
  trigger_name: TriggerName;
  threshold: number;
  current_value: number;
  breach: boolean;
  direction: TriggerDirection;
}

// -----------------------------------------------------------------------------
// regional_breakdown.csv
// -----------------------------------------------------------------------------
export interface RegionalBreakdown {
  prefecture: string;
  loan_count: number;
  balance_mm: number;
  share: number;
  delinquency_90_plus_rate: number;
  avg_balance_mm: number;
}

// -----------------------------------------------------------------------------
// Anomaly — detectAnomalies (T05) の出力型
// -----------------------------------------------------------------------------
export type AnomalySeverity = "high" | "medium" | "low";

export type AnomalyKind =
  | "delinquency_surge"
  | "default_surge"
  | "trigger_approaching"
  | "cpr_swing"
  | "servicer_recovery_decline"
  | "servicer_rating_change"
  | "subordinated_dividend_decline"
  | "cumulative_default_acceleration";

export interface Anomaly {
  id: string;
  kind: AnomalyKind;
  severity: AnomalySeverity;
  title: string;
  description: string; // 具体的な数値を含む日本語コメント
  metric_value: number | null;
  metric_reference: number | null;
  detected_month: string;
  sectionAnchor?: string; // ダッシュボードのスクロール先 (T08)
}

// -----------------------------------------------------------------------------
// servicer_monthly_report_<YYYYMM>.json
// -----------------------------------------------------------------------------
export interface ServicerMonthlyReport {
  report_month: string;
  deal_id: string;
  servicer: string;
  servicer_rating: string;
  submission_date: string;
  pool: {
    balance_mm: number;
    previous_balance_mm: number;
    scheduled_principal_mm: number;
    prepayment_principal_mm: number;
    default_principal_mm: number;
    recovery_mm: number;
  };
  delinquency: {
    rate_30_59: number;
    rate_60_89: number;
    rate_90_plus: number;
  };
  performance: {
    cpr_annual: number;
    cdr_annual: number;
    cumulative_default_rate: number;
    cumulative_prepayment_rate: number;
    servicer_recovery_rate: number;
  };
  beneficiary_interest: {
    senior_balance_mm: number;
    subordinated_balance_mm: number;
    subordination_ratio: number;
  };
  trigger_status: Array<{
    name: string;
    threshold: number;
    current_value: number;
    breach: boolean;
    direction: TriggerDirection;
  }>;
  totals: {
    loan_count_current: number;
    default_cumulative_count: number;
    prepayment_cumulative_count: number;
  };
  notes: string;
}

// -----------------------------------------------------------------------------
// Aggregate wrapper returned by loadAllSampleData (T03)
// -----------------------------------------------------------------------------
export interface TrustDataset {
  deal: DealInfo;
  monthly: MonthlyPerformance[];
  loans: LoanRecord[];
  aging: DelinquencyAging[];
  prepayments: PrepaymentRecord[];
  defaults: DefaultRecord[];
  waterfall: WaterfallRecord[];
  triggers: TriggerTest[];
  regional: RegionalBreakdown[];
  servicerReport: ServicerMonthlyReport;
}
