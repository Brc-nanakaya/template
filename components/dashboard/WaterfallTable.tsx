"use client";

/**
 * ウォーターフォール表 (T12)。
 * 当月のキャッシュフロー配分を階層別の棒グラフ＋表で、24 ヶ月の劣後配当推移を折れ線で表示。
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { WaterfallRecord } from "@/lib/types";
import { fmtMm, fmtMonth } from "@/lib/formatters";

export interface WaterfallTableProps {
  waterfall: WaterfallRecord[];
  reportMonth: string;
}

const TIER_COLORS: Record<string, string> = {
  "信託報酬・諸費用": "#64748B",
  "サービシング手数料": "#94A3B8",
  "優先受益権 利息": "#1E3A8A",
  "優先受益権 元本": "#0B2545",
  "準備金積立": "#475569",
  "劣後受益権 配当": "#D4A017",
};

export function WaterfallTable({ waterfall, reportMonth }: WaterfallTableProps) {
  const current = waterfall
    .filter((w) => w.month === reportMonth)
    .sort((a, b) => a.priority_order - b.priority_order);
  const total = current.reduce((s, w) => s + w.amount_mm, 0);

  const barData = current.map((w) => ({
    name: w.tier_name,
    amount: w.amount_mm,
    fill: TIER_COLORS[w.tier_name] ?? "#334155",
  }));

  const subordinatedSeries = waterfall
    .filter((w) => w.tier_name === "劣後受益権 配当")
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((w) => ({ month: w.month, amount: w.amount_mm }));

  return (
    <section
      data-testid="dashboard-waterfall-table"
      aria-label="キャッシュフロー配分"
      className="rounded-xl bg-white p-5 shadow-[0_2px_12px_rgba(11,37,69,0.06)] ring-1 ring-slate-200"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-[#0B2545]">
          キャッシュフロー配分（{fmtMonth(reportMonth)}）
        </h2>
        <span className="text-sm text-slate-500">合計 {fmtMm(total)}</span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={barData}
              layout="vertical"
              margin={{ top: 8, right: 16, bottom: 4, left: 120 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis
                type="number"
                tickFormatter={(v: number) => `${Math.round(v).toLocaleString()}`}
                fontSize={11}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                width={120}
                interval={0}
              />
              <Tooltip formatter={(v: number) => fmtMm(v)} />
              <Bar dataKey="amount" isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="h-64">
          <div className="mb-1 text-xs font-semibold text-slate-600">
            劣後受益権配当 24ヶ月推移
          </div>
          <ResponsiveContainer width="100%" height="92%">
            <LineChart
              data={subordinatedSeries}
              margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" fontSize={10} />
              <YAxis
                tickFormatter={(v: number) => `${Math.round(v).toLocaleString()}`}
                fontSize={10}
              />
              <Tooltip
                formatter={(v: number) => fmtMm(v)}
                labelFormatter={(l: string) => fmtMonth(l)}
              />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#D4A017"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="py-2 pr-4">優先順位</th>
              <th className="py-2 pr-4">階層</th>
              <th className="py-2 text-right">配分額</th>
            </tr>
          </thead>
          <tbody>
            {current.map((w) => (
              <tr
                key={w.priority_order}
                data-testid={`dashboard-waterfall-row-${w.priority_order}`}
                className="border-b border-slate-100"
              >
                <td className="py-2 pr-4 font-mono text-slate-700">
                  {w.priority_order}
                </td>
                <td className="py-2 pr-4 text-slate-800">
                  <span
                    className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                    style={{ backgroundColor: TIER_COLORS[w.tier_name] ?? "#334155" }}
                  />
                  {w.tier_name}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-slate-900">
                  {fmtMm(w.amount_mm)}
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={2} className="py-2 pr-4 text-right text-xs font-bold text-slate-600">
                合計
              </td>
              <td className="py-2 text-right font-mono font-bold tabular-nums text-[#0B2545]">
                {fmtMm(total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
