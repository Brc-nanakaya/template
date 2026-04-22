"use client";

import { useEffect, useState } from "react";
import { loadAllSampleData } from "@/lib/loaders";
import { calculateMonthlyMetrics, type MonthlyMetrics } from "@/lib/metrics";
import { detectAnomalies } from "@/lib/anomaly";
import type { Anomaly, TrustDataset } from "@/lib/types";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { SummaryKpiCards } from "@/components/dashboard/SummaryKpiCards";
import { AnomalyAlert } from "@/components/dashboard/AnomalyAlert";
import { TrendCharts } from "@/components/dashboard/TrendCharts";
import { PortfolioBreakdown } from "@/components/dashboard/PortfolioBreakdown";
import { PrepaymentDefaultAnalysis } from "@/components/dashboard/PrepaymentDefaultAnalysis";
import { WaterfallTable } from "@/components/dashboard/WaterfallTable";
import { TriggerStatusTable } from "@/components/dashboard/TriggerStatusTable";
import { LoanTapeTable } from "@/components/dashboard/LoanTapeTable";
import { CommentaryEditor } from "@/components/dashboard/CommentaryEditor";
import { toastError } from "@/lib/toast";

type LoadState =
  | { kind: "loading" }
  | {
      kind: "ready";
      dataset: TrustDataset;
      metrics: MonthlyMetrics;
      anomalies: Anomaly[];
    }
  | { kind: "error"; message: string };

export default function DashboardPage() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dataset = await loadAllSampleData();
        const metrics = calculateMonthlyMetrics(dataset.monthly, {
          initialPoolMm: dataset.deal.initial_pool_balance_mm,
        });
        const anomalies = detectAnomalies({
          monthly: dataset.monthly,
          defaults: dataset.defaults,
          triggers: dataset.triggers,
          deal: dataset.deal,
          waterfall: dataset.waterfall,
          previousServicerRating: "AA-",
        });
        if (!cancelled) setState({ kind: "ready", dataset, metrics, anomalies });
      } catch (e) {
        if (!cancelled) {
          const message = e instanceof Error ? e.message : String(e);
          setState({ kind: "error", message });
          toastError("データ読み込みに失敗しました", message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === "loading") {
    return (
      <main className="min-h-screen bg-trust-bg p-6" data-testid="dashboard-main">
        <div
          className="mx-auto max-w-6xl animate-pulse space-y-4"
          data-testid="dashboard-skeleton"
        >
          <div className="h-24 rounded-xl bg-white" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-36 rounded-xl bg-white" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (state.kind === "error") {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-trust-bg p-6"
        data-testid="dashboard-main"
      >
        <div
          className="max-w-md rounded-xl bg-white p-6 text-center shadow-md ring-1 ring-slate-200"
          data-testid="dashboard-error"
        >
          <h1 className="text-lg font-bold text-trust-danger">データ読み込みエラー</h1>
          <p className="mt-2 text-sm text-trust-subtle">{state.message}</p>
        </div>
      </main>
    );
  }

  const { dataset, metrics, anomalies } = state;

  return (
    <main className="min-h-screen bg-trust-bg p-4 sm:p-6" data-testid="dashboard-main">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <DashboardHeader deal={dataset.deal} />
        <AnomalyAlert anomalies={anomalies} />
        <SummaryKpiCards
          deal={dataset.deal}
          monthly={dataset.monthly}
          metrics={metrics}
        />
        <div id="delinquency-section" className="scroll-mt-8">
          <TrendCharts deal={dataset.deal} monthly={dataset.monthly} />
        </div>
        <section aria-label="ポートフォリオ構成" className="scroll-mt-8">
          <PortfolioBreakdown loans={dataset.loans} regional={dataset.regional} />
        </section>
        <div id="prepayment-section" className="scroll-mt-8">
          <div id="default-section">
            <PrepaymentDefaultAnalysis
              prepayments={dataset.prepayments}
              defaults={dataset.defaults}
              reportMonth={dataset.deal.report_month}
            />
          </div>
        </div>
        <div id="waterfall-section" className="scroll-mt-8">
          <WaterfallTable
            waterfall={dataset.waterfall}
            reportMonth={dataset.deal.report_month}
          />
        </div>
        <div id="trigger-section" className="scroll-mt-8">
          <TriggerStatusTable
            triggers={dataset.triggers}
            reportMonth={dataset.deal.report_month}
            deal={dataset.deal}
          />
        </div>
        <div id="servicer-section" className="scroll-mt-8">
          <LoanTapeTable loans={dataset.loans} />
        </div>
        <CommentaryEditor
          dealInfo={dataset.deal}
          currentMonth={dataset.monthly[dataset.monthly.length - 1]}
          monthlyHistory={dataset.monthly}
          anomalies={anomalies}
          triggerStatus={dataset.triggers}
        />
      </div>
    </main>
  );
}
