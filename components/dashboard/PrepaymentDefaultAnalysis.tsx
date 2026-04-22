"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DefaultRecord, PrepaymentRecord } from "@/lib/types";
import {
  aggregateDefaultsByCause,
  aggregateDefaultsByDisposalStatus,
  aggregatePrepaymentsByReason,
} from "@/lib/metrics";
import { fmtMm, fmtMonth, fmtPct } from "@/lib/formatters";

export interface PrepaymentDefaultAnalysisProps {
  prepayments: PrepaymentRecord[];
  defaults: DefaultRecord[];
  /** 報告基準月 (YYYY-MM)。直近12ヶ月の区切りに使う。 */
  reportMonth: string;
}

const REASON_COLORS: Record<string, string> = {
  借換: "#0B2545",
  売却: "#D4A017",
  自己資金: "#1E4A7B",
  相続: "#64748B",
  その他: "#94A3B8",
};

const CAUSE_COLORS: Record<string, string> = {
  "リストラ等収入減": "#B91C1C",
  "病気・事故": "#D97706",
  "離婚": "#7C3AED",
  "事業不振": "#0891B2",
  "死亡": "#64748B",
  "その他": "#94A3B8",
};

const DISPOSAL_COLORS: Record<string, string> = {
  任意売却完了: "#0B2545",
  競売完了: "#1E4A7B",
  競売申立済: "#D4A017",
  担保処分中: "#D97706",
  交渉中: "#64748B",
};

const FALLBACK = ["#0B2545", "#D4A017", "#1E4A7B", "#64748B", "#94A3B8", "#475569"];

/** 報告基準月から 12ヶ月前までの YYYY-MM リストを昇順で返す。 */
function trailingMonths(reportMonth: string, n: number): string[] {
  const [y, m] = reportMonth.split("-").map(Number);
  const months: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

function Card({
  testId,
  title,
  subtitle,
  children,
  wide,
}: {
  testId: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <article
      className={`flex flex-col rounded-xl bg-white p-5 shadow-[0_2px_12px_rgba(11,37,69,0.06)] ring-1 ring-slate-200 ${
        wide ? "lg:col-span-2" : ""
      }`}
      data-testid={testId}
    >
      <header className="mb-3">
        <h3 className="text-sm font-semibold text-trust-primary">{title}</h3>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-trust-subtle">{subtitle}</p>
        ) : null}
      </header>
      <div className="flex-1">{children}</div>
    </article>
  );
}

