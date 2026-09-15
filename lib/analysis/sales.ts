import {
  ANALYSIS_COLUMNS,
  CATEGORIES,
  PRODUCTS,
  REGIONS,
  SALES_REPS,
  expectedCategoryForProduct,
  mapHeaderToKey,
  normalizeLookup,
} from "./schema";
import type { CellValue } from "./types";

const TOTAL_LABELS = new Set([
  "合計",
  "総計",
  "小計",
  "計",
  "total",
  "grandtotal",
  "sum",
]);

export type SalesSheetKind = "summary" | "sales" | "other";

export interface SalesValues {
  date: string;
  region: string;
  sales_rep: string;
  category: string;
  product: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface NormalizedSalesRow {
  values: SalesValues;
  warnings: string[];
}

export function classifySheetName(name: string): SalesSheetKind {
  const compact = name.replace(/\s+/g, "");
  if (/サマリー|summary|集計/i.test(compact)) return "summary";
  if (/売上|sales|明細/i.test(compact)) return "sales";
  return "other";
}

export function headerMatchCount(row: unknown[]): number {
  const hits = new Set<string>();
  for (const cell of row) {
    const key = mapHeaderToKey(cell);
    if (key) hits.add(key);
  }
  return hits.size;
}

/** 先頭付近から売上ヘッダー行を探す */
export function findHeaderRowIndex(matrix: unknown[][]): number {
  const requiredCount = ANALYSIS_COLUMNS.filter((c) => c.required).length;
  const limit = Math.min(15, matrix.length);
  let bestIndex = 0;
  let bestHits = -1;

  for (let i = 0; i < limit; i++) {
    const hits = headerMatchCount(matrix[i] ?? []);
    if (hits > bestHits) {
      bestHits = hits;
      bestIndex = i;
    }
    if (hits >= requiredCount) return i;
  }

  return bestHits >= 4 ? bestIndex : 0;
}

export function pickSheetName(
  sheetNames: string[],
  inspectHeaderHits: (name: string) => number,
): { sheetName: string; skippedSummarySheets: string[] } {
  if (sheetNames.length === 0) {
    throw new Error("シートが見つかりません");
  }

  const skippedSummarySheets = sheetNames.filter(
    (n) => classifySheetName(n) === "summary",
  );
  const salesNamed = sheetNames.filter(
    (n) => classifySheetName(n) === "sales",
  );
  if (salesNamed[0]) {
    return { sheetName: salesNamed[0], skippedSummarySheets };
  }

  const candidates = sheetNames.filter(
    (n) => classifySheetName(n) !== "summary",
  );
  const search = candidates.length > 0 ? candidates : sheetNames;

  let best = search[0] as string;
  let bestHits = -1;
  for (const name of search) {
    const hits = inspectHeaderHits(name);
    if (hits > bestHits) {
      bestHits = hits;
      best = name;
    }
  }

  return { sheetName: best, skippedSummarySheets };
}

function isTotalLabel(value: unknown): boolean {
  if (value == null) return false;
  const compact = normalizeLookup(String(value));
  if (!compact) return false;
  if (TOTAL_LABELS.has(compact)) return true;
  return compact.startsWith("合計") || compact.startsWith("総計");
}

function isNoteLabel(value: unknown): boolean {
  if (value == null) return false;
  const text = String(value).trim();
  return (
    text.startsWith("※") ||
    text.startsWith("注記") ||
    text.includes("ダミーデータ") ||
    text.includes("検証用")
  );
}

/** 合計行・注記行など、sales_data に格納しない行か */
export function isExcludedRow(line: unknown[]): boolean {
  const cells = line.filter((c) => c != null && String(c).trim() !== "");
  if (cells.length === 0) return false;
  if (cells.some((c) => isTotalLabel(c))) return true;
  if (cells.some((c) => isNoteLabel(c)) && cells.length <= 3) return true;
  return false;
}

export function isTotalRow(line: unknown[]): boolean {
  return line.some((c) => isTotalLabel(c));
}

function formatDateYmd(date: Date): string {
  const iso = date.toISOString();
  if (iso.endsWith("T00:00:00.000Z")) return iso.slice(0, 10);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function coerceDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateYmd(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 20_000_101 && value < 21_001_231 && Number.isInteger(value)) {
      const s = String(value);
      return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
    }
    if (value > 20_000 && value < 80_000) {
      const utc = new Date(
        Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000,
      );
      return utc.toISOString().slice(0, 10);
    }
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    const matched = trimmed.match(
      /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/,
    );
    if (matched) {
      return `${matched[1]}-${matched[2].padStart(2, "0")}-${matched[3].padStart(2, "0")}`;
    }
  }
  return null;
}

