"use client";

/**
 * AI 所見生成・編集セクション (T14)。
 *
 * - 生成ボタン: POST `/api/generate-commentary` を呼び出し、所見 Markdown を取得
 * - 取得後: 編集可能な textarea に所見を表示
 * - 再生成ボタン: 同じ API を再呼び出し
 * - レポート反映ボタン: 編集後の Markdown を sessionStorage "trust:commentary" に保存し `/report` へ遷移
 *
 * data-testid:
 *   - `dashboard-commentary-section`
 *   - `dashboard-btn-generate-commentary`
 *   - `dashboard-commentary-editor`
 *   - `dashboard-btn-regenerate`
 *   - `dashboard-btn-apply-commentary`
 *   - `dashboard-commentary-status`
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Anomaly, DealInfo, MonthlyPerformance, TriggerTest } from "@/lib/types";
import { toastError, toastSuccess } from "@/lib/toast";

export interface CommentaryEditorProps {
  dealInfo: DealInfo;
  currentMonth: MonthlyPerformance;
  monthlyHistory: MonthlyPerformance[];
  anomalies: Anomaly[];
  triggerStatus: TriggerTest[];
}

export function CommentaryEditor({
  dealInfo,
  currentMonth,
  monthlyHistory,
  anomalies,
  triggerStatus,
}: CommentaryEditorProps) {
  const router = useRouter();
  const [commentary, setCommentary] = useState<string>("");
  const [mode, setMode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callApi = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-commentary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealInfo,
          currentMonth,
          monthlyHistory,
          anomalies: anomalies.map((a) => ({
            severity: a.severity,
            title: a.title,
            description: a.description,
          })),
          triggerStatus: triggerStatus
            .filter((t) => t.month === dealInfo.report_month)
            .map((t) => ({
              trigger_name: t.trigger_name,
              threshold: t.threshold,
              current_value: t.current_value,
              breach: t.breach,
            })),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { commentary: string; mode: string };
      setCommentary(data.commentary);
      setMode(data.mode);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      toastError("AI 所見の生成に失敗しました", message);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("trust:commentary", commentary);
    }
    toastSuccess("所見をレポートに反映しました", "プレビュー画面に遷移します。");
    router.push("/report");
  };

  return (
    <section
      data-testid="dashboard-commentary-section"
      aria-label="AI 所見生成"
      className="rounded-xl bg-white p-5 shadow-[0_2px_12px_rgba(11,37,69,0.06)] ring-1 ring-slate-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-[#0B2545]">AI 所見</h2>
        <div className="flex flex-wrap gap-2">
          {commentary === "" ? (
            <button
              type="button"
              data-testid="dashboard-btn-generate-commentary"
              onClick={callApi}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md bg-[#0B2545] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#123565] disabled:opacity-60"
            >
              {loading ? "生成中..." : "AI 所見を生成"}
            </button>
          ) : (
            <>
              <button
                type="button"
                data-testid="dashboard-btn-regenerate"
                onClick={callApi}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {loading ? "生成中..." : "再生成"}
              </button>
              <button
                type="button"
                data-testid="dashboard-btn-apply-commentary"
                onClick={handleApply}
                className="inline-flex items-center gap-2 rounded-md bg-[#D4A017] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#b98b11]"
              >
                レポートに反映
              </button>
            </>
          )}
        </div>
      </div>

      <p
        className="mt-2 text-xs text-slate-500"
        data-testid="dashboard-commentary-status"
      >
        {error
          ? `エラー: ${error}`
          : mode === "mock"
            ? "モック応答（NEXT_PUBLIC_MOCK_LLM=true）"
            : mode === "openai"
              ? "OpenAI gpt-4o-mini で生成"
              : mode === "fallback"
                ? "フォールバックテンプレート（API キー未設定）"
                : "未生成。ボタンから所見を生成してください。"}
      </p>

      <textarea
        data-testid="dashboard-commentary-editor"
        value={commentary}
        onChange={(e) => setCommentary(e.target.value)}
        rows={14}
        placeholder="ここに AI 生成の所見が表示されます。生成後は自由に編集可能です。"
        className="mt-3 w-full resize-y rounded-md border border-slate-300 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800 focus:border-[#0B2545] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0B2545]"
      />
    </section>
  );
}
