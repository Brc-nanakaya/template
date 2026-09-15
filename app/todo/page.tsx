"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTodos } from "@/hooks/useTodos";
import { TodoInput } from "@/lib/todo/types";
import {
  DEFAULT_VIEW,
  ViewState,
  applyView,
  collectCategories,
} from "@/lib/todo/filters";
import { TodoForm } from "@/components/todo/TodoForm";
import { TodoStats } from "@/components/todo/TodoStats";
import { TodoFilters } from "@/components/todo/TodoFilters";
import { TodoList } from "@/components/todo/TodoList";
import { toastSuccess } from "@/lib/toast";

export default function TodoPage() {
  const { todos, hydrated, addTodo, updateTodo, toggleTodo, removeTodo } =
    useTodos();
  const [view, setView] = useState<ViewState>(DEFAULT_VIEW);

  const categories = useMemo(() => collectCategories(todos), [todos]);
  const visibleTodos = useMemo(() => applyView(todos, view), [todos, view]);

  function handleAdd(input: TodoInput) {
    addTodo(input);
    toastSuccess("タスクを追加しました", input.title);
  }

  function handleRemove(id: string) {
    removeTodo(id);
    toastSuccess("タスクを削除しました");
  }

  function patchView(patch: Partial<ViewState>) {
    setView((prev) => ({ ...prev, ...patch }));
  }

  return (
    <main className="min-h-screen bg-[#ececec]">
      <section className="bg-[#050505] text-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5">
          <Link
            href="/"
            className="text-xs text-white/75 transition hover:text-white"
            data-testid="back-to-top"
          >
            ← トップへ戻る
          </Link>
          <p className="text-xs text-white/75">選ばれた人だけのハイクラス風レイアウト</p>
        </div>
      </section>

      <section className="bg-gradient-to-b from-[#bc0017] via-[#d30a1a] to-[#a80014] text-white">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 text-center sm:py-20">
          <p className="text-sm font-medium tracking-[0.2em] text-[#f7dda8]">
            ハイクラスなタスク管理なら
          </p>
          <h1
            className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl"
            data-testid="app-title"
          >
            ToDo 管理
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-white/90 sm:text-base">
            タスクの追加・編集・完了管理。データはブラウザに保存されます。
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="space-y-4 rounded-2xl border border-black/5 bg-white p-4 shadow-[0_10px_30px_rgba(0,0,0,0.1)] sm:p-6">
          <TodoForm onAdd={handleAdd} />
          <TodoStats todos={todos} />
          <TodoFilters view={view} categories={categories} onChange={patchView} />

          {hydrated ? (
            <TodoList
              todos={visibleTodos}
              onToggle={toggleTodo}
              onRemove={handleRemove}
              onUpdate={updateTodo}
            />
          ) : (
            <p
              data-testid="todo-loading"
              className="rounded-lg border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground"
            >
              読み込み中…
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
