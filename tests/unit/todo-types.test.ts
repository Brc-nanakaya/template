import { describe, it, expect } from "vitest";
import { createTodo, todoSchema } from "@/lib/todo/types";

describe("createTodo", () => {
  it("既定値（優先度 medium・未完了・id/createdAt）を補完する", () => {
    const todo = createTodo({ title: "買い物" });
    expect(todo.title).toBe("買い物");
    expect(todo.priority).toBe("medium");
    expect(todo.completed).toBe(false);
    expect(todo.dueDate).toBeNull();
    expect(todo.category).toBe("");
    expect(todo.id).toBeTruthy();
    expect(typeof todo.createdAt).toBe("number");
  });

  it("タイトル・メモ・カテゴリの前後空白を除去する", () => {
    const todo = createTodo({ title: "  掃除  ", note: " メモ ", category: " 家事 " });
    expect(todo.title).toBe("掃除");
    expect(todo.note).toBe("メモ");
    expect(todo.category).toBe("家事");
  });

  it("空の期限文字列は null に正規化する", () => {
    expect(createTodo({ title: "x", dueDate: "" }).dueDate).toBeNull();
    expect(createTodo({ title: "x", dueDate: "2026-07-01" }).dueDate).toBe(
      "2026-07-01",
    );
  });
});

describe("todoSchema", () => {
  it("正しい Todo を検証できる", () => {
    const todo = createTodo({ title: "ok", priority: "high" });
    expect(todoSchema.safeParse(todo).success).toBe(true);
  });

  it("タイトル空・不正な優先度は弾く", () => {
    const base = createTodo({ title: "ok" });
    expect(todoSchema.safeParse({ ...base, title: "" }).success).toBe(false);
    expect(
      todoSchema.safeParse({ ...base, priority: "urgent" }).success,
    ).toBe(false);
  });
});
