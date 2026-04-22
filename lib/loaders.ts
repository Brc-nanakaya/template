/**
 * データローダー (papaparse ベース)。
 * 主な責務:
 *   1. CSV/JSON テキストをドメイン型にパース（ブラウザとサーバー双方で使える純粋関数）
 *   2. public/sample-data/ からの読み込み（server fs / browser fetch の isomorphic 実装）
 *   3. ユーザーアップロードされた CSV/JSON テキストをドメイン型に変換
 *
 * 数値パースは日本語案件の CSV で頻出する「1,234」「0.65%」「UTF-8 BOM」に対応。
 */

import Papa from "papaparse";
import type {
  DealInfo,
  DelinquencyAging,
  DefaultRecord,
  LoanRecord,
  MonthlyPerformance,
  PrepaymentRecord,
  RegionalBreakdown,
  ServicerMonthlyReport,
  TriggerTest,
  TrustDataset,
  WaterfallRecord,
} from "./types";

// -----------------------------------------------------------------------------
// Parse helpers
// -----------------------------------------------------------------------------

/** 先頭の UTF-8 BOM (U+FEFF) を除去。 */
export function stripBOM(text: string): string {
  if (text.charCodeAt(0) === 0xfeff) return text.slice(1);
  return text;
}

/**
 * 「1,234」「 1,234.5 」「¥1,234百万円」「0.65%」「N/A」「-」等を number に変換。
 * 空文字・非数値は NaN ではなく null を返す。パーセント表記は 0.65% → 0.0065 に正規化。
 */
export function parseNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (s === "" || s === "-" || s === "—" || /^n\/?a$/i.test(s)) return null;
  const isPercent = s.endsWith("%");
  const cleaned = s.replace(/[¥,\s円百万]/g, "").replace(/%$/, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return isPercent ? n / 100 : n;
}

/** `true`/`false`/`1`/`0`/`はい`/`いいえ` を boolean に。空は null。 */
export function parseBoolean(raw: unknown): boolean | null {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw === "boolean") return raw;
  const s = String(raw).trim().toLowerCase();
  if (["true", "1", "yes", "はい", "y"].includes(s)) return true;
  if (["false", "0", "no", "いいえ", "n"].includes(s)) return false;
  return null;
}

// -----------------------------------------------------------------------------
// Generic CSV parser — 数値列を自動で number 化
// -----------------------------------------------------------------------------
export function parseCSV<T = Record<string, unknown>>(
  csv: string,
  options?: { numericColumns?: (keyof T)[]; booleanColumns?: (keyof T)[] },
): T[] {
  const text = stripBOM(csv);
  const result = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false, // manually coerce to avoid unintended casts
  });
  if (result.errors.length) {
    throw new Error(`CSV parse errors: ${result.errors.map((e) => e.message).join("; ")}`);
  }
  const numericCols = new Set(options?.numericColumns ?? []) as Set<string>;
  const booleanCols = new Set(options?.booleanColumns ?? []) as Set<string>;
  return result.data.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (numericCols.has(k)) {
        out[k] = parseNumber(v);
      } else if (booleanCols.has(k)) {
        out[k] = parseBoolean(v);
      } else {
        out[k] = typeof v === "string" ? v.trim() : v;
      }
    }
    return out as T;
  });
}

// -----------------------------------------------------------------------------
// Domain parsers — strongly typed wrappers around parseCSV
// -----------------------------------------------------------------------------

const MONTHLY_NUMERIC: (keyof MonthlyPerformance)[] = [
  "pool_balance_mm",
  "scheduled_principal_mm",
  "prepayment_principal_mm",
  "prepayment_count",
  "default_principal_mm",
  "default_count",
  "recovery_mm",
  "delinquency_30_59_rate",
  "delinquency_60_89_rate",
  "delinquency_90_plus_rate",
  "cpr_annual",
  "cdr_annual",
  "cumulative_default_rate",
  "cumulative_prepayment_rate",
  "senior_balance_mm",
  "subordinated_balance_mm",
  "subordination_ratio",
  "servicer_recovery_rate",
];