export function coerceInteger(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "boolean") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const rounded = Math.round(value);
    if (Math.abs(value - rounded) < 1e-6) return rounded;
    return null;
  }
  if (typeof value === "string") {
    const normalized = value.replace(/[,¥￥円\s]/g, "");
    if (!normalized) return null;
    const n = Number(normalized);
    if (!Number.isFinite(n)) return null;
    const rounded = Math.round(n);
    if (Math.abs(n - rounded) < 1e-6) return rounded;
  }
  return null;
}

export function coerceText(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  const text = String(value).trim();
  return text || null;
}

function inList(value: string, list: readonly string[]): boolean {
  const needle = normalizeLookup(value);
  return list.some((item) => normalizeLookup(item) === needle);
}

function canonicalFromList(
  value: string,
  list: readonly string[],
): string {
  const needle = normalizeLookup(value);
  return list.find((item) => normalizeLookup(item) === needle) ?? value;
}

/**
 * 1 行を sales_data の型へ正規化する。
 * 必須値が欠けている場合は null。
 */
export function normalizeSalesRow(
  raw: Record<string, CellValue>,
  rowNumber: number,
): NormalizedSalesRow | null {
  const date = coerceDate(raw.date);
  const region = coerceText(raw.region);
  const salesRep = coerceText(raw.sales_rep);
  const category = coerceText(raw.category);
  const product = coerceText(raw.product);
  const quantity = coerceInteger(raw.quantity);
  const unitPrice = coerceInteger(raw.unit_price);
  let amount = coerceInteger(raw.amount);

  if (!date || !region || !salesRep || !category || !product) return null;
  if (quantity == null || quantity <= 0) return null;
  if (unitPrice == null || unitPrice < 0) return null;

  const computed = quantity * unitPrice;
  const warnings: string[] = [];

  if (amount == null) {
    amount = computed;
  } else if (amount !== computed) {
    warnings.push(
      `${rowNumber} 行目: 売上金額 ${amount} が 数量×単価 (${computed}) と不一致のため計算値で格納します`,
    );
    amount = computed;
  }

  const canonicalRegion = canonicalFromList(region, REGIONS);
  const canonicalRep = canonicalFromList(salesRep, SALES_REPS);
  const canonicalCategory = canonicalFromList(category, CATEGORIES);
  const canonicalProduct =
    PRODUCTS.find((p) => normalizeLookup(p.productName) === normalizeLookup(product))
      ?.productName ?? product;

  if (!inList(canonicalRegion, REGIONS)) {
    warnings.push(`${rowNumber} 行目: 未知の地域「${region}」`);
  }
  if (!inList(canonicalRep, SALES_REPS)) {
    warnings.push(`${rowNumber} 行目: 未知の営業担当者「${salesRep}」`);
  }
  if (!inList(canonicalCategory, CATEGORIES)) {
    warnings.push(`${rowNumber} 行目: 未知のカテゴリ「${category}」`);
  }
  if (
    !PRODUCTS.some(
      (p) => normalizeLookup(p.productName) === normalizeLookup(canonicalProduct),
    )
  ) {
    warnings.push(`${rowNumber} 行目: 未知の商品「${product}」`);
  }

  const expectedCategory = expectedCategoryForProduct(canonicalProduct);
  const storedCategory = expectedCategory ?? canonicalCategory;
  if (expectedCategory && expectedCategory !== canonicalCategory) {
    warnings.push(
      `${rowNumber} 行目: 商品「${canonicalProduct}」のカテゴリを「${expectedCategory}」に補正しました`,
    );
  }

  return {
    values: {
      date,
      region: canonicalRegion,
      sales_rep: canonicalRep,
      category: storedCategory,
      product: canonicalProduct,
      quantity,
      unit_price: unitPrice,
      amount,
    },
    warnings,
  };
}

export function asSalesValues(
  values: Record<string, CellValue>,
): SalesValues | null {
  const date = typeof values.date === "string" ? values.date : null;
  const region = typeof values.region === "string" ? values.region : null;
  const salesRep =
    typeof values.sales_rep === "string" ? values.sales_rep : null;
  const category =
    typeof values.category === "string" ? values.category : null;
  const product = typeof values.product === "string" ? values.product : null;
  const quantity =
    typeof values.quantity === "number" ? values.quantity : null;
  const unitPrice =
    typeof values.unit_price === "number" ? values.unit_price : null;
  const amount = typeof values.amount === "number" ? values.amount : null;
  if (
    !date ||
    !region ||
    !salesRep ||
    !category ||
    !product ||
    quantity == null ||
    unitPrice == null ||
    amount == null
  ) {
    return null;
  }
  return {
    date,
    region,
    sales_rep: salesRep,
    category,
    product,
    quantity,
    unit_price: unitPrice,
    amount,
  };
}
