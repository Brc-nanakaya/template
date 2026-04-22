/**
 * Deterministic sample data generator for 信託期中管理レポート.
 * Produces the 10 files under public/sample-data/ that downstream loaders,
 * dashboards and E2E tests consume.
 *
 * Target anchors (aligned with process.md completion criteria):
 *   - Pool balance at current month ≈ 96,651百万円
 *   - 90+ day delinquency rate ≈ 0.5–0.7%
 *   - 都道府県別残高 Top1 = 東京都
 *   - 期限前弁済理由 最大 = 借換
 *   - loan_tape 200件 / monthly_performance 24ヶ月 / default_recovery 118件 / prepayment_detail 586件
 */

import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve(process.cwd(), "public", "sample-data");
fs.mkdirSync(OUT, { recursive: true });

// --- seeded PRNG (Mulberry32) -------------------------------------------------
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260331);
const pick = <T>(arr: T[]) => arr[Math.floor(rng() * arr.length)];
const between = (a: number, b: number) => a + (b - a) * rng();
const intBetween = (a: number, b: number) => Math.floor(between(a, b + 1));

// --- calendar helpers ---------------------------------------------------------
// 24 months ending at 2026-03.
const REPORT_YEAR = 2026;
const REPORT_MONTH = 3;
function monthsBack(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(REPORT_YEAR, REPORT_MONTH - 1 - i, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    out.push(`${y}-${m}`);
  }
  return out;
}
const MONTHS_24 = monthsBack(24);

// --- constants ---------------------------------------------------------------
const PREFECTURES: { name: string; share: number }[] = [
  { name: "東京都", share: 0.225 },
  { name: "神奈川県", share: 0.135 },
  { name: "埼玉県", share: 0.095 },
  { name: "千葉県", share: 0.085 },
  { name: "大阪府", share: 0.09 },
  { name: "愛知県", share: 0.07 },
  { name: "兵庫県", share: 0.045 },
  { name: "京都府", share: 0.03 },
  { name: "福岡県", share: 0.035 },
  { name: "北海道", share: 0.028 },
  { name: "宮城県", share: 0.018 },
  { name: "広島県", share: 0.018 },
  { name: "静岡県", share: 0.022 },
  { name: "茨城県", share: 0.015 },
  { name: "栃木県", share: 0.01 },
  { name: "群馬県", share: 0.009 },
  { name: "新潟県", share: 0.01 },
  { name: "長野県", share: 0.008 },
  { name: "岐阜県", share: 0.008 },
  { name: "三重県", share: 0.007 },
  { name: "滋賀県", share: 0.007 },
  { name: "奈良県", share: 0.006 },
  { name: "岡山県", share: 0.008 },
  { name: "山口県", share: 0.005 },
  { name: "熊本県", share: 0.008 },
  { name: "鹿児島県", share: 0.005 },
  { name: "沖縄県", share: 0.006 },
  // 残りは小さなシェアで充当（47都道府県に拡張）
];
const OTHER_PREFS = [
  "青森県", "岩手県", "秋田県", "山形県", "福島県",
  "富山県", "石川県", "福井県", "山梨県", "和歌山県",
  "鳥取県", "島根県", "徳島県", "香川県", "愛媛県", "高知県",
  "佐賀県", "長崎県", "大分県", "宮崎県",
];
for (const p of OTHER_PREFS) PREFECTURES.push({ name: p, share: 0.003 });

const PROPERTY_TYPES = [
  { name: "戸建", share: 0.42 },
  { name: "マンション", share: 0.48 },
  { name: "土地", share: 0.07 },
  { name: "その他", share: 0.03 },
];
const INTEREST_TYPES = [
  { name: "固定", share: 0.55 },
  { name: "変動", share: 0.35 },
  { name: "固定期間選択", share: 0.10 },
];
const PREPAY_REASONS = [
  { name: "借換", share: 0.48 },
  { name: "売却", share: 0.22 },
  { name: "自己資金", share: 0.18 },
  { name: "相続", share: 0.07 },
  { name: "その他", share: 0.05 },
];
const DEFAULT_CAUSES = [
  { name: "リストラ等収入減", share: 0.34 },
  { name: "病気・事故", share: 0.22 },
  { name: "離婚", share: 0.18 },
  { name: "事業不振", share: 0.14 },
  { name: "死亡", share: 0.08 },
  { name: "その他", share: 0.04 },
];
const DISPOSAL_STATUSES = [
  "任意売却完了",
  "競売申立済",
  "競売完了",
  "担保処分中",
  "交渉中",
];