const LOAN_NUMERIC: (keyof LoanRecord)[] = [
  "borrower_age",
  "interest_rate",
  "original_balance_mm",
  "current_balance_mm",
  "original_term_months",
  "remaining_term_months",
  "ltv_original",
  "ltv_current",
  "dti",
  "delinquency_days",
];

const AGING_NUMERIC: (keyof DelinquencyAging)[] = ["loan_count", "balance_mm"];

const PREPAY_NUMERIC: (keyof PrepaymentRecord)[] = [
  "prepayment_amount_mm",
  "remaining_balance_before_mm",
  "original_balance_mm",
];

const DEFAULT_NUMERIC: (keyof DefaultRecord)[] = [
  "default_balance_mm",
  "recovery_amount_mm",
  "loss_amount_mm",
];

const WATERFALL_NUMERIC: (keyof WaterfallRecord)[] = ["priority_order", "amount_mm"];

const TRIGGER_NUMERIC: (keyof TriggerTest)[] = ["threshold", "current_value"];
const TRIGGER_BOOLEAN: (keyof TriggerTest)[] = ["breach"];

const REGION_NUMERIC: (keyof RegionalBreakdown)[] = [
  "loan_count",
  "balance_mm",
  "share",
  "delinquency_90_plus_rate",
  "avg_balance_mm",
];

export const parseMonthlyPerformance = (csv: string): MonthlyPerformance[] =>
  parseCSV<MonthlyPerformance>(csv, { numericColumns: MONTHLY_NUMERIC });

export const parseLoanTape = (csv: string): LoanRecord[] =>
  parseCSV<LoanRecord>(csv, { numericColumns: LOAN_NUMERIC });

export const parseDelinquencyAging = (csv: string): DelinquencyAging[] =>
  parseCSV<DelinquencyAging>(csv, { numericColumns: AGING_NUMERIC });

export const parsePrepaymentDetail = (csv: string): PrepaymentRecord[] =>
  parseCSV<PrepaymentRecord>(csv, { numericColumns: PREPAY_NUMERIC });

export const parseDefaultRecovery = (csv: string): DefaultRecord[] =>
  parseCSV<DefaultRecord>(csv, { numericColumns: DEFAULT_NUMERIC });

export const parseWaterfallHistory = (csv: string): WaterfallRecord[] =>
  parseCSV<WaterfallRecord>(csv, { numericColumns: WATERFALL_NUMERIC });

export const parseTriggerHistory = (csv: string): TriggerTest[] =>
  parseCSV<TriggerTest>(csv, {
    numericColumns: TRIGGER_NUMERIC,
    booleanColumns: TRIGGER_BOOLEAN,
  });

export const parseRegionalBreakdown = (csv: string): RegionalBreakdown[] =>
  parseCSV<RegionalBreakdown>(csv, { numericColumns: REGION_NUMERIC });

export function parseDealInfo(json: string): DealInfo {
  return JSON.parse(stripBOM(json)) as DealInfo;
}

export function parseServicerMonthlyReport(json: string): ServicerMonthlyReport {
  return JSON.parse(stripBOM(json)) as ServicerMonthlyReport;
}

// -----------------------------------------------------------------------------
// Isomorphic file reader — fs on server / test, fetch on browser
// -----------------------------------------------------------------------------
async function readSample(relativePath: string): Promise<string> {
  if (typeof window === "undefined") {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const full = path.resolve(process.cwd(), "public", "sample-data", relativePath);
    return fs.readFile(full, "utf8");
  }
  const res = await fetch(`/sample-data/${relativePath}`);
  if (!res.ok) throw new Error(`Failed to load sample-data/${relativePath}: ${res.status}`);
  return res.text();
}

// -----------------------------------------------------------------------------
// Per-file loaders — each reads public/sample-data and returns typed records
// -----------------------------------------------------------------------------
export async function loadDealInfo(): Promise<DealInfo> {
  return parseDealInfo(await readSample("deal_info.json"));
}

export async function loadMonthlyPerformance(): Promise<MonthlyPerformance[]> {
  return parseMonthlyPerformance(await readSample("monthly_performance.csv"));
}

export async function loadLoanTape(): Promise<LoanRecord[]> {
  return parseLoanTape(await readSample("loan_tape.csv"));
}

