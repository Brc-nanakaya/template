import { aggregateMonthly, type MonthlySummaryRow } from "./aggregate";
import { asSalesValues } from "./sales";
import type { CellValue } from "./types";

export interface DashboardKpis {
  totalAmount: number;
  totalQuantity: number;
  rowCount: number;
  /** 売上金額 / 数量（数量 0 のときは 0） */
  avgUnitPrice: number;
  /** 1 明細あたりの平均売上 */
  avgAmountPerRow: number;
  /** 最新月の前月比（%）。比較できる月がなければ null */
  latestMonthChangePct: number | null;
  latestMonth: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface BreakdownRow {
  label: string;
  amount: number;
  quantity: number;
  /** 売上金額の構成比（0〜100） */
  share: number;
}

export interface SalesDashboard {
  kpis: DashboardKpis;
  monthly: MonthlySummaryRow[];
  byRegion: BreakdownRow[];
  bySalesRep: BreakdownRow[];
  byCategory: BreakdownRow[];
  topProducts: BreakdownRow[];
}

type BreakdownKey = "region" | "sales_rep" | "category" | "product";

function breakdown(
  rows: NonNullable<ReturnType<typeof asSalesValues>>[],
  key: BreakdownKey,
  totalAmount: number,
): BreakdownRow[] {
  const groups = new Map<string, { amount: number; quantity: number }>();
  for (const row of rows) {
    const current = groups.get(row[key]) ?? { amount: 0, quantity: 0 };
    current.amount += row.amount;
    current.quantity += row.quantity;
    groups.set(row[key], current);
  }
  return [...groups.entries()]
    .map(([label, v]) => ({
      label,
      amount: v.amount,
      quantity: v.quantity,
      share: totalAmount > 0 ? (v.amount / totalAmount) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount || a.label.localeCompare(b.label));
}

/**
 * sales_data の行からダッシュボード表示用の集計を作る。
 * 売上として解釈できない行（必須値欠け）は集計対象外。
 */
export function buildSalesDashboard(
  rows: Record<string, CellValue>[],
  options?: { topProducts?: number },
): SalesDashboard {
  const sales = rows
    .map((r) => asSalesValues(r))
    .filter((r): r is NonNullable<typeof r> => r != null);

  const totalAmount = sales.reduce((sum, r) => sum + r.amount, 0);
  const totalQuantity = sales.reduce((sum, r) => sum + r.quantity, 0);
  const monthly = aggregateMonthly(rows);

  const latest = monthly.at(-1);
  const previous = monthly.at(-2);
  const latestMonthChangePct =
    latest && previous && previous.totalAmount > 0
      ? ((latest.totalAmount - previous.totalAmount) / previous.totalAmount) * 100
      : null;

  const dates = sales.map((r) => r.date).sort();

  return {
    kpis: {
      totalAmount,
      totalQuantity,
      rowCount: sales.length,
      avgUnitPrice: totalQuantity > 0 ? Math.round(totalAmount / totalQuantity) : 0,
      avgAmountPerRow: sales.length > 0 ? Math.round(totalAmount / sales.length) : 0,
      latestMonthChangePct,
      latestMonth: latest?.month ?? null,
      periodStart: dates[0] ?? null,
      periodEnd: dates.at(-1) ?? null,
    },
    monthly,
    byRegion: breakdown(sales, "region", totalAmount),
    bySalesRep: breakdown(sales, "sales_rep", totalAmount),
    byCategory: breakdown(sales, "category", totalAmount),
    topProducts: breakdown(sales, "product", totalAmount).slice(
      0,
      options?.topProducts ?? 5,
    ),
  };
}
