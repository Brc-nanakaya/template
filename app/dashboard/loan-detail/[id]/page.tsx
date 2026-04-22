/**
 * 個別債権詳細ページ (T13)。
 * /dashboard/loan-detail/[loan_id] でその債権の全フィールドと関連レコード
 * （期限前弁済・デフォルト回収）を表示。ダッシュボードへの戻り導線を提供。
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { loadAllSampleData } from "@/lib/loaders";
import { fmtMm, fmtPct, fmtNumber } from "@/lib/formatters";
import type { LoanRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Props {
  params: { id: string };
}

export default async function LoanDetailPage({ params }: Props) {
  const { id } = params;
  const ds = await loadAllSampleData();
  const loan = ds.loans.find((l) => l.loan_id === id);
  if (!loan) notFound();
  const prepayments = ds.prepayments.filter((p) => p.loan_id === id);
  const defaults = ds.defaults.filter((d) => d.loan_id === id);

  return (
    <main
      className="min-h-screen bg-trust-bg p-4 sm:p-6"
      data-testid="loan-detail-main"
    >
      <div className="mx-auto max-w-4xl space-y-5">
        <nav className="text-sm">
          <Link
            href="/dashboard"
            className="text-[#0B2545] hover:underline"
            data-testid="loan-detail-back"
          >
            ← ダッシュボードへ戻る
          </Link>
        </nav>

        <header className="rounded-xl bg-white p-5 shadow-[0_2px_12px_rgba(11,37,69,0.06)] ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            債権 ID
          </p>
          <h1
            className="mt-1 font-mono text-2xl font-bold text-[#0B2545]"
            data-testid="loan-detail-id"
          >
            {loan.loan_id}
          </h1>
          <p
            className="mt-1 text-sm text-slate-600"
            data-testid="loan-detail-status"
          >
            ステータス: <strong>{loan.status}</strong> / 延滞日数 {fmtNumber(loan.delinquency_days)} 日
          </p>
        </header>

        <section
          className="rounded-xl bg-white p-5 shadow-[0_2px_12px_rgba(11,37,69,0.06)] ring-1 ring-slate-200"
          data-testid="loan-detail-attributes"
        >
          <h2 className="text-base font-bold text-slate-800">属性情報</h2>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <Row label="借入人年齢" value={`${fmtNumber(loan.borrower_age)} 歳`} />
            <Row label="所在都道府県" value={loan.prefecture} />
            <Row label="物件種別" value={loan.property_type} />
            <Row label="金利タイプ" value={loan.interest_type} />
            <Row label="金利" value={fmtPct(loan.interest_rate, 3)} />
            <Row label="当初残高" value={fmtMm(loan.original_balance_mm)} />
            <Row
              label="現在残高"
              value={fmtMm(loan.current_balance_mm)}
              testId="loan-detail-current-balance"
            />
            <Row
              label="当初期間"
              value={`${fmtNumber(loan.original_term_months)} ヶ月`}
            />
            <Row
              label="残存期間"
              value={`${fmtNumber(loan.remaining_term_months)} ヶ月`}
            />
            <Row label="LTV (当初)" value={fmtPct(loan.ltv_original)} />
            <Row label="LTV (現在)" value={fmtPct(loan.ltv_current)} />
            <Row label="DTI" value={fmtPct(loan.dti)} />
            <Row label="債権発生日" value={loan.origination_date} />
          </dl>
        </section>

        {prepayments.length > 0 && (
          <section
            className="rounded-xl bg-white p-5 shadow-[0_2px_12px_rgba(11,37,69,0.06)] ring-1 ring-slate-200"
            data-testid="loan-detail-prepayments"
          >
            <h2 className="text-base font-bold text-slate-800">
              期限前弁済履歴 ({prepayments.length} 件)
            </h2>
            <ul className="mt-2 divide-y divide-slate-100 text-sm">
              {prepayments.map((p, i) => (
                <li key={i} className="flex justify-between gap-4 py-2">
                  <span className="text-slate-600">{p.prepayment_date}</span>
                  <span className="font-mono tabular-nums text-slate-900">
                    {fmtMm(p.prepayment_amount_mm)}
                  </span>
                  <span className="text-slate-600">理由: {p.reason}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {defaults.length > 0 && (
          <section
            className="rounded-xl bg-white p-5 shadow-[0_2px_12px_rgba(11,37,69,0.06)] ring-1 ring-slate-200"
            data-testid="loan-detail-defaults"
          >
            <h2 className="text-base font-bold text-slate-800">
              デフォルト・回収
            </h2>
            <ul className="mt-2 space-y-2 text-sm">
              {defaults.map((d, i) => (
                <li key={i} className="rounded-lg bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-slate-600">デフォルト日: {d.default_date}</span>
                    <span className="font-semibold text-red-700">
                      事由: {d.cause}
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-1 gap-x-6 gap-y-0.5 text-xs text-slate-700 sm:grid-cols-2">
                    <span>デフォルト残高: {fmtMm(d.default_balance_mm)}</span>
                    <span>処分状況: {d.disposal_status}</span>
                    <span>回収額: {fmtMm(d.recovery_amount_mm)}</span>
                    <span>損失額: {fmtMm(d.loss_amount_mm)}</span>
                    <span>処分日: {d.disposal_date || "-"}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}

function Row({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-slate-100 py-1.5 last:border-b-0">
      <dt className="text-slate-500">{label}</dt>
      <dd
        className="font-mono tabular-nums text-slate-900"
        data-testid={testId}
      >
        {value}
      </dd>
    </div>
  );
}
