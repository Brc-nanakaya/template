"use client";

import { useEffect, useState } from "react";
import { loadAllSampleData } from "@/lib/loaders";
import { calculateMonthlyMetrics, type MonthlyMetrics } from "@/lib/metrics";
import type { TrustDataset } from "@/lib/types";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { SummaryKpiCards } from "@/components/dashboard/SummaryKpiCards";

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; dataset: TrustDataset; metrics: MonthlyMetrics }
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
        if (!cancelled) setState({ kind: "ready", dataset, metrics });
      } catch (e) {
        if (!cancelled) {
          setState({
            kind: "error",
            message: e instanceof Error ? e.message : String(e),
          });
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

  const { dataset, metrics } = state;

  return (
    <main className="min-h-screen bg-trust-bg p-4 sm:p-6" data-testid="dashboard-main">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <DashboardHeader deal={dataset.deal} />
        <SummaryKpiCards
          deal={dataset.deal}
          monthly={dataset.monthly}
          metrics={metrics}
        />
      </div>
    </main>
  );
}
