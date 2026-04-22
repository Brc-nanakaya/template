import Link from "next/link";

export default function DashboardPage() {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-trust-bg px-4 py-10"
      data-testid="dashboard-main"
    >
      <section className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-[0_4px_24px_rgba(11,37,69,0.08)] ring-1 ring-slate-200 sm:p-10">
        <h1
          className="text-xl font-bold text-trust-primary"
          data-testid="dashboard-placeholder-title"
        >
          ダッシュボード（T07 で本実装）
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-trust-subtle">
          サンプルデータ / アップロードデータの選択が完了しました。
          <br />
          本ページは T07 以降で案件ヘッダー・KPI・チャートを実装します。
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg border border-trust-primary px-4 text-sm font-semibold text-trust-primary transition hover:bg-trust-primary hover:text-white"
          data-testid="dashboard-btn-back-home"
        >
          トップに戻る
        </Link>
      </section>
    </main>
  );
}
