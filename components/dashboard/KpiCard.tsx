import { Sparkline } from "./Sparkline";

export type KpiTone = "neutral" | "good" | "warn" | "danger";

export interface KpiCardProps {
  /** data-testid のサフィックス。`dashboard-kpi-${testId}` として付与される。 */
  testId: string;
  label: string;
  valueText: string;
  /** 前月比テキスト（例 `+1.2%` / `-0.15pp`）。 */
  deltaText: string;
  deltaTone: KpiTone;
  /** 補助説明（例 `基準月 2026年03月`）。 */
  caption?: string;
  sparkline: number[];
  sparklineDomain?: [number, number];
  sparklineStroke?: string;
}

const toneTextClass: Record<KpiTone, string> = {
  neutral: "text-trust-subtle",
  good: "text-trust-success",
  warn: "text-trust-warn",
  danger: "text-trust-danger",
};

export function KpiCard({
  testId,
  label,
  valueText,
  deltaText,
  deltaTone,
  caption,
  sparkline,
  sparklineDomain,
  sparklineStroke,
}: KpiCardProps) {
  return (
    <article
      className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-[0_2px_12px_rgba(11,37,69,0.06)] ring-1 ring-slate-200"
      data-testid={`dashboard-kpi-${testId}`}
    >
      <header className="flex items-start justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-trust-subtle">
          {label}
        </h3>
        <span
          className={`text-xs font-semibold ${toneTextClass[deltaTone]}`}
          data-testid={`dashboard-kpi-${testId}-delta`}
        >
          {deltaText}
        </span>
      </header>
      <div
        className="text-xl font-bold tabular-nums leading-tight text-trust-primary sm:text-2xl"
        data-testid={`dashboard-kpi-${testId}-value`}
      >
        {valueText}
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-xs text-trust-subtle">{caption}</p>
        <Sparkline
          values={sparkline}
          domain={sparklineDomain}
          stroke={sparklineStroke}
          width={112}
          height={32}
        />
      </div>
    </article>
  );
}
