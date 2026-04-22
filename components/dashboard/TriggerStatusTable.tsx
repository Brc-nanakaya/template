"use client";

/**
 * トリガー状況テーブル (T12)。
 * 4 つのトリガー（累積デフォルト率 / 90日以上延滞率 / CPR（年率） / 劣後比率下限）について、
 * 閾値に対する進捗バー、状態バッジ、`predictTriggerBreach` による抵触予測月を表示。
 */

import type { DealInfo, TriggerTest } from "@/lib/types";
import { predictTriggerBreach } from "@/lib/metrics";
import { fmtMonth, fmtPct } from "@/lib/formatters";

export interface TriggerStatusTableProps {
  triggers: TriggerTest[];
  reportMonth: string;
  deal: DealInfo;
}

type Status = "抵触" | "警戒" | "未抵触";

const STATUS_STYLE: Record<
  Status,
  { badge: string; bar: string; dot: string }
> = {
  抵触: {
    badge: "bg-red-600 text-white",
    bar: "bg-red-500",
    dot: "bg-red-500",
  },
  警戒: {
    badge: "bg-amber-500 text-white",
    bar: "bg-amber-500",
    dot: "bg-amber-500",
  },
  未抵触: {
    badge: "bg-emerald-600 text-white",
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
  },
};

function classifyStatus(
  currentValue: number,
  threshold: number,
  direction: TriggerTest["direction"],
  breach: boolean,
): Status {
  if (breach) return "抵触";
  // 警戒: `above_breach` は閾値の 70% 以上、`below_breach` は閾値の 110% 以下
  if (direction === "above_breach") {
    if (threshold > 0 && currentValue / threshold >= 0.7) return "警戒";
  } else {
    if (threshold > 0 && currentValue <= threshold * 1.1) return "警戒";
  }
  return "未抵触";
}

function progressPercent(
  currentValue: number,
  threshold: number,
  direction: TriggerTest["direction"],
): number {
  if (threshold <= 0) return 0;
  if (direction === "above_breach") {
    // current/threshold = 1.0 で抵触
    return Math.min(100, Math.max(0, (currentValue / threshold) * 100));
  }
  // below_breach: current/threshold = 1.0 で safety 最大、下回ると抵触
  // 0% = 抵触（current=0）, 100% = current ≥ threshold × 1.5（十分な余裕）
  const ratio = currentValue / (threshold * 1.5);
  return Math.min(100, Math.max(0, ratio * 100));
}

function triggerRowTestId(name: string): string {
  const map: Record<string, string> = {
    累積デフォルト率: "cumulative-default",
    "90日以上延滞率": "delinquency-90",
    "CPR（年率）": "cpr",
    劣後比率下限: "subordination",
  };
  return map[name] ?? name.replace(/[^\w-]/g, "-");
}

export function TriggerStatusTable({
  triggers,
  reportMonth,
  deal,
}: TriggerStatusTableProps) {
  const current = triggers
    .filter((t) => t.month === reportMonth)
    .sort((a, b) => a.trigger_name.localeCompare(b.trigger_name, "ja"));

  return (
    <section
      data-testid="dashboard-trigger-table"
      aria-label="トリガー状況"
      className="rounded-xl bg-white p-5 shadow-[0_2px_12px_rgba(11,37,69,0.06)] ring-1 ring-slate-200"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold text-[#0B2545]">
          トリガー状況（{fmtMonth(reportMonth)}）
        </h2>
        <span className="text-xs text-slate-500">閾値と現状値・抵触予測</span>
      </div>

      <div className="mt-4 space-y-3">
        {current.map((t) => {
          const status = classifyStatus(
            t.current_value,
            t.threshold,
            t.direction,
            t.breach,
          );
          const style = STATUS_STYLE[status];
          const percent = progressPercent(
            t.current_value,
            t.threshold,
            t.direction,
          );
          const prediction = safePrediction(triggers, t.trigger_name);
          const testIdSuffix = triggerRowTestId(t.trigger_name);
          return (
            <div
              key={t.trigger_name}
              data-testid={`dashboard-trigger-row-${testIdSuffix}`}
              data-status={status}
              className="rounded-lg border border-slate-200 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden />
                <span className="text-sm font-semibold text-slate-900">
                  {t.trigger_name}
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-xs font-bold ${style.badge}`}
                  data-testid={`dashboard-trigger-badge-${testIdSuffix}`}
                >
                  {status}
                </span>
                <span className="ml-auto text-xs text-slate-500">
                  {t.direction === "above_breach" ? "上限" : "下限"} 閾値 {fmtPct(t.threshold, 2)}
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full ${style.bar}`}
                  style={{ width: `${percent.toFixed(1)}%` }}
                  role="progressbar"
                  aria-valuenow={Math.round(percent)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3 text-xs text-slate-600">
                <span>
                  当月値 <strong className="font-mono">{fmtPct(t.current_value, 2)}</strong>
                </span>
                <span>
                  {t.direction === "above_breach" ? "閾値到達まで" : "閾値割れまで"}
                  {prediction && prediction.months_until_breach !== null ? (
                    <>
                      <strong className="ml-1 font-mono text-slate-900">
                        {prediction.months_until_breach} ヶ月
                      </strong>
                      （予測 {prediction.breach_month ? fmtMonth(prediction.breach_month) : "-"}）
                    </>
                  ) : (
                    <span className="ml-1 text-slate-400">到達予測なし</span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
        {current.length === 0 && (
          <p className="text-sm text-slate-500">当月分のトリガー状況データがありません。</p>
        )}
      </div>

      <p className="mt-3 text-[11px] text-slate-400">
        閾値定義: 累積デフォルト率 {fmtPct(deal.trigger_thresholds.cumulative_default_rate)}、
        90日以上延滞率 {fmtPct(deal.trigger_thresholds.delinquency_90_rate)}、
        CPR（年率） {fmtPct(deal.trigger_thresholds.cpr_annual)}、
        劣後比率下限 {fmtPct(deal.trigger_thresholds.subordination_ratio_min)}
      </p>
    </section>
  );
}

function safePrediction(triggers: TriggerTest[], name: string) {
  try {
    return predictTriggerBreach(triggers, name);
  } catch {
    return null;
  }
}
