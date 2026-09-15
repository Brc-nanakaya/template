import { describe, it, expect, beforeEach } from "vitest";
import { STORAGE_KEY, loadTodos, saveTodos } from "@/lib/todo/storage";
import { createTodo } from "@/lib/todo/types";

describe("storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("未保存時は空配列を返す", () => {
    expect(loadTodos()).toEqual([]);
  });

  it("save → load で往復できる", () => {
    const todos = [createTodo({ title: "A" }), createTodo({ title: "B", priority: "high" })];
    saveTodos(todos);
    const loaded = loadTodos();
    expect(loaded).toHaveLength(2);
    expect(loaded.map((t) => t.title)).toEqual(["A", "B"]);
  });

  it("不正な JSON は空配列にフォールバックする", () => {
    window.localStorage.setItem(STORAGE_KEY, "{ broken");
    expect(loadTodos()).toEqual([]);
  });

  it("スキーマ不一致のデータは空配列にフォールバックする", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([{ foo: "bar" }]));
    expect(loadTodos()).toEqual([]);
  });
});
