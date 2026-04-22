"use client";

/**
 * 個別債権ドリルダウン (T13)。
 * 延滞債権とデフォルト債権をアコーディオン構成で提示し、
 * 検索（loan_id / 都道府県）・ソート・行クリックで詳細ページへ遷移する。
 *
 * data-testid:
 *   - `dashboard-loan-accordion`
 *   - `dashboard-loan-panel-{group}` (group = delinquent | default)
 *   - `dashboard-loan-search` (検索入力)
 *   - `dashboard-loan-sort-{col}` (現在残高 / 延滞日数 / 金利)
 *   - `dashboard-loan-row-{loan_id}`
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { LoanRecord, LoanStatus } from "@/lib/types";
import { fmtMm, fmtNumber, fmtPct } from "@/lib/formatters";

export interface LoanTapeTableProps {
  loans: LoanRecord[];
}

const DELINQUENT_STATUSES: LoanStatus[] = [
  "延滞30-59日",
  "延滞60-89日",
  "延滞90日以上",
];
const DEFAULT_STATUSES: LoanStatus[] = ["デフォルト"];

type SortKey = "current_balance" | "delinquency_days" | "interest_rate";
type SortDir = "asc" | "desc";

interface Group {
  key: "delinquent" | "default";
  label: string;
  rows: LoanRecord[];
}

export function LoanTapeTable({ loans }: LoanTapeTableProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    delinquent: true,
    default: false,
  });
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("current_balance");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const groups = useMemo<Group[]>(() => {
    const delinquent = loans.filter((l) =>
      (DELINQUENT_STATUSES as string[]).includes(l.status),
    );
    const defaulted = loans.filter((l) =>
      (DEFAULT_STATUSES as string[]).includes(l.status),
    );
    return [
      { key: "delinquent", label: `延滞債権一覧 (${delinquent.length}件)`, rows: delinquent },
      { key: "default", label: `デフォルト債権一覧 (${defaulted.length}件)`, rows: defaulted },
    ];
  }, [loans]);

  const filterAndSort = (rows: LoanRecord[]): LoanRecord[] => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (l) =>
            l.loan_id.toLowerCase().includes(q) ||
            l.prefecture.toLowerCase().includes(q),
        )
      : rows;
    const mult = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = a[fieldOf(sortKey)] as number;
      const vb = b[fieldOf(sortKey)] as number;
      return (va - vb) * mult;
    });
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const handleRowClick = (loanId: string) => {
    router.push(`/dashboard/loan-detail/${loanId}`);
  };

  return (
    <section
      data-testid="dashboard-loan-accordion"
      aria-label="個別債権ドリルダウン"
      className="rounded-xl bg-white p-5 shadow-[0_2px_12px_rgba(11,37,69,0.06)] ring-1 ring-slate-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#0B2545]">個別債権ドリルダウン</h2>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="loan_id / 都道府県 で検索"
          data-testid="dashboard-loan-search"
          className="w-64 max-w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-[#0B2545] focus:outline-none focus:ring-1 focus:ring-[#0B2545]"
        />
      </div>

      <div className="mt-4 space-y-3">
        {groups.map((g) => {
          const rows = filterAndSort(g.rows);
          const open = expanded[g.key];
          return (
            <div key={g.key} className="rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() =>
                  setExpanded((prev) => ({ ...prev, [g.key]: !prev[g.key] }))
                }
                aria-expanded={open}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
                data-testid={`dashboard-loan-accordion-${g.key}`}
              >
                <span>{g.label}</span>
                <span className="text-slate-400">{open ? "▼" : "▶"}</span>
              </button>
              {open && (
                <div
                  data-testid={`dashboard-loan-panel-${g.key}`}
                  className="overflow-x-auto border-t border-slate-200"
                >
                  <table className="w-full border-collapse text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-left">loan_id</th>
                        <th className="px-3 py-2 text-left">都道府県</th>
                        <th className="px-3 py-2 text-left">種別</th>
                        <SortHeader
                          label="現在残高"
                          sortKey="current_balance"
                          active={sortKey}
                          dir={sortDir}
                          onClick={() => toggleSort("current_balance")}
                          testId="dashboard-loan-sort-current-balance"
                          align="right"
                        />
                        <SortHeader
                          label="金利"
                          sortKey="interest_rate"
                          active={sortKey}
                          dir={sortDir}
                          onClick={() => toggleSort("interest_rate")}
                          testId="dashboard-loan-sort-interest-rate"
                          align="right"
                        />
                        <SortHeader
                          label="延滞日数"
                          sortKey="delinquency_days"
                          active={sortKey}
                          dir={sortDir}
                          onClick={() => toggleSort("delinquency_days")}
                          testId="dashboard-loan-sort-delinquency-days"
                          align="right"
                        />
                        <th className="px-3 py-2 text-left">ステータス</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((l) => (
                        <tr
                          key={l.loan_id}
                          data-testid={`dashboard-loan-row-${l.loan_id}`}
                          onClick={() => handleRowClick(l.loan_id)}
                          className="cursor-pointer border-t border-slate-100 transition hover:bg-slate-50"
                        >
                          <td className="px-3 py-2 font-mono text-slate-800">
                            {l.loan_id}
                          </td>
                          <td className="px-3 py-2 text-slate-700">{l.prefecture}</td>
                          <td className="px-3 py-2 text-slate-700">{l.property_type}</td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-900">
                            {fmtMm(l.current_balance_mm)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">
                            {fmtPct(l.interest_rate, 3)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">
                            {fmtNumber(l.delinquency_days)}
                          </td>
                          <td className="px-3 py-2">
                            <StatusBadge status={l.status} />
                          </td>
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr>
                          <td
                            colSpan={7}
                            className="px-3 py-6 text-center text-sm text-slate-400"
                          >
                            該当する債権がありません
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SortHeader({
  label,
  sortKey,
  active,
  dir,
  onClick,
  testId,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  dir: SortDir;
  onClick: () => void;
  testId: string;
  align?: "left" | "right";
}) {
  const isActive = sortKey === active;
  const arrow = isActive ? (dir === "asc" ? "▲" : "▼") : "↕";
  return (
    <th className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        data-testid={testId}
        data-sort-dir={isActive ? dir : "none"}
        onClick={onClick}
        className={`inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider ${
          isActive ? "text-[#0B2545]" : "text-slate-500 hover:text-slate-700"
        }`}
      >
        {label}
        <span className="text-[10px]">{arrow}</span>
      </button>
    </th>
  );
}

function StatusBadge({ status }: { status: LoanStatus }) {
  const style = (() => {
    switch (status) {
      case "正常":
        return "bg-emerald-100 text-emerald-800";
      case "延滞30-59日":
        return "bg-amber-100 text-amber-800";
      case "延滞60-89日":
        return "bg-orange-100 text-orange-800";
      case "延滞90日以上":
        return "bg-red-100 text-red-800";
      case "デフォルト":
        return "bg-red-600 text-white";
      case "期限前弁済":
        return "bg-slate-100 text-slate-600";
      default:
        return "bg-slate-100 text-slate-600";
    }
  })();
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${style}`}>
      {status}
    </span>
  );
}

function fieldOf(key: SortKey): keyof LoanRecord {
  switch (key) {
    case "current_balance":
      return "current_balance_mm";
    case "interest_rate":
      return "interest_rate";
    case "delinquency_days":
      return "delinquency_days";
  }
}
