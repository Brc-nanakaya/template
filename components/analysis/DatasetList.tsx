"use client";

import { Database, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnalysisDatasetSummary } from "@/lib/analysis/types";

interface DatasetListProps {
  datasets: AnalysisDatasetSummary[];
  selectedId: string | null;
  busy?: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function DatasetList({
  datasets,
  selectedId,
  busy = false,
  onSelect,
  onDelete,
}: DatasetListProps) {
  if (datasets.length === 0) {
    return (
      <p
        data-testid="dataset-list-empty"
        className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground"
      >
        保存済みのデータセットはまだありません
      </p>
    );
  }

  return (
    <ul className="space-y-2" data-testid="dataset-list">
      {datasets.map((ds) => {
        const selected = ds.id === selectedId;
        return (
          <li key={ds.id}>
            <div
              className={`flex items-start gap-3 rounded-xl border px-3 py-3 transition ${
                selected
                  ? "border-[#bc0017] bg-[#bc0017]/5"
                  : "border-black/8 bg-white hover:border-black/20"
              }`}
            >
              <button
                type="button"
                data-testid={`dataset-item-${ds.id}`}
                className="flex min-w-0 flex-1 items-start gap-3 text-left"
                onClick={() => onSelect(ds.id)}
                disabled={busy}
              >
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#bc0017]/10 text-[#bc0017]">
                  <Database className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[#050505]">
                    {ds.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {ds.fileName} · {ds.rowCount} 行 · {ds.columns.length} 列
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {formatDate(ds.createdAt)}
                  </span>
                </span>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-testid={`dataset-delete-${ds.id}`}
                aria-label={`${ds.name} を削除`}
                disabled={busy}
                onClick={() => onDelete(ds.id)}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