export function PrepaymentDefaultAnalysis({
  prepayments,
  defaults,
  reportMonth,
}: PrepaymentDefaultAnalysisProps) {
  const trailing12 = trailingMonths(reportMonth, 12);
  const trailing12Set = new Set(trailing12);

  const recentPrepayments = prepayments.filter((p) => {
    const ym = p.prepayment_date.slice(0, 7);
    return trailing12Set.has(ym);
  });

  const reasonBuckets = aggregatePrepaymentsByReason(recentPrepayments);
  const reasonData = reasonBuckets.map((b) => ({
    name: b.label,
    value: b.amount_mm,
    share: b.share,
    count: b.count,
  }));
  const topReason = reasonBuckets[0]?.label ?? "—";

  // Monthly series: reason別 月次金額（借換/売却/自己資金/相続/その他）
  const reasonOrder = reasonBuckets.map((b) => b.label);
  const monthlySeries = trailing12.map((ym) => {
    const row: Record<string, string | number> = { month: ym };
    for (const r of reasonOrder) row[r] = 0;
    for (const p of recentPrepayments) {
      if (p.prepayment_date.slice(0, 7) === ym) {
        row[p.reason] = (row[p.reason] as number) + p.prepayment_amount_mm;
      }
    }
    return row;
  });

  const causeBuckets = aggregateDefaultsByCause(defaults);
  const causeData = causeBuckets.map((b) => ({
    name: b.label,
    value: b.amount_mm,
    share: b.share,
    count: b.count,
  }));

  const disposalBuckets = aggregateDefaultsByDisposalStatus(defaults);
  const disposalData = disposalBuckets.map((b) => ({
    name: b.label,
    count: b.count,
    recovery_mm: b.recovery_amount_mm,
    loss_mm: b.loss_amount_mm,
    default_mm: b.default_balance_mm,
  }));

  return (
    <section
      className="grid grid-cols-1 gap-4 lg:grid-cols-2"
      data-testid="dashboard-prepayment-default-grid"
    >
      {/* 期限前弁済 理由別構成 (ドーナツ) */}
      <Card
        testId="dashboard-prepayment-breakdown"
        title="期限前弁済 理由別構成（直近12ヶ月）"
        subtitle={`合計 ${recentPrepayments.length} 件 / 最大シェア: ${topReason}`}
      >
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={reasonData}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={2}
              >
                {reasonData.map((d, i) => (
                  <Cell
                    key={d.name}
                    fill={REASON_COLORS[d.name] ?? FALLBACK[i % FALLBACK.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number, _n, item) => {
                  const d = item?.payload as { share: number; count: number } | undefined;
                  return [
                    `${fmtMm(v)}（${fmtPct(d?.share ?? 0, 1)} / ${d?.count ?? 0}件）`,
                    "金額",
                  ];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(val: string) => {
                  const b = reasonBuckets.find((r) => r.label === val);
                  return `${val} ${fmtPct(b?.share ?? 0, 1)}`;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 期限前弁済 月次推移 */}
      <Card
        testId="dashboard-prepayment-monthly-trend"
        title="期限前弁済 月次推移（理由別）"
        subtitle="過去12ヶ月の金額推移"
      >
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <LineChart data={monthlySeries} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="month"
                fontSize={10}
                tick={{ fill: "#6B7280" }}
                tickFormatter={(v) => v.slice(-2) + "月"}
              />
              <YAxis
                fontSize={10}
                tick={{ fill: "#6B7280" }}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip
                formatter={(v: number) => fmtMm(v)}
                labelFormatter={(label) => fmtMonth(String(label))}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {reasonOrder.map((r, i) => (
                <Line
                  key={r}
                  type="monotone"
                  dataKey={r}
                  name={r}
                  stroke={REASON_COLORS[r] ?? FALLBACK[i % FALLBACK.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* デフォルト 事由別内訳 (ドーナツ) */}
      <Card
        testId="dashboard-default-cause"
        title="デフォルト 事由別内訳"
        subtitle={`累計 ${defaults.length} 件`}
      >
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={causeData}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={2}
              >
                {causeData.map((d, i) => (
                  <Cell
                    key={d.name}
                    fill={CAUSE_COLORS[d.name] ?? FALLBACK[i % FALLBACK.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number, _n, item) => {
                  const d = item?.payload as { share: number; count: number } | undefined;
                  return [
                    `${fmtMm(v)}（${fmtPct(d?.share ?? 0, 1)} / ${d?.count ?? 0}件）`,
                    "デフォルト残高",
                  ];
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(val: string) => {
                  const b = causeBuckets.find((r) => r.label === val);
                  return `${val} ${fmtPct(b?.share ?? 0, 1)}`;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* デフォルト 担保処分状況別 回収進捗 */}
      <Card
        testId="dashboard-default-disposal"
        title="デフォルト 回収進捗（担保処分状況別）"
        subtitle="件数 / 回収額 / 損失額"
      >
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <BarChart
              data={disposalData}
              margin={{ top: 8, right: 16, bottom: 4, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis
                dataKey="name"
                fontSize={10}
                tick={{ fill: "#6B7280" }}
                interval={0}
              />
              <YAxis yAxisId="amt" fontSize={10} tick={{ fill: "#6B7280" }} />
              <YAxis
                yAxisId="cnt"
                orientation="right"
                fontSize={10}
                tick={{ fill: "#6B7280" }}
                label={{ value: "件数", angle: 90, position: "insideRight", fontSize: 10, fill: "#6B7280" }}
              />
              <Tooltip
                formatter={(v: number, name) => {
                  if (name === "件数") return [`${v}件`, "件数"];
                  return [fmtMm(v), String(name)];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="amt" dataKey="recovery_mm" name="回収額" stackId="d" fill="#0B2545" />
              <Bar yAxisId="amt" dataKey="loss_mm" name="損失額" stackId="d" fill="#B91C1C" />
              <Bar yAxisId="cnt" dataKey="count" name="件数" fill="#D4A017" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </section>
  );
}
