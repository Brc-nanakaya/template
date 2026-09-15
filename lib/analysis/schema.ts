/**
 * 売上データ（sales_data）のカラム定義とマスタ。
 * Excel ヘッダーはこの定義の key / label / aliases と突合する。
 */

export const SALES_TABLE_NAME = "sales_data";

export interface AnalysisColumnDef {
  /** Excel ヘッダーと照合するキー（格納カラム名） */
  key: string;
  /** UI 表示名 */
  label: string;
  /** 必須カラムかどうか */
  required?: boolean;
  /** 日本語ヘッダーなどの別名 */
  aliases?: string[];
}

export const ANALYSIS_COLUMNS: AnalysisColumnDef[] = [
  {
    key: "date",
    label: "日付",
    required: true,
    aliases: ["売上日", "伝票日", "計上日"],
  },
  {
    key: "region",
    label: "地域",
    required: true,
    aliases: ["エリア", "地域名"],
  },
  {
    key: "sales_rep",
    label: "営業担当者",
    required: true,
    aliases: ["営業担当者名", "担当者", "担当者名", "営業"],
  },
  {
    key: "category",
    label: "商品カテゴリ",
    required: true,
    aliases: ["カテゴリ", "カテゴリー", "分類"],
  },
  {
    key: "product",
    label: "商品名",
    required: true,
    aliases: ["商品", "製品", "製品名"],
  },
  {
    key: "quantity",
    label: "数量",
    required: true,
    aliases: ["個数", "qty", "数量（個）"],
  },
  {
    key: "unit_price",
    label: "単価",
    required: true,
    aliases: ["販売単価", "単価（円）"],
  },
  {
    key: "amount",
    label: "売上金額",
    required: true,
    aliases: ["金額", "売上", "売上高"],
  },
];

export const REGIONS = ["東京", "大阪", "名古屋", "福岡", "札幌"] as const;
export const SALES_REPS = [
  "佐藤",
  "鈴木",
  "高橋",
  "田中",
  "伊藤",
  "渡辺",
] as const;
export const CATEGORIES = [
  "コンサルティング",
  "トレーニング",
  "ライセンス",
] as const;

export interface ProductMaster {
  productName: string;
  categoryName: (typeof CATEGORIES)[number];
}

export const PRODUCTS: readonly ProductMaster[] = [
  { productName: "業務プロセス診断", categoryName: "コンサルティング" },
  { productName: "生成AI導入支援", categoryName: "コンサルティング" },
  { productName: "AX基礎研修（使う）", categoryName: "トレーニング" },
  { productName: "AX実践研修（つくる）", categoryName: "トレーニング" },
  { productName: "AX展開研修（広げる）", categoryName: "トレーニング" },
  { productName: "Claude Team ライセンス", categoryName: "ライセンス" },
  {
    productName: "Claude Enterprise ライセンス",
    categoryName: "ライセンス",
  },
];

const PRODUCT_CATEGORY = new Map(
  PRODUCTS.map((p) => [normalizeLookup(p.productName), p.categoryName]),
);

/** 定義済みカラムがあるかどうか */
export function hasDefinedColumns(): boolean {
  return ANALYSIS_COLUMNS.length > 0;
}

/** 定義済みのキー一覧 */
export function definedColumnKeys(): string[] {
  return ANALYSIS_COLUMNS.map((c) => c.key);
}

export function columnLabel(key: string): string {
  return ANALYSIS_COLUMNS.find((c) => c.key === key)?.label ?? key;
}

export function columnLabelMap(): Record<string, string> {
  return Object.fromEntries(ANALYSIS_COLUMNS.map((c) => [c.key, c.label]));
}

/** 比較用に空白を除去して小文字化する */
export function normalizeLookup(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

export function expectedCategoryForProduct(
  productName: string,
): (typeof CATEGORIES)[number] | undefined {
  return PRODUCT_CATEGORY.get(normalizeLookup(productName));
}

const HEADER_TO_KEY = (() => {
  const map = new Map<string, string>();
  for (const col of ANALYSIS_COLUMNS) {
    map.set(normalizeLookup(col.key), col.key);
    map.set(normalizeLookup(col.label), col.key);
    for (const alias of col.aliases ?? []) {
      map.set(normalizeLookup(alias), col.key);
    }
  }
  return map;
})();

/** Excel ヘッダー文字列を sales_data のカラムキーへ変換する */
export function mapHeaderToKey(header: unknown): string | null {
  if (header == null) return null;
  const normalized = normalizeLookup(String(header));
  if (!normalized) return null;
  return HEADER_TO_KEY.get(normalized) ?? null;
}
