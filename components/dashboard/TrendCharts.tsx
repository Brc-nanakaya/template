"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DealInfo, MonthlyPerformance } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtMm, fmtMonth, fmtPct } from "@/lib/formatters";

export interface TrendChartsProps {
  deal: DealInfo;
  monthly: MonthlyPerformance[];
}

const CHART_HEIGHT = 320;

const TABS = [
  { id: "balance", label: "残高推移" },
  { id: "delinquency", label: "延滞推移" },
  { id: "cpr-cdr", label: "CPR/CDR" },
  { id: "beneficiary", label: "受益権残高" },
  { id: "cumulative-default", label: "累積デフォルト率" },
] as const;

function ChartFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full" style={{ height: CHART_HEIGHT }}>
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

export function TrendCharts({ deal, monthly }: TrendChartsProps) {
  const data = monthly.map((m) => ({
    month: m.month,
    monthLabel: fmtMonth(m.month),
    pool_balance_mm: m.pool_balance_mm,
    del30: m.delinquency_30_59_rate,
    del60: m.delinquency_60_89_rate,
    del90: m.delinquency_90_plus_rate,
    cpr: m.cpr_annual,
    cdr: m.cdr_annual,
    senior: m.senior_balance_mm,
    subordinated: m.subordinated_balance_mm,
    cumulative_default_rate: m.cumulative_default_rate,
  }));

  return (
    <section
      className="rounded-xl bg-white p-5 shadow-[0_2px_12px_rgba(11,37,69,0.06)] ring-1 ring-slate-200"
      data-testid="dashboard-trend-charts"
    >
      <h2 className="mb-3 text-sm font-semibold text-trust-primary">時系列推移（直近24ヶ月）</h2>
      <Tabs defaultValue={TABS[0].id}>
        <TabsList data-testid="dashboard-chart-tabs">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              data-testid={`dashboard-tab-${t.id}`}
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* 1. 残高推移（折れ線） */}
        <TabsContent value="balance" data-testid="dashboard-chart-panel-balance">
          <ChartFrame>
            <ComposedChart data={data} margin={{ top: 12, right: 24, bottom: 4, left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" fontSize={10} tick={{ fill: "#6B7280" }} />
              <YAxis
                fontSize={10}
                tick={{ fill: "#6B7280" }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                label={{
                  value: "百万円",
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 10, fill: "#6B7280" },
                }}
              />
              <Tooltip
                formatter={(value: number) => fmtMm(value)}
                labelFormatter={(label) => fmtMonth(String(label))}
              />
              <Line
                type="monotone"
                dataKey="pool_balance_mm"
                name="プール残高"
                stroke="#0B2545"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ChartFrame>
        </TabsContent>

        {/* 2. 延滞推移（積み上げ棒） */}
        <TabsContent value="delinquency" data-testid="dashboard-chart-panel-delinquency">
          <ChartFrame>
            <ComposedChart data={data} margin={{ top: 12, right: 24, bottom: 4, left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" fontSize={10} tick={{ fill: "#6B7280" }} />
              <YAxis
                fontSize={10}
                tick={{ fill: "#6B7280" }}
                tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
              />
              <Tooltip
                formatter={(value: number) => fmtPct(value, 2)}
                labelFormatter={(label) => fmtMonth(String(label))}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="del30" name="30-59日" stackId="d" fill="#FDE68A" />
              <Bar dataKey="del60" name="60-89日" stackId="d" fill="#F59E0B" />
              <Bar dataKey="del90" name="90日以上" stackId="d" fill="#B91C1C" />
            </ComposedChart>
          </ChartFrame>
        </TabsContent>

        {/* 3. CPR/CDR（2軸折れ線） */}
        <TabsContent value="cpr-cdr" data-testid="dashboard-chart-panel-cpr-cdr">
          <ChartFrame>
            <ComposedChart data={data} margin={{ top: 12, right: 24, bottom: 4, left: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" fontSize={10} tick={{ fill: "#6B7280" }} />
              <YAxis
                yAxisId="cpr"
                fontSize={10}
                tick={{ fill: "#0B2545" }}
                tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                label={{
                  value: "CPR",
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 10, fill: "#0B2545" },
                }}
              />
              <YAxis
                yAxisId="cdr"
                orientation="right"
                fontSize={10}
                tick={{ fill: "#B91C1C" }}
                tickFormatter={(v) => `${(v * 100).toFixed(2)}%`}
                label={{
                  value: "CDR",
                  angle: 90,
                  position: "insideRight",
                  style: { fontSize: 10, fill: "#B91C1C" },
                }}
              />
              <Tooltip
                formatter={(value: number, name) =>
                  [fmtPct(value, 2), String(name)] as [string, string]
                }
                labelFormatter={(label) => fmtMonth(String(label))}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                yAxisId="cpr"
                type="monotone"
                dataKey="cpr"
                name="CPR（年率）"
                stroke="#0B2545"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="cdr"
                type="monotone"
                dataKey="cdr"
                name="CDR（年率）"
                stroke="#B91C1C"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ChartFrame>
        </TabsContent>

        {/* 4. 受益権残高（優先・劣後 積み上げエリア） */}
        <TabsContent value="beneficiary" data-testid="dashboard-chart-panel-beneficiary">
          <ChartFrame>
            <ComposedChart data={data} margin={{ top: 12, right: 24, bottom: 4, left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" fontSize={10} tick={{ fill: "#6B7280" }} />
              <YAxis
                fontSize={10}
                tick={{ fill: "#6B7280" }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value: number) => fmtMm(value)}
                labelFormatter={(label) => fmtMonth(String(label))}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="senior"
                name="優先受益権"
                stackId="b"
                stroke="#0B2545"
                fill="#0B2545"
                fillOpacity={0.75}
              />
              <Area
                type="monotone"
                dataKey="subordinated"
                name="劣後受益権"
                stackId="b"
                stroke="#D4A017"
                fill="#D4A017"
                fillOpacity={0.85}
              />
            </ComposedChart>
          </ChartFrame>
        </TabsContent>

        {/* 5. 累積デフォルト率 + トリガー閾値 */}
        <TabsContent
          value="cumulative-default"
          data-testid="dashboard-chart-panel-cumulative-default"
        >
          <ChartFrame>
            <ComposedChart data={data} margin={{ top: 12, right: 24, bottom: 4, left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" fontSize={10} tick={{ fill: "#6B7280" }} />
              <YAxis
                fontSize={10}
                tick={{ fill: "#6B7280" }}
                tickFormatter={(v) => `${(v * 100).toFixed(2)}%`}
                domain={[0, (dataMax: number) =>
                  Math.max(dataMax, deal.trigger_thresholds.cumulative_default_rate) * 1.05,
                ]}
              />
              <Tooltip
                formatter={(value: number) => fmtPct(value, 3)}
                labelFormatter={(label) => fmtMonth(String(label))}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine
                y={deal.trigger_thresholds.cumulative_default_rate}
                stroke="#B91C1C"
                strokeDasharray="5 4"
                label={{
                  value: `トリガー閾値 ${fmtPct(deal.trigger_thresholds.cumulative_default_rate, 2)}`,
                  position: "insideTopRight",
                  fill: "#B91C1C",
                  fontSize: 10,
                }}
              />
              <Line
                type="monotone"
                dataKey="cumulative_default_rate"
                name="累積デフォルト率"
                stroke="#0B2545"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ChartFrame>
        </TabsContent>
      </Tabs>
    </section>
  );
}
