"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  AnalysisDataset,
  AnalysisDatasetSummary,
} from "@/lib/analysis/types";

interface UseAnalysisDatasetsResult {
  datasets: AnalysisDatasetSummary[];
  selected: AnalysisDataset | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  refresh: () => Promise<AnalysisDatasetSummary[]>;
  select: (id: string | null) => Promise<void>;
  importFile: (
    file: File,
    name?: string,
    options?: { replaceAll?: boolean },
  ) => Promise<{ dataset: AnalysisDatasetSummary; replacedCount: number }>;
  remove: (id: string) => Promise<void>;
}

export function useAnalysisDatasets(): UseAnalysisDatasetsResult {
  const [datasets, setDatasets] = useState<AnalysisDatasetSummary[]>([]);
  const [selected, setSelected] = useState<AnalysisDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/analysis/datasets");
    const body = (await res.json()) as {
      datasets?: AnalysisDatasetSummary[];
      error?: string;
      detail?: string;
    };
    if (!res.ok) {
      throw new Error(body.detail || body.error || "一覧の取得に失敗しました");
    }
    const list = body.datasets ?? [];
    setDatasets(list);
    return list;
  }, []);

  /** 最後に要求した選択。遅れて返った古い応答で表示を上書きしないために使う */
  const selectSeq = useRef(0);

  const select = useCallback(async (id: string | null) => {
    const seq = ++selectSeq.current;
    if (!id) {
      setSelected(null);
      return;
    }
    setError(null);
    const res = await fetch(`/api/analysis/datasets/${id}`);
    const body = (await res.json()) as {
      dataset?: AnalysisDataset;
      error?: string;
      detail?: string;
    };
    if (!res.ok) {
      throw new Error(body.detail || body.error || "詳細の取得に失敗しました");
    }
    // 初回の自動選択が取り込み後の選択より遅れて返ることがあるため、最新の要求だけ反映する
    if (seq !== selectSeq.current) return;
    setSelected(body.dataset ?? null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await refresh();
        // ダッシュボードを空にしないよう、最新のデータセットを初期表示する
        if (!cancelled && list[0]) await select(list[0].id);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "一覧の取得に失敗しました");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, select]);

  const importFile = useCallback(
    async (file: File, name?: string, options?: { replaceAll?: boolean }) => {
      setSaving(true);
      setError(null);
      try {
        const form = new FormData();
        form.append("file", file);
        if (name) form.append("name", name);
        form.append("mode", options?.replaceAll ? "replace" : "append");

        const res = await fetch("/api/analysis/datasets", {
          method: "POST",
          body: form,
        });
        const body = (await res.json()) as {
          dataset?: AnalysisDatasetSummary;
          replacedCount?: number;
          error?: string;
          detail?: string;
        };
        if (!res.ok || !body.dataset) {
          throw new Error(
            body.detail || body.error || "データベースへの保存に失敗しました",
          );
        }

        await refresh();
        await select(body.dataset.id);
        return { dataset: body.dataset, replacedCount: body.replacedCount ?? 0 };
      } finally {
        setSaving(false);
      }
    },
    [refresh, select],
  );

  const remove = useCallback(
    async (id: string) => {
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`/api/analysis/datasets/${id}`, {
          method: "DELETE",
        });
        const body = (await res.json()) as { error?: string; detail?: string };
        if (!res.ok) {
          throw new Error(body.detail || body.error || "削除に失敗しました");
        }
        const list = await refresh();
        if (selected?.id === id) {
          // 表示中を消したら、残りの最新データセットにダッシュボードを切り替える
          setSelected(null);
          if (list[0]) await select(list[0].id);
        }
      } finally {
        setSaving(false);
      }
    },
    [refresh, select, selected?.id],
  );

  return {
    datasets,
    selected,
    loading,
    saving,
    error,
    refresh,
    select,
    importFile,
    remove,
  };
}
