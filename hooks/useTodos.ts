"use client";

import { useEffect, useReducer, useState } from "react";
import { Todo, TodoInput, createTodo } from "@/lib/todo/types";
import { loadTodos, saveTodos } from "@/lib/todo/storage";

/** 編集で更新できるフィールド。 */
export type TodoPatch = Partial<Pick<Todo, "title" | "note" | "priority" | "dueDate" | "category">>;

type Action =
  | { type: "hydrate"; todos: Todo[] }
  | { type: "add"; input: TodoInput }
  | { type: "update"; id: string; patch: TodoPatch }
  | { type: "toggle"; id: string }
  | { type: "remove"; id: string };

function reducer(state: Todo[], action: Action): Todo[] {
  switch (action.type) {
    case "hydrate":
      return action.todos;
    case "add":
      return [createTodo(action.input), ...state];
    case "update":
      return state.map((t) =>
        t.id === action.id ? { ...t, ...action.patch } : t,
      );
    case "toggle":
      return state.map((t) =>
        t.id === action.id ? { ...t, completed: !t.completed } : t,
      );
    case "remove":
      return state.filter((t) => t.id !== action.id);
    default:
      return state;
  }
}

/**
 * Todo の状態管理フック。
 * - 初回マウント後に localStorage から読み込む（hydration エラー回避のため SSR では空）。
 * - 読み込み完了後の変更のみ保存する（初期 [] で上書き保存しない）。
 */
export function useTodos() {
  const [todos, dispatch] = useReducer(reducer, []);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    dispatch({ type: "hydrate", todos: loadTodos() });
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveTodos(todos);
  }, [todos, hydrated]);

  return {
    todos,
    hydrated,
    addTodo: (input: TodoInput) => dispatch({ type: "add", input }),
    updateTodo: (id: string, patch: TodoPatch) =>
      dispatch({ type: "update", id, patch }),
    toggleTodo: (id: string) => dispatch({ type: "toggle", id }),
    removeTodo: (id: string) => dispatch({ type: "remove", id }),
  };
}
