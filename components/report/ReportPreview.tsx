"use client";

/**
 * レポートプレビュー (T15)。
 * Markdown 文字列を GFM で描画し、PDF ダウンロード / Markdown コピー のアクションを提供する。
 *
 * - PDF ダウンロード: T16 で印刷 CSS を整備しつつ `window.print()` を呼び出す想定。
 *   本コンポーネントは `onDownloadPdf` が渡されればそれを優先し、未渡しなら
 *   `window.print()` を直接実行する。
 * - Markdown コピー: クリップボードへ書き込み、完了/失敗のコールバックを呼ぶ。
 * - Markdown ダウンロード (T16): `onDownloadMd` が渡されれば使用、デフォルトでは
 *   Blob URL 経由で `<a download>` を合成クリック。
 *
 * data-testid:
 *   - `report-preview-container`
 *   - `report-btn-download-pdf`
 *   - `report-btn-copy-md`
 *   - `report-btn-download-md`
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Download, Printer } from "lucide-react";

export interface ReportPreviewProps {
  markdown: string;
  /** 既定ファイル名（拡張子なし）。例: `trust-report_2026-03` */
  filenameBase?: string;
  onDownloadPdf?: () => void;
  onDownloadMd?: (markdown: string, filenameBase: string) => void;
  onCopySuccess?: () => void;
  onCopyError?: (error: unknown) => void;
}

export function ReportPreview({
  markdown,
  filenameBase = "trust-report",
  onDownloadPdf,
  onDownloadMd,
  onCopySuccess,
  onCopyError,
}: ReportPreviewProps) {
  const handleDownloadPdf = () => {
    if (onDownloadPdf) {
      onDownloadPdf();
      return;
    }
    if (typeof window !== "undefined" && typeof window.print === "function") {
      window.print();
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function"
      ) {
        await navigator.clipboard.writeText(markdown);
        onCopySuccess?.();
        return;
      }
      throw new Error("clipboard API is not available");
    } catch (err) {
      onCopyError?.(err);
    }
  };

  const handleDownloadMd = () => {
    if (onDownloadMd) {
      onDownloadMd(markdown, filenameBase);
      return;
    }
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filenameBase}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap gap-2 print:hidden"
        role="toolbar"
        aria-label="レポート操作"
      >
        <button
          type="button"
          data-testid="report-btn-download-pdf"
          onClick={handleDownloadPdf}
          className="inline-flex items-center gap-2 rounded-md bg-[#0B2545] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#123565] focus:outline-none focus:ring-2 focus:ring-[#D4A017]"
        >
          <Printer className="h-4 w-4" aria-hidden />
          PDFダウンロード
        </button>
        <button
          type="button"
          data-testid="report-btn-copy-md"
          onClick={handleCopyMarkdown}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0B2545]"
        >
          <Copy className="h-4 w-4" aria-hidden />
          Markdownをコピー
        </button>
        <button
          type="button"
          data-testid="report-btn-download-md"
          onClick={handleDownloadMd}
          className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#0B2545]"
        >
          <Download className="h-4 w-4" aria-hidden />
          Markdownダウンロード
        </button>
      </div>

      <article
        data-testid="report-preview-container"
        className="prose prose-slate prose-sm max-w-none rounded-lg border border-slate-200 bg-white p-6 shadow-sm prose-headings:text-[#0B2545] prose-a:text-[#0B2545] prose-strong:text-[#0B2545] prose-table:text-xs"
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </article>
    </div>
  );
}
