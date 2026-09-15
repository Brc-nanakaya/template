"use client";

import { PRIORITIES, PRIORITY_LABELS } from "@/lib/todo/types";
import {
  SortKey,
  StatusFilter,
  ViewState,
} from "@/lib/todo/filters";

const controlClass =
  "h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "active", label: "未完了" },
  { value: "completed", label: "完了" },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "createdAt", label: "作成日（新しい順）" },
  { value: "dueDate", label: "期限" },
  { value: "priority", label: "優先度" },
];

interface TodoFiltersProps {
  view: ViewState;
  categories: string[];
  onChange: (patch: Partial<ViewState>) => void;
}

export function TodoFilters({ view, categories, onChange }: TodoFiltersProps) {
  return (
    <div
      data-testid="todo-filters"
      className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 shadow-sm"
    >
      <input
        data-testid="todo-search"
        className={`${controlClass} flex-1 basis-48`}
        placeholder="検索（タイトル・メモ）"
        value={view.search}
        onChange={(e) => onChange({ search: e.target.value })}
      />

      <select
        data-testid="todo-filter-status"
        className={controlClass}
        value={view.status}
        onChange={(e) => onChange({ status: e.target.value as StatusFilter })}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        data-testid="todo-filter-priority"
        className={controlClass}
        value={view.priority}
        onChange={(e) =>
          onChange({ priority: e.target.value as ViewState["priority"] })
        }
      >
        <option value="all">優先度: すべて</option>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            優先度: {PRIORITY_LABELS[p]}
          </option>
        ))}
      </select>

      <select
        data-testid="todo-filter-category"
        className={controlClass}
        value={view.category}
        onChange={(e) => onChange({ category: e.target.value })}
      >
        <option value="all">カテゴリ: すべて</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <select
        data-testid="todo-sort"
        className={controlClass}
        value={view.sort}
        onChange={(e) => onChange({ sort: e.target.value as SortKey })}
      >
        {SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            並び替え: {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
