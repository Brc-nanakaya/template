"use client";

import { useCallback, useEffect, useState } from "react";
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
  refresh: () => Promise<void>;
  select: (id: string | null) => Promise<void>;
  importFile: (file: File, name?: string) => Promise<AnalysisDatasetSummary>;
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
    setDatasets(body.datasets ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
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
  }, [refresh]);

  const select = useCallback(async (id: string | null) => {
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
    setSelected(body.dataset ?? null);
  }, []);

  const importFile = useCallback(
    async (file: File, name?: string) => {
      setSaving(true);
      setError(null);
      try {
        const form = new FormData();
        form.append("file", file);
        if (name) form.append("name", name);

        const res = await fetch("/api/analysis/datasets", {
          method: "POST",
          body: form,
        });
        const body = (await res.json()) as {
          dataset?: AnalysisDatasetSummary;
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
        return body.dataset;
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
        if (selected?.id === id) setSelected(null);
        await refresh();
      } finally {
        setSaving(false);
      }
    },
    [refresh, selected?.id],
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