function weightedPick<T extends { name: string; share: number }>(opts: T[]): string {
  const total = opts.reduce((s, o) => s + o.share, 0);
  let r = rng() * total;
  for (const o of opts) {
    r -= o.share;
    if (r <= 0) return o.name;
  }
  return opts[opts.length - 1].name;
}

// --- output helpers ----------------------------------------------------------
function writeJSON(name: string, data: unknown) {
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(data, null, 2) + "\n", "utf8");
}
function writeCSV(name: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const body = [header.join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
  fs.writeFileSync(path.join(OUT, name), body + "\n", "utf8");
}

// -----------------------------------------------------------------------------
// 1. deal_info.json
// -----------------------------------------------------------------------------
const DEAL = {
  deal_id: "SBIST-RMBS-2024-01",
  deal_name: "SBI新生住宅ローン信託 第1回特定社債型受益権",
  contract_number: "TR-2024-00012",
  asset_type: "住宅ローン債権（信託受益権）",
  originator: "SBI新生銀行",
  servicer: "SBI新生銀行",
  backup_servicer: "株式会社日本住宅ローン債権回収",
  trustee: "SBI新生信託銀行",
  servicer_rating: "A+",
  servicer_rating_agency: "JCR",
  closing_date: "2024-04-25",
  report_month: `${REPORT_YEAR}-${String(REPORT_MONTH).padStart(2, "0")}`,
  report_cutoff_date: "2026-03-31",
  initial_pool_balance_yen: 120_000_000_000,
  initial_pool_balance_mm: 120_000,
  senior_coupon_rate: 0.0092,
  subordinated_coupon_rate: 0.022,
  senior_initial_balance_mm: 108_000,
  subordinated_initial_balance_mm: 12_000,
  trigger_thresholds: {
    cumulative_default_rate: 0.011,
    delinquency_90_rate: 0.008,
    cpr_annual: 0.18,
    subordination_ratio_min: 0.09,
  },
  waterfall_priority: [
    "信託報酬・諸費用",
    "サービシング手数料",
    "優先受益権 利息",
    "優先受益権 元本",
    "準備金積立",
    "劣後受益権 配当",
  ],
};
writeJSON("deal_info.json", DEAL);

// -----------------------------------------------------------------------------
// 2. monthly_performance.csv — 24 months, current month pool balance 96,651 mm
// -----------------------------------------------------------------------------
// Pool balance decays from 120,000 to 96,651 over 24 months (smooth + noise).
const POOL_START = 120_000;
const POOL_END = 96_651;
const monthlyRows: Record<string, number | string>[] = [];
let cumDefaultMm = 0;
let cumDefaultCount = 0;
let cumPrepayMm = 0;
let cumPrepayCount = 0;
for (let i = 0; i < 24; i++) {
  const t = i / 23;
  const base = POOL_START + (POOL_END - POOL_START) * t;
  const noise = (rng() - 0.5) * 40;
  const pool = i === 23 ? POOL_END : Math.round((base + noise) * 10) / 10;
  const prevPool = i === 0 ? POOL_START : (monthlyRows[i - 1].pool_balance_mm as number);

  // Prepayment: ~0.6-0.9% per month of pool balance
  const cpr_monthly = between(0.006, 0.009);
  const prepayMm = Math.round(prevPool * cpr_monthly * 10) / 10;
  const prepayCount = intBetween(18, 32);
  cumPrepayMm += prepayMm;
  cumPrepayCount += prepayCount;

  // Scheduled amortization: residual to hit target pool
  // 当月（i=23）は Rule 2 (default surge) を発火させるため意図的に件数を底上げ
  const defaultMm = Math.round(prevPool * between(0.0002, 0.0005) * 100) / 100;
  const defaultCount = i === 23 ? 11 : intBetween(3, 7);
  cumDefaultMm += defaultMm;
  cumDefaultCount += defaultCount;

  const scheduledMm = Math.max(0, Math.round((prevPool - pool - prepayMm - defaultMm) * 10) / 10);

  // Delinquency rates — rising slightly over time, then stabilizing
  const del30 = between(0.008, 0.013);
  const del60 = between(0.003, 0.006);
  // 90日以上延滞率: 最終4ヶ月（i=20..23）を単調増加させ、Rule 1（3ヶ月連続上昇）と
  //   Rule 3（閾値 0.008 の70%超）を発火させる。KPI 表示レンジ 0.5-0.7% も満たす。
  const del90Ramp: Record<number, number> = { 20: 0.0056, 21: 0.006, 22: 0.0063, 23: 0.0068 };
  const del90 = del90Ramp[i] ?? between(0.0045, 0.0056);

  const cpr_annual = 1 - Math.pow(1 - cpr_monthly, 12);
  const cdr_annual = 1 - Math.pow(1 - defaultMm / prevPool, 12);

  // Servicer recovery — trending down 0.5pp over 24m
  const recovery = 0.72 - i * 0.002 + (rng() - 0.5) * 0.01;

  const seniorBal = Math.round(Math.max(0, 108_000 - (POOL_START - pool) * 0.92) * 10) / 10;
  const subBal = Math.round(Math.max(0, pool - seniorBal) * 10) / 10;

  monthlyRows.push({
    month: MONTHS_24[i],
    pool_balance_mm: pool,
    scheduled_principal_mm: scheduledMm,
    prepayment_principal_mm: prepayMm,
    prepayment_count: prepayCount,
    default_principal_mm: defaultMm,
    default_count: defaultCount,
    recovery_mm: Math.round(defaultMm * recovery * 100) / 100,
    delinquency_30_59_rate: Math.round(del30 * 10000) / 10000,
    delinquency_60_89_rate: Math.round(del60 * 10000) / 10000,
    delinquency_90_plus_rate: Math.round(del90 * 10000) / 10000,
    cpr_annual: Math.round(cpr_annual * 10000) / 10000,
    cdr_annual: Math.round(cdr_annual * 10000) / 10000,
    cumulative_default_rate: Math.round((cumDefaultMm / 120_000) * 10000) / 10000,
    cumulative_prepayment_rate: Math.round((cumPrepayMm / 120_000) * 10000) / 10000,
    senior_balance_mm: seniorBal,
    subordinated_balance_mm: subBal,
    subordination_ratio: subBal > 0 ? Math.round((subBal / pool) * 10000) / 10000 : 0,
    servicer_recovery_rate: Math.round(recovery * 10000) / 10000,
  });
}
writeCSV(
  "monthly_performance.csv",
  Object.keys(monthlyRows[0]) as string[],
  monthlyRows.map((r) => Object.values(r)) as (string | number)[][],
);

// -----------------------------------------------------------------------------
// 3. delinquency_aging_history.csv — 24 months x aging buckets (件数・残高)
// -----------------------------------------------------------------------------
const agingHeader = [
  "month",
  "bucket",
  "loan_count",
  "balance_mm",
];
const agingRows: (string | number)[][] = [];
for (let i = 0; i < 24; i++) {
  const pool = monthlyRows[i].pool_balance_mm as number;
  const buckets = [
    { name: "30-59日", rate: monthlyRows[i].delinquency_30_59_rate as number },
    { name: "60-89日", rate: monthlyRows[i].delinquency_60_89_rate as number },
    { name: "90日以上", rate: monthlyRows[i].delinquency_90_plus_rate as number },
  ];
  for (const b of buckets) {
    const bal = Math.round(pool * b.rate * 10) / 10;
    const count = Math.max(1, Math.round(bal / 28));
    agingRows.push([MONTHS_24[i], b.name, count, bal]);
  }
}
writeCSV("delinquency_aging_history.csv", agingHeader, agingRows);

// -----------------------------------------------------------------------------
// 4. loan_tape.csv — 200件 representative sample
// -----------------------------------------------------------------------------
const loanHeader = [
  "loan_id",
  "borrower_age",
  "prefecture",
  "property_type",
  "interest_type",
  "interest_rate",
  "original_balance_mm",
  "current_balance_mm",
  "original_term_months",
  "remaining_term_months",
  "ltv_original",
  "ltv_current",
  "dti",
  "status",
  "delinquency_days",
  "origination_date",
];
const loanRows: (string | number)[][] = [];
const STATUSES_WEIGHTS: { status: string; w: number }[] = [
  { status: "正常", w: 0.955 },
  { status: "延滞30-59日", w: 0.012 },
  { status: "延滞60-89日", w: 0.005 },
  { status: "延滞90日以上", w: 0.006 },
  { status: "デフォルト", w: 0.012 },
  { status: "期限前弁済", w: 0.010 },
];
function pickStatus(): string {
  let r = rng();
  for (const s of STATUSES_WEIGHTS) {
    r -= s.w;
    if (r <= 0) return s.status;
  }
  return "正常";
}
for (let i = 1; i <= 200; i++) {
  const pref = weightedPick(PREFECTURES);
  const propType = weightedPick(PROPERTY_TYPES);
  const interestType = weightedPick(INTEREST_TYPES);
  const rate = interestType === "変動" ? between(0.004, 0.007) : between(0.009, 0.015);
  const origBal = Math.round(between(25, 68) * 10) / 10;
  const pctPaid = between(0.08, 0.55);
  const curBal = Math.round(origBal * (1 - pctPaid) * 10) / 10;
  const origTerm = [240, 300, 360, 420][intBetween(0, 3)];
  const elapsed = Math.round(origTerm * pctPaid);
  const ltvO = Math.round(between(0.7, 0.95) * 100) / 100;
  const ltvC = Math.round(ltvO * (1 - pctPaid) * 100) / 100;
  const status = pickStatus();
  let delinquencyDays = 0;
  if (status === "延滞30-59日") delinquencyDays = intBetween(30, 59);
  else if (status === "延滞60-89日") delinquencyDays = intBetween(60, 89);
  else if (status === "延滞90日以上") delinquencyDays = intBetween(90, 180);
  else if (status === "デフォルト") delinquencyDays = intBetween(180, 365);
  const age = intBetween(28, 62);
  const yearsBack = intBetween(1, 15);
  const origDate = new Date(REPORT_YEAR - yearsBack, intBetween(0, 11), intBetween(1, 28));
  loanRows.push([
    `L${String(i).padStart(5, "0")}`,
    age,
    pref,
    propType,
    interestType,
    Math.round(rate * 10000) / 10000,
    origBal,
    curBal,
    origTerm,
    origTerm - elapsed,
    ltvO,
    ltvC,
    Math.round(between(0.15, 0.35) * 100) / 100,
    status,
    delinquencyDays,
    origDate.toISOString().slice(0, 10),
  ]);
}
writeCSV("loan_tape.csv", loanHeader, loanRows);

// -----------------------------------------------------------------------------
// 5. prepayment_detail.csv — 586件 over 24 months
// -----------------------------------------------------------------------------
const prepayHeader = [
  "loan_id",
  "prepayment_date",
  "prepayment_amount_mm",
  "reason",
  "remaining_balance_before_mm",
  "original_balance_mm",
];
const prepayRows: (string | number)[][] = [];
for (let i = 0; i < 586; i++) {
  const monthIdx = intBetween(0, 23);
  const day = intBetween(1, 28);
  const [y, m] = MONTHS_24[monthIdx].split("-");
  const reason = weightedPick(PREPAY_REASONS);
  const remainBefore = Math.round(between(8, 55) * 10) / 10;
  const amount = Math.round(remainBefore * between(0.7, 1.0) * 10) / 10;
  prepayRows.push([
    `L${String(intBetween(1, 200)).padStart(5, "0")}`,
    `${y}-${m}-${String(day).padStart(2, "0")}`,
    amount,
    reason,
    remainBefore,
    Math.round(remainBefore * between(1.3, 2.1) * 10) / 10,
  ]);
}
writeCSV("prepayment_detail.csv", prepayHeader, prepayRows);

// -----------------------------------------------------------------------------
// 6. default_recovery.csv — 118件
// -----------------------------------------------------------------------------
const defaultHeader = [
  "loan_id",
  "default_date",
  "default_balance_mm",
  "cause",
  "disposal_status",
  "recovery_amount_mm",
  "loss_amount_mm",
  "disposal_date",
];
const defaultRows: (string | number)[][] = [];
for (let i = 0; i < 118; i++) {
  const monthIdx = intBetween(0, 23);
  const day = intBetween(1, 28);
  const [y, m] = MONTHS_24[monthIdx].split("-");
  const cause = weightedPick(DEFAULT_CAUSES);
  const disposal = pick(DISPOSAL_STATUSES);
  const balance = Math.round(between(12, 48) * 10) / 10;
  const recoveryRate = between(0.55, 0.85);
  const recovery = Math.round(balance * recoveryRate * 10) / 10;
  const loss = Math.round((balance - recovery) * 10) / 10;
  const dYear = Number(y);
  const dispDate =
    disposal.includes("完了") || disposal.includes("処分中")
      ? `${dYear + (intBetween(0, 9) > 7 ? 1 : 0)}-${String(intBetween(1, 12)).padStart(2, "0")}-${String(intBetween(1, 28)).padStart(2, "0")}`
      : "";
  defaultRows.push([
    `L${String(intBetween(1, 200)).padStart(5, "0")}`,
    `${y}-${m}-${String(day).padStart(2, "0")}`,
    balance,
    cause,
    disposal,
    recovery,
    loss,
    dispDate,
  ]);
}
writeCSV("default_recovery.csv", defaultHeader, defaultRows);

// -----------------------------------------------------------------------------
// 7. cf_waterfall_history.csv — 24 months × 6 priority tiers
// -----------------------------------------------------------------------------
const wfHeader = ["month", "priority_order", "tier_name", "amount_mm"];
const wfRows: (string | number)[][] = [];
const WF_TIERS: { order: number; name: string; share: number }[] = [
  { order: 1, name: "信託報酬・諸費用", share: 0.01 },
  { order: 2, name: "サービシング手数料", share: 0.018 },
  { order: 3, name: "優先受益権 利息", share: 0.065 },
  { order: 4, name: "優先受益権 元本", share: 0.78 },
  { order: 5, name: "準備金積立", share: 0.03 },
  { order: 6, name: "劣後受益権 配当", share: 0.097 },
];
for (let i = 0; i < 24; i++) {
  const totalCf =
    (monthlyRows[i].scheduled_principal_mm as number) +
    (monthlyRows[i].prepayment_principal_mm as number) +
    (monthlyRows[i].recovery_mm as number) +
    ((monthlyRows[i].pool_balance_mm as number) * 0.0035); // 利息
  for (const t of WF_TIERS) {
    let amount = Math.round(totalCf * t.share * 100) / 100;
    if (t.order === 6) {
      // Subordinated dividend slight downtrend in last 3 months
      const scale = i >= 21 ? 1 - (i - 20) * 0.08 : 1;
      amount = Math.round(amount * scale * 100) / 100;
    }
    wfRows.push([MONTHS_24[i], t.order, t.name, amount]);
  }
}
writeCSV("cf_waterfall_history.csv", wfHeader, wfRows);

// -----------------------------------------------------------------------------
// 8. trigger_test_history.csv — 4 triggers × 24 months
// -----------------------------------------------------------------------------
const trigHeader = [
  "month",
  "trigger_name",
  "threshold",
  "current_value",
  "breach",
  "direction",
];
const trigRows: (string | number)[][] = [];
for (let i = 0; i < 24; i++) {
  const m = monthlyRows[i];
  const items: [string, number, number, "above_breach" | "below_breach"][] = [
    ["累積デフォルト率", DEAL.trigger_thresholds.cumulative_default_rate, m.cumulative_default_rate as number, "above_breach"],
    ["90日以上延滞率", DEAL.trigger_thresholds.delinquency_90_rate, m.delinquency_90_plus_rate as number, "above_breach"],
    ["CPR（年率）", DEAL.trigger_thresholds.cpr_annual, m.cpr_annual as number, "above_breach"],
    ["劣後比率下限", DEAL.trigger_thresholds.subordination_ratio_min, m.subordination_ratio as number, "below_breach"],
  ];
  for (const [name, threshold, value, direction] of items) {
    const breach = direction === "above_breach" ? value > threshold : value < threshold;
    trigRows.push([
      MONTHS_24[i],
      name,
      threshold,
      Math.round(value * 10000) / 10000,
      breach ? "true" : "false",
      direction,
    ]);
  }
}
writeCSV("trigger_test_history.csv", trigHeader, trigRows);

// -----------------------------------------------------------------------------
// 9. regional_breakdown.csv — 都道府県別残高・延滞率（Tokyo top）
// -----------------------------------------------------------------------------
const regionHeader = [
  "prefecture",
  "loan_count",
  "balance_mm",
  "share",
  "delinquency_90_plus_rate",
  "avg_balance_mm",
];
const regionRows: (string | number)[][] = [];
const CURRENT_POOL = POOL_END; // 96,651
const totalShare = PREFECTURES.reduce((s, p) => s + p.share, 0);
let allocatedBalance = 0;
for (let idx = 0; idx < PREFECTURES.length; idx++) {
  const p = PREFECTURES[idx];
  const share = p.share / totalShare;
  const isLast = idx === PREFECTURES.length - 1;
  const balance = isLast
    ? Math.round((CURRENT_POOL - allocatedBalance) * 10) / 10
    : Math.round(CURRENT_POOL * share * 10) / 10;
  allocatedBalance += balance;
  const loanCount = Math.max(1, Math.round(balance / 28));
  const delRate = Math.round(between(0.002, 0.012) * 10000) / 10000;
  const avgBal = Math.round((balance / loanCount) * 100) / 100;
  regionRows.push([
    p.name,
    loanCount,
    balance,
    Math.round(share * 10000) / 10000,
    delRate,
    avgBal,
  ]);
}
writeCSV("regional_breakdown.csv", regionHeader, regionRows);

// -----------------------------------------------------------------------------
// 10. servicer_monthly_report_202603.json — 報告書サマリー
// -----------------------------------------------------------------------------
const cur = monthlyRows[23];
const prev = monthlyRows[22];
const SERVICER_REPORT = {
  report_month: `${REPORT_YEAR}-${String(REPORT_MONTH).padStart(2, "0")}`,
  deal_id: DEAL.deal_id,
  servicer: DEAL.servicer,
  servicer_rating: DEAL.servicer_rating,
  submission_date: "2026-04-15",
  pool: {
    balance_mm: cur.pool_balance_mm,
    previous_balance_mm: prev.pool_balance_mm,
    scheduled_principal_mm: cur.scheduled_principal_mm,
    prepayment_principal_mm: cur.prepayment_principal_mm,
    default_principal_mm: cur.default_principal_mm,
    recovery_mm: cur.recovery_mm,
  },
  delinquency: {
    rate_30_59: cur.delinquency_30_59_rate,
    rate_60_89: cur.delinquency_60_89_rate,
    rate_90_plus: cur.delinquency_90_plus_rate,
  },
  performance: {
    cpr_annual: cur.cpr_annual,
    cdr_annual: cur.cdr_annual,
    cumulative_default_rate: cur.cumulative_default_rate,
    cumulative_prepayment_rate: cur.cumulative_prepayment_rate,
    servicer_recovery_rate: cur.servicer_recovery_rate,
  },
  beneficiary_interest: {
    senior_balance_mm: cur.senior_balance_mm,
    subordinated_balance_mm: cur.subordinated_balance_mm,
    subordination_ratio: cur.subordination_ratio,
  },
  trigger_status: trigRows
    .filter((r) => r[0] === MONTHS_24[23])
    .map((r) => ({
      name: r[1],
      threshold: r[2],
      current_value: r[3],
      breach: r[4] === "true",
      direction: r[5],
    })),
  totals: {
    loan_count_current: loanRows.filter((r) => r[13] !== "期限前弁済" && r[13] !== "デフォルト").length,
    default_cumulative_count: cumDefaultCount,
    prepayment_cumulative_count: cumPrepayCount,
  },
  notes:
    "本報告書はサービサーが作成した月次期中管理報告です。信託期中管理レポートツールのサンプルデータとして生成されています。",
};
writeJSON("servicer_monthly_report_202603.json", SERVICER_REPORT);

// -----------------------------------------------------------------------------
console.log("sample data generated in", OUT);
console.log({
  loan_tape: loanRows.length,
  monthly_performance: monthlyRows.length,
  default_recovery: defaultRows.length,
  prepayment_detail: prepayRows.length,
  aging_rows: agingRows.length,
  waterfall_rows: wfRows.length,
  trigger_rows: trigRows.length,
  regional_rows: regionRows.length,
});
