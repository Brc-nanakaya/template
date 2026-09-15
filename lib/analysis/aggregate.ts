import { asSalesValues } from "./sales";
import type { CellValue } from "./types";

export interface MonthlySummaryRow {
  month: string;
  rowCount: number;
  totalAmount: number;
  avgUnitPrice: number;
}

/**
 * sales_data から月次サマリーを再集計する。
 * （元データの「月次サマリー」シートの代替）
 */
export function aggregateMonthly(
  rows: Record<string, CellValue>[],
): MonthlySummaryRow[] {
  const groups = new Map<
    string,
    { count: number; totalAmount: number; totalQuantity: number }
  >();

  for (const row of rows) {
    const sales = asSalesValues(row);
    if (!sales) continue;
    const month = sales.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;

    const current = groups.get(month) ?? {
      count: 0,
      totalAmount: 0,
      totalQuantity: 0,
    };
    current.count += 1;
    current.totalAmount += sales.amount;
    current.totalQuantity += sales.quantity;
    groups.set(month, current);
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({
      month,
      rowCount: value.count,
      totalAmount: value.totalAmount,
      avgUnitPrice:
        value.totalQuantity > 0
          ? Math.round(value.totalAmount / value.totalQuantity)
          : 0,
    }));
}
