import Link from "next/link";
import type { CatalogApp } from "@/lib/catalog/industries";

export function IndustryAppCard({ app }: { app: CatalogApp }) {
  const Icon = app.icon;
  return (
    <Link
      href={app.href}
      data-testid={app.testid}
      className="group flex flex-col rounded-2xl border border-black/5 bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.08)] transition hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(0,0,0,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bc0017]"
    >
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#bc0017]/10 text-[#bc0017]">
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="mt-4 text-lg font-bold tracking-tight text-[#050505]">
        {app.title}
      </h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
        {app.description}
      </p>
      <span className="mt-4 inline-flex items-center text-sm font-semibold text-[#bc0017]">
        開く
        <span className="ml-1 transition group-hover:translate-x-1">→</span>
      </span>
    </Link>
  );
}