export async function loadDelinquencyAging(): Promise<DelinquencyAging[]> {
  return parseDelinquencyAging(await readSample("delinquency_aging_history.csv"));
}

export async function loadPrepaymentDetail(): Promise<PrepaymentRecord[]> {
  return parsePrepaymentDetail(await readSample("prepayment_detail.csv"));
}

export async function loadDefaultRecovery(): Promise<DefaultRecord[]> {
  return parseDefaultRecovery(await readSample("default_recovery.csv"));
}

export async function loadWaterfallHistory(): Promise<WaterfallRecord[]> {
  return parseWaterfallHistory(await readSample("cf_waterfall_history.csv"));
}

export async function loadTriggerHistory(): Promise<TriggerTest[]> {
  return parseTriggerHistory(await readSample("trigger_test_history.csv"));
}

export async function loadRegionalBreakdown(): Promise<RegionalBreakdown[]> {
  return parseRegionalBreakdown(await readSample("regional_breakdown.csv"));
}

export async function loadServicerMonthlyReport(month = "202603"): Promise<ServicerMonthlyReport> {
  return parseServicerMonthlyReport(await readSample(`servicer_monthly_report_${month}.json`));
}

// -----------------------------------------------------------------------------
// Parallel aggregate loader
// -----------------------------------------------------------------------------
export async function loadAllSampleData(): Promise<TrustDataset> {
  const [
    deal,
    monthly,
    loans,
    aging,
    prepayments,
    defaults,
    waterfall,
    triggers,
    regional,
    servicerReport,
  ] = await Promise.all([
    loadDealInfo(),
    loadMonthlyPerformance(),
    loadLoanTape(),
    loadDelinquencyAging(),
    loadPrepaymentDetail(),
    loadDefaultRecovery(),
    loadWaterfallHistory(),
    loadTriggerHistory(),
    loadRegionalBreakdown(),
    loadServicerMonthlyReport(),
  ]);
  return {
    deal,
    monthly,
    loans,
    aging,
    prepayments,
    defaults,
    waterfall,
    triggers,
    regional,
    servicerReport,
  };
}

// -----------------------------------------------------------------------------
// User upload — convert uploaded File/Blob/string content into typed records
// -----------------------------------------------------------------------------
export type UploadKind =
  | "deal_info"
  | "monthly_performance"
  | "loan_tape"
  | "delinquency_aging"
  | "prepayment_detail"
  | "default_recovery"
  | "waterfall"
  | "trigger"
  | "regional"
  | "servicer_report";

type UploadResult =
  | { kind: "deal_info"; data: DealInfo }
  | { kind: "monthly_performance"; data: MonthlyPerformance[] }
  | { kind: "loan_tape"; data: LoanRecord[] }
  | { kind: "delinquency_aging"; data: DelinquencyAging[] }
  | { kind: "prepayment_detail"; data: PrepaymentRecord[] }
  | { kind: "default_recovery"; data: DefaultRecord[] }
  | { kind: "waterfall"; data: WaterfallRecord[] }
  | { kind: "trigger"; data: TriggerTest[] }
  | { kind: "regional"; data: RegionalBreakdown[] }
  | { kind: "servicer_report"; data: ServicerMonthlyReport };

export function convertUserUpload(kind: UploadKind, text: string): UploadResult {
  switch (kind) {
    case "deal_info":
      return { kind, data: parseDealInfo(text) };
    case "monthly_performance":
      return { kind, data: parseMonthlyPerformance(text) };
    case "loan_tape":
      return { kind, data: parseLoanTape(text) };
    case "delinquency_aging":
      return { kind, data: parseDelinquencyAging(text) };
    case "prepayment_detail":
      return { kind, data: parsePrepaymentDetail(text) };
    case "default_recovery":
      return { kind, data: parseDefaultRecovery(text) };
    case "waterfall":
      return { kind, data: parseWaterfallHistory(text) };
    case "trigger":
      return { kind, data: parseTriggerHistory(text) };
    case "regional":
      return { kind, data: parseRegionalBreakdown(text) };
    case "servicer_report":
      return { kind, data: parseServicerMonthlyReport(text) };
  }
}
