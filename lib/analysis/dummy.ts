import {
  CATEGORIES,
  PRODUCTS,
  REGIONS,
  SALES_REPS,
  definedColumnKeys,
} from "./schema";
import type { CellValue, ParsedExcel } from "./types";

/**
 * デモ用のダミー売上データ生成。
 *
 * 営業デモで毎回同じ数字を見せられるよう、乱数はシード固定の
 * xorshift32 を使う（同じ seed なら常に同じデータになる）。
 */

/** 商品ごとの標準単価（円） */
const UNIT_PRICE: Record<string, number> = {
  業務プロセス診断: 1_200_000,
  生成AI導入支援: 3_600_000,
  "AX基礎研修（使う）": 180_000,
  "AX実践研修（つくる）": 420_000,
  "AX展開研修（広げる）": 680_000,
  "Claude Team ライセンス": 3_600,
  "Claude Enterprise ライセンス": 9_000,
};

/** 地域ごとの売上ウェイト（東京が最大になるよう傾ける） */
const REGION_WEIGHT: Record<string, number> = {
  東京: 1.0,
  大阪: 0.62,
  名古屋: 0.45,
  福岡: 0.33,
  札幌: 0.24,
};

function xorshift32(seed: number) {
  let x = seed || 0x9e3779b9;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    // 0 以上 1 未満に正規化
    return ((x >>> 0) % 1_000_000) / 1_000_000;
  };
}

export interface DummySalesOptions {
  /** 生成する明細行数 */
  rows?: number;
  /** 開始月（YYYY-MM）。この月から monthCount ヶ月分を生成する */
  startMonth?: string;
  monthCount?: number;
  /** 乱数シード。同じ値なら同じデータになる */
  seed?: number;
}

const DEFAULTS = {
  rows: 480,
  startMonth: "2026-04",
  monthCount: 12,
  seed: 20260401,
} satisfies Required<DummySalesOptions>;

function pick<T>(rand: () => number, list: readonly T[]): T {
  return list[Math.floor(rand() * list.length) % list.length]!;
}

/** 月末日を考慮して YYYY-MM-DD を組み立てる */
function buildDate(startMonth: string, monthOffset: number, day: number): string {
  const [y, m] = startMonth.split("-").map(Number);
  const base = new Date(Date.UTC(y!, (m! - 1) + monthOffset, 1));
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const d = Math.min(Math.max(day, 1), lastDay);
  return [
    year,
    String(month + 1).padStart(2, "0"),
    String(d).padStart(2, "0"),
  ].join("-");
}

/**
 * ダミーの売上明細を生成する。
 * 戻り値は Excel 取り込み結果と同じ `ParsedExcel` 形なので、
 * `saveDataset()` にそのまま渡せる。
 */
export function generateDummySales(
  options: DummySalesOptions = {},
): ParsedExcel {
  const { rows, startMonth, monthCount, seed } = { ...DEFAULTS, ...options };
  const rand = xorshift32(seed);
  const columns = definedColumnKeys();

  const out: Record<string, CellValue>[] = [];
  for (let i = 0; i < rows; i++) {
    // 月をまたいで均等に散らしつつ、期末（3 月）に寄せる季節性を持たせる
    const monthOffset = Math.floor((i / rows) * monthCount);
    const date = buildDate(startMonth, monthOffset, 1 + Math.floor(rand() * 28));

    const region = pick(rand, REGIONS);
    const salesRep = pick(rand, SALES_REPS);
    const product = pick(rand, PRODUCTS);
    const basePrice = UNIT_PRICE[product.productName] ?? 100_000;

    // 単価は ±10% の値引き・割増をつける（1,000 円単位に丸める）
    const priceJitter = 0.9 + rand() * 0.2;
    const unitPrice = Math.max(
      1_000,
      Math.round((basePrice * priceJitter) / 1_000) * 1_000,
    );

    const isLicense = product.categoryName === "ライセンス";
    const weight = REGION_WEIGHT[region] ?? 0.5;
    const quantity = isLicense
      ? Math.max(5, Math.round(rand() * 120 * weight))
      : Math.max(1, Math.round(rand() * 4 * weight) || 1);

    out.push({
      date,
      region,
      sales_rep: salesRep,
      category: product.categoryName,
      product: product.productName,
      quantity,
      unit_price: unitPrice,
      amount: unitPrice * quantity,
    });
  }

  // 日付順に並べる（Excel から取り込んだ体裁に近づける）
  out.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return {
    sheetName: "売上データ",
    columns,
    rows: out,
    warnings: [],
    skippedTotalRows: 0,
  };
}

/** カテゴリ一覧（デモ表示用の再エクスポート） */
export { CATEGORIES, REGIONS, SALES_REPS };
