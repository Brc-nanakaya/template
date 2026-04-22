"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type UploadStatus =
  | { kind: "idle" }
  | { kind: "ready"; files: File[] }
  | { kind: "error"; message: string };

const ACCEPTED = new Set([
  "text/csv",
  "application/vnd.ms-excel", // some browsers label CSV as this
  "application/json",
  "",
]);

function validate(files: FileList | File[]): UploadStatus {
  const list = Array.from(files);
  if (list.length === 0) return { kind: "idle" };
  for (const f of list) {
    const name = f.name.toLowerCase();
    const extOk = name.endsWith(".csv") || name.endsWith(".json");
    const typeOk = ACCEPTED.has(f.type);
    if (!extOk && !typeOk) {
      return {
        kind: "error",
        message: `${f.name}: 対応していない形式です（.csv / .json のみ受け付けます）`,
      };
    }
  }
  return { kind: "ready", files: list };
}

export default function HomePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<UploadStatus>({ kind: "idle" });
  const [isDragging, setIsDragging] = useState(false);

  const handleLoadSample = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("trust-data-source", "sample");
    }
    router.push("/dashboard");
  }, [router]);

  const handleFiles = useCallback((files: FileList | File[]) => {
    setStatus(validate(files));
  }, []);

  const handleGoUpload = useCallback(() => {
    if (status.kind !== "ready") return;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(
        "trust-data-source",
        JSON.stringify({
          kind: "upload",
          fileNames: status.files.map((f) => f.name),
        }),
      );
    }
    router.push("/dashboard");
  }, [router, status]);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-trust-bg px-4 py-10"
      data-testid="home-main"
    >
      <section className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-[0_4px_24px_rgba(11,37,69,0.08)] ring-1 ring-slate-200 sm:p-10">
        <header className="text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-trust-accent">
            TrustReport
          </p>
          <h1
            className="mt-3 text-2xl font-bold leading-snug text-trust-primary sm:text-3xl"
            data-testid="home-title"
          >
            信託期中管理レポート自動生成ツール
          </h1>
          <p
            className="mt-3 text-sm leading-relaxed text-trust-subtle sm:text-base"
            data-testid="home-subtitle"
          >
            資産流動化案件（住宅ローン信託）のサービサー月次報告から、
            <br className="hidden sm:inline" />
            ダッシュボード・異常値検知・AI所見付きPDFレポートを自動生成します。
          </p>
        </header>

        <div className="mt-8 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleLoadSample}
            className="inline-flex h-12 items-center justify-center rounded-lg bg-trust-primary px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#13315c] focus:outline-none focus-visible:ring-2 focus-visible:ring-trust-accent focus-visible:ring-offset-2"
            data-testid="home-btn-load-sample"
          >
            サンプルデータで今すぐデモ
          </button>
          <p className="text-center text-xs text-trust-subtle">
            SBIST-RMBS-2024-01 / 2026-03基準月のサンプル案件が読み込まれます
          </p>
        </div>

        <div className="my-8 flex items-center gap-3 text-xs text-trust-subtle">
          <span className="h-px flex-1 bg-slate-200" aria-hidden />
          <span>または自前のCSVをアップロード</span>
          <span className="h-px flex-1 bg-slate-200" aria-hidden />
        </div>

        <div
          className={[
            "rounded-xl border-2 border-dashed p-6 text-center transition-colors",
            isDragging
              ? "border-trust-accent bg-amber-50"
              : status.kind === "error"
                ? "border-trust-danger bg-red-50"
                : "border-slate-300 bg-slate-50",
          ].join(" ")}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          data-testid="home-upload-area"
          data-state={status.kind}
        >
          <p className="text-sm font-medium text-trust-ink">
            ここにCSV / JSONをドラッグ＆ドロップ
          </p>
          <p className="mt-1 text-xs text-trust-subtle">
            または クリックしてファイルを選択 (.csv / .json)
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFiles(e.target.files);
              }
            }}
            data-testid="home-input-file"
          />
          {status.kind === "ready" && (
            <p
              className="mt-3 truncate text-xs font-medium text-trust-primary"
              data-testid="home-upload-filename"
            >
              選択中: {status.files.map((f) => f.name).join(", ")}
            </p>
          )}
          {status.kind === "error" && (
            <p
              className="mt-3 text-xs font-medium text-trust-danger"
              data-testid="home-upload-error"
            >
              {status.message}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleGoUpload}
          disabled={status.kind !== "ready"}
          className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-lg border border-trust-primary bg-white px-6 text-sm font-semibold text-trust-primary transition hover:bg-trust-primary hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-trust-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400 disabled:hover:bg-white disabled:hover:text-slate-400"
          data-testid="home-btn-go-dashboard"
        >
          アップロードしたデータでダッシュボードを開く
        </button>

        <footer className="mt-8 text-center text-[11px] leading-relaxed text-trust-subtle">
          © SBI新生信託銀行 信託事業推進部 <br className="sm:hidden" />
          本ツールは営業デモ用であり、実データは含まれません。
        </footer>
      </section>
    </main>
  );
}
