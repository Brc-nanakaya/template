"use client";

import type { MonthlySummaryRow } from "@/lib/analysis/aggregate";

interface MonthlySummaryTableProps {
  rows: MonthlySummaryRow[];
}

function formatYen(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

export function MonthlySummaryTable({ rows }: MonthlySummaryTableProps) {
  if (rows.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="monthly-summary">
      <h3 className="text-sm font-semibold text-[#050505]">月次サマリー（再集計）</h3>
      <p className="text-xs text-muted-foreground">
        元データの月次サマリーシートは保存せず、sales_data から再集計しています。
      </p>
      <div className="overflow-x-auto rounded-lg border border-black/10">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="bg-[#f5f5f5]">
            <tr>
              <th className="px-3 py-2 text-xs font-semibold text-[#050505]">月</th>
              <th className="px-3 py-2 text-xs font-semibold text-[#050505]">件数</th>
              <th className="px-3 py-2 text-xs font-semibold text-[#050505]">
                売上合計
              </th>
              <th className="px-3 py-2 text-xs font-semibold text-[#050505]">
                平均単価
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.month}
                className="border-t border-black/5 odd:bg-white even:bg-[#fafafa]"
                data-testid={`monthly-summary-${row.month}`}
              >
                <td className="px-3 py-2">{row.month}</td>
                <td className="px-3 py-2">{row.rowCount.toLocaleString("ja-JP")}</td>
                <td className="px-3 py-2">{formatYen(row.totalAmount)}</td>
                <td className="px-3 py-2">{formatYen(row.avgUnitPrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
