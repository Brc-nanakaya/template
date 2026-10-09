"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  JapaneseYen,
  Package,
  ReceiptText,
  RefreshCw,
} from "lucide-react";
import {
  buildSalesDashboard,
  type BreakdownRow,
} from "@/lib/analysis/dashboard";
import type { AnalysisDataset } from "@/lib/analysis/types";
import { cn } from "@/lib/utils";

const BRAND = "#bc0017";

function formatYen(value: number): string {
  return `¥${value.toLocaleString("ja-JP")}`;
}

/** 軸・タイル向けの短い円表記（例: ¥1,130万） */
function formatYenCompact(value: number): string {
  if (Math.abs(value) >= 100_000_000) {
    return `¥${(value / 100_000_000).toLocaleString("ja-JP", { maximumFractionDigits: 1 })}億`;
  }
  if (Math.abs(value) >= 10_000) {
    return `¥${Math.round(value / 10_000).toLocaleString("ja-JP")}万`;
  }
  return formatYen(value);
}

function formatMonth(month: string): string {
  const [y, m] = month.split("-");
  return `${y}/${Number(m)}月`;
}

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

interface KpiTileProps {
  label: string;
  value: string;
  sub?: React.ReactNode;
  icon: React.ReactNode;
  testId: string;
}

function KpiTile({ label, value, sub, icon, testId }: KpiTileProps) {
  return (
    <div
      className="rounded-xl border border-black/5 bg-white p-4 shadow-[0_4px_14px_rgba(0,0,0,0.06)]"
      data-testid={testId}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#bc0017]/10 text-[#bc0017]">
          {icon}
        </span>
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-[#050505] tabular-nums">
        {value}
      </p>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct == null) return <span>前月データなし</span>;
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 font-semibold",
        up ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800",
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      前月比 {up ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

interface BreakdownCardProps {
  title: string;
  rows: BreakdownRow[];
  testId: string;
}

function BreakdownCard({ title, rows, testId }: BreakdownCardProps) {
  const max = rows[0]?.amount ?? 0;
  return (
    <div
      className="rounded-xl border border-black/5 bg-white p-4 shadow-[0_4px_14px_rgba(0,0,0,0.06)]"
      data-testid={testId}
    >
      <h4 className="text-sm font-semibold text-[#050505]">{title}</h4>
      <ul className="mt-3 space-y-2.5">
        {rows.map((r) => (
          <li
            key={r.label}
            className="group"
            title={`${r.label}: ${formatYen(r.amount)}（${r.share.toFixed(1)}%・数量 ${r.quantity.toLocaleString("ja-JP")}）`}
          >
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0 truncate font-medium text-[#050505]">
                {r.label}
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {formatYenCompact(r.amount)}
                <span className="ml-1.5 text-[11px]">{r.share.toFixed(1)}%</span>
              </span>
            </div>
            <div className="mt-1 h-2 w-full rounded-full bg-black/[0.05]">
              <div
                className="h-2 rounded-full bg-[#bc0017] transition-[width,opacity] duration-500 group-hover:opacity-80"
                style={{ width: `${max > 0 ? Math.max((r.amount / max) * 100, 2) : 0}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface TrendTooltipProps {
  active?: boolean;
  payload?: { payload: { month: string; totalAmount: number; rowCount: number } }[];
}

function TrendTooltip({ active, payload }: TrendTooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-[#050505]">{formatMonth(point.month)}</p>
      <p className="mt-0.5 tabular-nums text-[#050505]">{formatYen(point.totalAmount)}</p>
      <p className="tabular-nums text-muted-foreground">{point.rowCount} 件</p>
    </div>
  );
}

interface SalesDashboardProps {
  dataset: AnalysisDataset;
  /** 取り込み直後など、更新を強調表示したいとき true */
  justUpdated?: boolean;
}

export function SalesDashboard({ dataset, justUpdated = false }: SalesDashboardProps) {
  const dashboard = useMemo(
    () => buildSalesDashboard(dataset.rows.map((r) => r.values)),
    [dataset],
  );
  const { kpis } = dashboard;

  return (
    <div className="space-y-4" data-testid="sales-dashboard">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[#050505]" data-testid="dashboard-dataset-name">
            {dataset.name}
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarRange className="h-3.5 w-3.5" aria-hidden />
            {kpis.periodStart && kpis.periodEnd
              ? `${kpis.periodStart} 〜 ${kpis.periodEnd}`
              : "期間不明"}
          </p>
        </div>
        <p
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
            justUpdated
              ? "bg-emerald-50 text-emerald-800"
              : "bg-black/[0.04] text-muted-foreground",
          )}
          data-testid="dashboard-updated-at"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", justUpdated && "animate-spin [animation-iteration-count:1]")} aria-hidden />
          {justUpdated ? "取込データで更新しました · " : "取込日時 · "}
          {formatDateTime(dataset.createdAt)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          testId="kpi-total-amount"
          label="売上合計"
          value={formatYenCompact(kpis.totalAmount)}
          sub={formatYen(kpis.totalAmount)}
          icon={<JapaneseYen className="h-4 w-4" aria-hidden />}
        />
        <KpiTile
          testId="kpi-row-count"
          label="明細件数"
          value={`${kpis.rowCount.toLocaleString("ja-JP")} 件`}
          sub={`1件あたり ${formatYenCompact(kpis.avgAmountPerRow)}`}
          icon={<ReceiptText className="h-4 w-4" aria-hidden />}
        />
        <KpiTile
          testId="kpi-quantity"
          label="販売数量"
          value={kpis.totalQuantity.toLocaleString("ja-JP")}
          sub={`平均単価 ${formatYen(kpis.avgUnitPrice)}`}
          icon={<Package className="h-4 w-4" aria-hidden />}
        />
        <KpiTile
          testId="kpi-latest-month"
          label={kpis.latestMonth ? `最新月（${formatMonth(kpis.latestMonth)}）` : "最新月"}
          value={formatYenCompact(dashboard.monthly.at(-1)?.totalAmount ?? 0)}
          sub={<ChangeBadge pct={kpis.latestMonthChangePct} />}
          icon={
            (kpis.latestMonthChangePct ?? 0) >= 0 ? (
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            ) : (
              <ArrowDownRight className="h-4 w-4" aria-hidden />
            )
          }
        />
      </div>

      {dashboard.monthly.length > 0 && (
        <div
          className="rounded-xl border border-black/5 bg-white p-4 shadow-[0_4px_14px_rgba(0,0,0,0.06)]"
          data-testid="dashboard-trend"
        >
          <h4 className="text-sm font-semibold text-[#050505]">月別売上推移</h4>
          <div className="mt-3 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashboard.monthly} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRAND} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={BRAND} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.06)" />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonth}
                  tick={{ fontSize: 11, fill: "#6b6b6b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatYenCompact}
                  tick={{ fontSize: 11, fill: "#6b6b6b" }}
                  axisLine={false}
                  tickLine={false}
                  width={64}
                />
                <Tooltip
                  content={<TrendTooltip />}
                  cursor={{ stroke: "rgba(0,0,0,0.25)", strokeDasharray: "3 3" }}
                />
                <Area
                  type="monotone"
                  dataKey="totalAmount"
                  stroke={BRAND}
                  strokeWidth={2}
                  fill="url(#salesTrendFill)"
                  dot={{ r: 4, fill: BRAND, stroke: "#fff", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: BRAND, stroke: "#fff", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <BreakdownCard title="地域別" rows={dashboard.byRegion} testId="dashboard-by-region" />
        <BreakdownCard title="営業担当者別" rows={dashboard.bySalesRep} testId="dashboard-by-rep" />
        <BreakdownCard title="カテゴリ別" rows={dashboard.byCategory} testId="dashboard-by-category" />
        <BreakdownCard title="売上上位の商品" rows={dashboard.topProducts} testId="dashboard-top-products" />
      </div>
    </div>
  );
}
