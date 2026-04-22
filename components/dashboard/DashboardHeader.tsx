"use client";

import { useRouter } from "next/navigation";
import type { DealInfo } from "@/lib/types";
import { fmtMonth } from "@/lib/formatters";
import { toastSuccess } from "@/lib/toast";

export interface DashboardHeaderProps {
  deal: DealInfo;
}

export function DashboardHeader({ deal }: DashboardHeaderProps) {
  const router = useRouter();

  const handleReset = () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("trust-data-source");
      sessionStorage.removeItem("trust:commentary");
    }
    toastSuccess("デモをリセットしました", "トップページへ戻ります。");
    router.push("/");
  };

  const handleExport = () => {
    // T15/T16 で本実装。暫定でレポート画面 (未作成) に遷移せず、現状は window.print を起動。
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <header
      className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-[0_2px_12px_rgba(11,37,69,0.06)] ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between"
      data-testid="dashboard-header"
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-trust-accent">
          期中管理レポート
        </p>
        <h1
          className="mt-1 text-lg font-bold leading-snug text-trust-primary sm:text-xl"
          data-testid="dashboard-header-deal-name"
        >
          {deal.deal_name}
        </h1>
        <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-trust-subtle sm:grid-cols-3">
          <div className="flex gap-1">
            <dt>契約番号</dt>
            <dd
              className="font-medium text-trust-ink"
              data-testid="dashboard-header-contract"
            >
              {deal.contract_number}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt>報告基準月</dt>
            <dd
              className="font-medium text-trust-ink"
              data-testid="dashboard-header-report-month"
            >
              {fmtMonth(deal.report_month)}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt>受託者</dt>
            <dd className="font-medium text-trust-ink">{deal.trustee}</dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex h-9 items-center justify-center rounded-lg bg-trust-primary px-4 text-xs font-semibold text-white transition hover:bg-[#13315c] focus:outline-none focus-visible:ring-2 focus-visible:ring-trust-accent focus-visible:ring-offset-2"
          data-testid="dashboard-btn-export"
        >
          レポート出力
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-trust-subtle transition hover:border-trust-primary hover:text-trust-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-trust-accent focus-visible:ring-offset-2"
          data-testid="dashboard-btn-reset"
        >
          デモをリセット
        </button>
      </div>
    </header>
  );
}
