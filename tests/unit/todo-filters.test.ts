import { describe, it, expect } from "vitest";
import { Todo } from "@/lib/todo/types";
import {
  applyView,
  collectCategories,
  DEFAULT_VIEW,
  filterTodos,
  searchTodos,
  sortTodos,
} from "@/lib/todo/filters";

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: overrides.id ?? "id",
    title: "タイトル",
    note: "",
    priority: "medium",
    dueDate: null,
    category: "",
    completed: false,
    createdAt: 0,
    ...overrides,
  };
}

const sample: Todo[] = [
  makeTodo({ id: "a", title: "資料作成", note: "会議用", priority: "high", dueDate: "2026-07-10", category: "仕事", createdAt: 100 }),
  makeTodo({ id: "b", title: "買い物", note: "牛乳", priority: "low", dueDate: "2026-06-20", category: "私用", createdAt: 200, completed: true }),
  makeTodo({ id: "c", title: "ジム", priority: "medium", category: "私用", createdAt: 300 }),
];

describe("searchTodos", () => {
  it("タイトル・メモを大文字小文字を無視して部分一致検索する", () => {
    expect(searchTodos(sample, "資料").map((t) => t.id)).toEqual(["a"]);
    expect(searchTodos(sample, "牛乳").map((t) => t.id)).toEqual(["b"]);
  });

  it("空クエリは全件返す", () => {
    expect(searchTodos(sample, "  ")).toHaveLength(3);
  });
});

describe("filterTodos", () => {
  it("完了状態で絞り込む", () => {
    expect(
      filterTodos(sample, { status: "active", priority: "all", category: "all" }).map((t) => t.id),
    ).toEqual(["a", "c"]);
    expect(
      filterTodos(sample, { status: "completed", priority: "all", category: "all" }).map((t) => t.id),
    ).toEqual(["b"]);
  });

  it("優先度・カテゴリで絞り込む", () => {
    expect(
      filterTodos(sample, { status: "all", priority: "high", category: "all" }).map((t) => t.id),
    ).toEqual(["a"]);
    expect(
      filterTodos(sample, { status: "all", priority: "all", category: "私用" }).map((t) => t.id),
    ).toEqual(["b", "c"]);
  });
});

describe("sortTodos", () => {
  it("作成日は新しい順", () => {
    expect(sortTodos(sample, "createdAt").map((t) => t.id)).toEqual(["c", "b", "a"]);
  });

  it("優先度は高→低", () => {
    expect(sortTodos(sample, "priority").map((t) => t.id)).toEqual(["a", "c", "b"]);
  });

  it("期限は昇順・未設定は末尾", () => {
    expect(sortTodos(sample, "dueDate").map((t) => t.id)).toEqual(["b", "a", "c"]);
  });

  it("元の配列は変更しない", () => {
    const before = sample.map((t) => t.id);
    sortTodos(sample, "priority");
    expect(sample.map((t) => t.id)).toEqual(before);
  });
});

describe("applyView", () => {
  it("検索・フィルタ・ソートを複合適用する", () => {
    const result = applyView(sample, {
      ...DEFAULT_VIEW,
      category: "私用",
      sort: "priority",
    });
    expect(result.map((t) => t.id)).toEqual(["c", "b"]);
  });
});

describe("collectCategories", () => {
  it("空文字を除き重複なし・昇順で返す", () => {
    expect(collectCategories(sample)).toEqual(["仕事", "私用"]);
  });
});
