"use client";

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LoanRecord, RegionalBreakdown } from "@/lib/types";
import {
  calculatePortfolioStats,
  type AgeHistogramBin,
  type CompositionBucket,
} from "@/lib/metrics";
import { fmtMm, fmtPct } from "@/lib/formatters";

export interface PortfolioBreakdownProps {
  loans: LoanRecord[];
  regional: RegionalBreakdown[];
}

const INTEREST_COLORS: Record<string, string> = {
  固定: "#0B2545",
  変動: "#D4A017",
  固定期間選択: "#1E4A7B",
};

const PROPERTY_COLORS: Record<string, string> = {
  戸建: "#0B2545",
  マンション: "#D4A017",
  土地: "#64748B",
  その他: "#94A3B8",
};

const FALLBACK_PIE_COLORS = ["#0B2545", "#D4A017", "#1E4A7B", "#64748B", "#94A3B8"];

/** 都道府県別延滞率を 0-1 に正規化してプライマリ色（ネイビー）の濃淡に変換。 */
function delinquencyShade(rate: number, maxRate: number): string {
  const t = maxRate > 0 ? Math.min(rate / maxRate, 1) : 0;
  // base = #0B2545 (11,37,69), 濃い側を強め (alpha 0.35 → 1.0)
  const alpha = 0.35 + 0.65 * t;
  return `rgba(11, 37, 69, ${alpha.toFixed(3)})`;
}

function DonutLegend({ buckets }: { buckets: CompositionBucket[] }) {
  return (
    <ul className="mt-2 grid grid-cols-1 gap-1 text-xs text-trust-subtle">
      {buckets.map((b, i) => (
        <li key={b.label} className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                backgroundColor:
                  INTEREST_COLORS[b.label] ??
                  PROPERTY_COLORS[b.label] ??
                  FALLBACK_PIE_COLORS[i % FALLBACK_PIE_COLORS.length],
              }}
              aria-hidden
            />
            <span className="text-trust-ink">{b.label}</span>
          </span>
          <span className="tabular-nums">
            {fmtPct(b.share, 1)}（{b.count}件）
          </span>
        </li>
      ))}
    </ul>
  );
}

function PortfolioCard({
  testId,
  title,
  subtitle,
  children,
}: {
  testId: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <article
      className="flex flex-col rounded-xl bg-white p-5 shadow-[0_2px_12px_rgba(11,37,69,0.06)] ring-1 ring-slate-200"
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

export function PortfolioBreakdown({ loans, regional }: PortfolioBreakdownProps) {
  const stats = calculatePortfolioStats(loans);

  const interestData = stats.interest_type_composition.map((b) => ({
    name: b.label,
    value: b.balance_mm,
    share: b.share,
    count: b.count,
  }));
  const propertyData = stats.property_type_composition.map((b) => ({
    name: b.label,
    value: b.balance_mm,
    share: b.share,
    count: b.count,
  }));

  const prefTop10 = [...regional]
    .sort((a, b) => b.balance_mm - a.balance_mm)
    .slice(0, 10);
  const maxDelinquency = Math.max(
    ...prefTop10.map((r) => r.delinquency_90_plus_rate),
    1e-9,
  );
  const prefData = prefTop10.map((r) => ({
    prefecture: r.prefecture,
    balance_mm: r.balance_mm,
    delinquency: r.delinquency_90_plus_rate,
    loan_count: r.loan_count,
    fill: delinquencyShade(r.delinquency_90_plus_rate, maxDelinquency),
  }));

  const ageData = stats.age_histogram.map((b: AgeHistogramBin) => ({
    label: `${b.label}歳`,
    count: b.count,
    share: b.share,
  }));

  return (
    <section
      className="grid grid-cols-1 gap-4 lg:grid-cols-2"
      data-testid="dashboard-portfolio-grid"
    >
      <PortfolioCard
        testId="dashboard-portfolio-interest-type"
        title="金利タイプ構成"
        subtitle={`加重平均金利 ${fmtPct(stats.weighted_avg_interest_rate, 2)}`}
      >
        <div style={{ width: "100%", height: 200 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={interestData}
                dataKey="value"
                nameKey="name"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={2}
              >
                {interestData.map((d, i) => (
                  <Cell
                    key={d.name}
                    fill={
                      INTEREST_COLORS[d.name] ??
                      FALLBACK_PIE_COLORS[i % FALLBACK_PIE_COLORS.length]
                    }
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number, _n, item) => {
                  const d = item?.payload as { share: number } | undefined;
                  return [`${fmtMm(v)}（${fmtPct(d?.share ?? 0, 1)}）`, "残高"];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <DonutLegend buckets={stats.interest_type_composition} />
      </PortfolioCard>

      <PortfolioCard
        testId="dashboard-portfolio-property-type"
        title="物件種別構成"
        subtitle={`加重平均LTV ${fmtPct(stats.weighted_avg_ltv_current, 1)}`}
      >
        <div style={{ width: "100%", height: 200 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={propertyData}
                dataKey="value"
                nameKey="name"
                innerRadius={45}
                outerRadius={75}
                paddingAngle={2}
              >
                {propertyData.map((d, i) => (
                  <Cell
                    key={d.name}
                    fill={
                      PROPERTY_COLORS[d.name] ??
                      FALLBACK_PIE_COLORS[i % FALLBACK_PIE_COLORS.length]
                    }
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number, _n, item) => {
                  const d = item?.payload as { share: number } | undefined;
                  return [`${fmtMm(v)}（${fmtPct(d?.share ?? 0, 1)}）`, "残高"];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <DonutLegend buckets={stats.property_type_composition} />
      </PortfolioCard>

      <PortfolioCard
        testId="dashboard-portfolio-prefecture"
        title="都道府県別残高 Top10"
        subtitle="色の濃さは 90日以上延滞率の相対値"
      >
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <BarChart
              data={prefData}
              layout="vertical"
              margin={{ top: 4, right: 40, bottom: 4, left: 16 }}
            >
              <XAxis
                type="number"
                fontSize={10}
                tick={{ fill: "#6B7280" }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <YAxis
                type="category"
                dataKey="prefecture"
                width={48}
                fontSize={11}
                tick={{ fill: "#0B2545" }}
                interval={0}
              />
              <Tooltip
                formatter={(value: number, _n, item) => {
                  const p = item?.payload as {
                    delinquency: number;
                    loan_count: number;
                  } | undefined;
                  return [
                    `${fmtMm(value)} / 延滞率 ${fmtPct(p?.delinquency ?? 0, 2)}（${p?.loan_count ?? 0}件）`,
                    "残高",
                  ];
                }}
              />
              <Bar dataKey="balance_mm" name="残高">
                {prefData.map((d) => (
                  <Cell
                    key={d.prefecture}
                    fill={d.fill}
                    data-testid={`dashboard-portfolio-prefecture-bar-${d.prefecture}`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </PortfolioCard>

      <PortfolioCard
        testId="dashboard-portfolio-age"
        title="債務者年齢分布"
        subtitle="5歳刻みヒストグラム"
      >
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <BarChart
              data={ageData}
              margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
            >
              <XAxis
                dataKey="label"
                fontSize={10}
                tick={{ fill: "#6B7280" }}
                interval={0}
              />
              <YAxis fontSize={10} tick={{ fill: "#6B7280" }} />
              <Tooltip
                formatter={(value: number, _n, item) => {
                  const d = item?.payload as { share: number } | undefined;
                  return [`${value}件（${fmtPct(d?.share ?? 0, 1)}）`, "債務者数"];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="count" name="債務者数" fill="#0B2545" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </PortfolioCard>
    </section>
  );
}
