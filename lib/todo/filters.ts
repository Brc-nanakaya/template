import { Priority, Todo } from "./types";

export type StatusFilter = "all" | "active" | "completed";
export type SortKey = "createdAt" | "dueDate" | "priority";

/** 一覧の表示状態（検索・フィルタ・ソート）。 */
export interface ViewState {
  search: string;
  status: StatusFilter;
  priority: Priority | "all";
  category: string | "all";
  sort: SortKey;
}

export const DEFAULT_VIEW: ViewState = {
  search: "",
  status: "all",
  priority: "all",
  category: "all",
  sort: "createdAt",
};

/** タイトル・メモを対象に部分一致（大文字小文字を無視）で検索する。 */
export function searchTodos(todos: Todo[], query: string): Todo[] {
  const q = query.trim().toLowerCase();
  if (!q) return todos;
  return todos.filter(
    (t) =>
      t.title.toLowerCase().includes(q) || t.note.toLowerCase().includes(q),
  );
}

/** 完了状態・優先度・カテゴリで絞り込む。 */
export function filterTodos(
  todos: Todo[],
  { status, priority, category }: Pick<ViewState, "status" | "priority" | "category">,
): Todo[] {
  return todos.filter((t) => {
    if (status === "active" && t.completed) return false;
    if (status === "completed" && !t.completed) return false;
    if (priority !== "all" && t.priority !== priority) return false;
    if (category !== "all" && t.category !== category) return false;
    return true;
  });
}

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/** 指定キーでソートした新しい配列を返す（元配列は変更しない）。 */
export function sortTodos(todos: Todo[], sort: SortKey): Todo[] {
  const copy = [...todos];
  switch (sort) {
    case "dueDate":
      // 期限なしは末尾。同条件は新しい順。
      return copy.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return b.createdAt - a.createdAt;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
    case "priority":
      return copy.sort(
        (a, b) =>
          PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
          b.createdAt - a.createdAt,
      );
    case "createdAt":
    default:
      return copy.sort((a, b) => b.createdAt - a.createdAt); // 新しい順
  }
}

/** 検索→フィルタ→ソートをまとめて適用する。 */
export function applyView(todos: Todo[], view: ViewState): Todo[] {
  return sortTodos(filterTodos(searchTodos(todos, view.search), view), view.sort);
}

/** 既存タスクからカテゴリ候補（空文字除外・昇順）を集める。 */
export function collectCategories(todos: Todo[]): string[] {
  return Array.from(new Set(todos.map((t) => t.category).filter(Boolean))).sort();
}
