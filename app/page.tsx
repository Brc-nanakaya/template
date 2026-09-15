import { INDUSTRIES } from "@/lib/catalog/industries";
import { IndustryAppCard } from "@/components/catalog/IndustryAppCard";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#ececec]">
      <section className="bg-gradient-to-b from-[#bc0017] via-[#d30a1a] to-[#a80014] text-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 text-center sm:py-20">
          <p className="text-sm font-medium tracking-[0.2em] text-[#f7dda8]">
            業界別アプリケーション
          </p>
          <h1
            className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl"
            data-testid="app-title"
          >
            アプリ一覧
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-white/90 sm:text-base">
            自動車・金融など、業界を選んで利用するアプリを開いてください。
          </p>
          <nav
            className="mx-auto mt-8 flex max-w-2xl flex-wrap justify-center gap-2"
            data-testid="industry-nav"
            aria-label="業界一覧"
          >
            {INDUSTRIES.map((industry) => (
              <a
                key={industry.id}
                href={`#industry-${industry.id}`}
                data-testid={`industry-nav-${industry.id}`}
                className="rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f7dda8]"
              >
                {industry.name}
              </a>
            ))}
          </nav>
        </div>
      </section>

      <div className="mx-auto w-full max-w-5xl space-y-12 px-4 py-10">
        {INDUSTRIES.map((industry) => {
          const Icon = industry.icon;
          return (
            <section
              key={industry.id}
              id={`industry-${industry.id}`}
              data-testid={`industry-${industry.id}`}
              className="scroll-mt-16"
            >
              <div className="mb-5 flex items-start gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#bc0017] text-white">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-[#050505]">
                    {industry.name}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {industry.description}
                  </p>
                </div>
              </div>
              <div
                className="grid gap-5 sm:grid-cols-2"
                data-testid={`industry-${industry.id}-apps`}
              >
                {industry.apps.map((app) => (
                  <IndustryAppCard key={app.testid} app={app} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
