"use client";

import type { CellValue } from "@/lib/analysis/types";

interface DataPreviewTableProps {
  columns: string[];
  rows: Record<string, CellValue>[];
  columnLabels?: Record<string, string>;
  maxRows?: number;
  testId?: string;
}

function formatCell(value: CellValue): string {
  if (value == null) return "";
  if (typeof value === "number") return value.toLocaleString("ja-JP");
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

export function DataPreviewTable({
  columns,
  rows,
  columnLabels,
  maxRows = 50,
  testId = "data-preview-table",
}: DataPreviewTableProps) {
  const visible = rows.slice(0, maxRows);
  const truncated = rows.length > maxRows;

  if (columns.length === 0) {
    return (
      <p
        data-testid={`${testId}-empty`}
        className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground"
      >
        表示するデータがありません
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-black/10">
        <table
          data-testid={testId}
          className="min-w-full border-collapse text-left text-sm"
        >
          <thead className="bg-[#f5f5f5]">
            <tr>
              <th className="sticky left-0 bg-[#f5f5f5] px-3 py-2 text-xs font-semibold text-muted-foreground">
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-[#050505]"
                >
                  {columnLabels?.[col] ?? col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr
                key={i}
                className="border-t border-black/5 odd:bg-white even:bg-[#fafafa]"
              >
                <td className="sticky left-0 bg-inherit px-3 py-2 text-xs text-muted-foreground">
                  {i + 1}
                </td>
                {columns.map((col) => (
                  <td
                    key={col}
                    className="max-w-[240px] truncate whitespace-nowrap px-3 py-2 text-[#050505]"
                    title={formatCell(row[col] ?? null)}
                  >
                    {formatCell(row[col] ?? null)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {truncated && (
        <p className="text-xs text-muted-foreground" data-testid={`${testId}-truncated`}>
          先頭 {maxRows} 行を表示しています（全 {rows.length} 行）
        </p>
      )}
    </div>
  );
}
