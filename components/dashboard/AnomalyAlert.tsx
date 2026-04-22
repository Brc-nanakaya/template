"use client";

import { useCallback } from "react";
import type { Anomaly, AnomalySeverity } from "@/lib/types";

export interface AnomalyAlertProps {
  anomalies: Anomaly[];
  /** 表示件数上限（既定 3）。 */
  limit?: number;
}

const severityStyle: Record<
  AnomalySeverity,
  { container: string; badge: string; label: string; dot: string }
> = {
  high: {
    container: "border-l-4 border-trust-danger bg-red-50",
    badge: "bg-trust-danger text-white",
    label: "重要",
    dot: "bg-trust-danger",
  },
  medium: {
    container: "border-l-4 border-trust-warn bg-amber-50",
    badge: "bg-trust-warn text-white",
    label: "注意",
    dot: "bg-trust-warn",
  },
  low: {
    container: "border-l-4 border-slate-400 bg-slate-50",
    badge: "bg-slate-400 text-white",
    label: "参考",
    dot: "bg-slate-400",
  },
};

function scrollToAnchor(anchor: string | undefined) {
  if (!anchor) return;
  const el = document.getElementById(anchor);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.setAttribute("data-scroll-target", "true");
  window.setTimeout(() => el.removeAttribute("data-scroll-target"), 1200);
}

export function AnomalyAlert({ anomalies, limit = 3 }: AnomalyAlertProps) {
  const displayed = anomalies.slice(0, limit);
  const handleClick = useCallback((anchor: string | undefined) => {
    scrollToAnchor(anchor);
  }, []);

  if (displayed.length === 0) {
    return (
      <section
        className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-trust-subtle"
        data-testid="dashboard-anomaly-banner"
        data-count="0"
      >
        当月、検知された異常値はありません。引き続きトレンドを監視してください。
      </section>
    );
  }

  return (
    <section
      className="flex flex-col gap-3"
      data-testid="dashboard-anomaly-banner"
      data-count={displayed.length}
    >
      <header className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-trust-primary">
          当月の注目事項 ({anomalies.length}件中 {displayed.length}件を表示)
        </h2>
        <p className="text-xs text-trust-subtle">
          クリックで該当セクションへ移動します
        </p>
      </header>
      {displayed.map((a, index) => {
        const s = severityStyle[a.severity];
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => handleClick(a.sectionAnchor)}
            className={`group flex w-full flex-col gap-1 rounded-lg px-4 py-3 text-left transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-trust-accent ${s.container}`}
            data-testid={`dashboard-anomaly-item-${index}`}
            data-severity={a.severity}
            data-anchor={a.sectionAnchor ?? ""}
          >
            <div className="flex items-center gap-2">
              <span className={`inline-block h-2 w-2 rounded-full ${s.dot}`} aria-hidden />
              <span
                className={`inline-flex items-center rounded px-2 py-[1px] text-[10px] font-semibold ${s.badge}`}
              >
                {s.label}
              </span>
              <span className="text-sm font-semibold text-trust-primary">{a.title}</span>
            </div>
            <p className="text-xs leading-relaxed text-trust-ink">{a.description}</p>
          </button>
        );
      })}
    </section>
  );
}
