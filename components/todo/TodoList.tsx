"use client";

import { Todo } from "@/lib/todo/types";
import type { TodoPatch } from "@/hooks/useTodos";
import { TodoItem } from "./TodoItem";

interface TodoListProps {
  todos: Todo[];
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: TodoPatch) => void;
}

export function TodoList({ todos, onToggle, onRemove, onUpdate }: TodoListProps) {
  if (todos.length === 0) {
    return (
      <p
        data-testid="todo-empty"
        className="rounded-lg border border-dashed bg-card px-4 py-10 text-center text-sm text-muted-foreground"
      >
        表示できるタスクがありません。
      </p>
    );
  }

  return (
    <ul data-testid="todo-list" className="space-y-2">
      {todos.map((todo) => (
        <TodoItem
          key={todo.id}
          todo={todo}
          onToggle={onToggle}
          onRemove={onRemove}
          onUpdate={onUpdate}
        />
      ))}
    </ul>
  );
}
