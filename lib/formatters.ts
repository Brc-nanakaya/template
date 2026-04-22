/**
 * 信託レポート向けの数値・比率フォーマッタ。
 *
 * - 金額は `1,234百万円 (12.3億円)` 形式で 3桁区切り＋億円併記（process.md 共通ルール）
 * - 比率は 0.0065 → `0.65%` のように小数を % 変換
 * - 前月比は +/- 記号付きで直感的に把握できる表示に統一
 */

const numberFormat = new Intl.NumberFormat("ja-JP");
const numberFormat1 = new Intl.NumberFormat("ja-JP", {
  maximumFractionDigits: 1,
});

/** `1,234百万円 (12.3億円)` 形式。金額入力は百万円単位。 */
export function fmtMm(valueMm: number, opts: { showOku?: boolean } = {}): string {
  const { showOku = true } = opts;
  const base = `${numberFormat1.format(valueMm)}百万円`;
  if (!showOku) return base;
  const oku = valueMm / 100;
  return `${base} (${oku.toFixed(1)}億円)`;
}

/** `96,651` など 3桁区切り整数のみ。 */
export function fmtNumber(value: number): string {
  return numberFormat.format(value);
}

/** 小数を % に整形。`0.0065 → "0.65%"`（既定 2 桁）。 */
export function fmtPct(rate: number, digits = 2): string {
  return `${(rate * 100).toFixed(digits)}%`;
}

/** 前月比を符号付きで % 表示。`0.012 → "+1.2%"`、`-0.005 → "-0.5%"`。 */
export function fmtSignedPct(rate: number, digits = 1): string {
  const pct = rate * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(digits)}%`;
}

/** pp（percentage point）差を符号付きで表示。`0.0015 → "+0.15pp"`。 */
export function fmtSignedPp(diff: number, digits = 2): string {
  const pp = diff * 100;
  const sign = pp >= 0 ? "+" : "";
  return `${sign}${pp.toFixed(digits)}pp`;
}

/** 前月比（百万円）を符号付きで。`-1200 → "-1,200百万円"`。 */
export function fmtSignedMm(diffMm: number): string {
  const sign = diffMm >= 0 ? "+" : "";
  return `${sign}${numberFormat1.format(diffMm)}百万円`;
}

/** `YYYY-MM` → `YYYY年MM月` 表記。 */
export function fmtMonth(month: string): string {
  const [y, m] = month.split("-");
  if (!y || !m) return month;
  return `${y}年${m}月`;
}
