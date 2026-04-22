export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-trust-bg p-6">
      <div className="rounded-xl bg-white p-10 shadow-md">
        <h1 className="text-2xl font-bold text-trust-primary" data-testid="home-title">
          信託期中管理レポート自動生成ツール
        </h1>
        <p className="mt-2 text-sm text-trust-subtle" data-testid="home-subtitle">
          T06 で本実装予定のトップページです。
        </p>
      </div>
    </main>
  );
}
