"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  Priority,
  Todo,
} from "@/lib/todo/types";
import type { TodoPatch } from "@/hooks/useTodos";

const inputClass =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const PRIORITY_BADGE: Record<Priority, string> = {
  high: "bg-red-100 text-red-700 ring-red-200",
  medium: "bg-amber-100 text-amber-700 ring-amber-200",
  low: "bg-slate-100 text-slate-600 ring-slate-200",
};

interface TodoItemProps {
  todo: Todo;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: TodoPatch) => void;
}

export function TodoItem({ todo, onToggle, onRemove, onUpdate }: TodoItemProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(todo.title);
  const [priority, setPriority] = useState<Priority>(todo.priority);
  const [dueDate, setDueDate] = useState(todo.dueDate ?? "");
  const [category, setCategory] = useState(todo.category);
  const [note, setNote] = useState(todo.note);

  function startEdit() {
    setTitle(todo.title);
    setPriority(todo.priority);
    setDueDate(todo.dueDate ?? "");
    setCategory(todo.category);
    setNote(todo.note);
    setEditing(true);
  }

  function saveEdit() {
    if (!title.trim()) return;
    onUpdate(todo.id, {
      title: title.trim(),
      priority,
      dueDate: dueDate || null,
      category: category.trim(),
      note: note.trim(),
    });
    setEditing(false);
  }

  if (editing) {
    return (
      <li
        data-testid="todo-item"
        className="rounded-lg border bg-card p-3 shadow-sm"
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            data-testid="todo-edit-title"
            className={cn(inputClass, "sm:col-span-2")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select
            className={inputClass}
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
          <input
            type="date"
            className={inputClass}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="カテゴリ"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <input
            className={inputClass}
            placeholder="メモ"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <div className="mt-2 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            <X className="h-4 w-4" /> キャンセル
          </Button>
          <Button
            size="sm"
            data-testid="todo-edit-save"
            onClick={saveEdit}
            disabled={!title.trim()}
          >
            <Check className="h-4 w-4" /> 保存
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li
      data-testid="todo-item"
      data-completed={todo.completed}
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-card p-3 shadow-sm",
        todo.completed && "opacity-60",
      )}
    >
      <input
        type="checkbox"
        data-testid="todo-toggle"
        checked={todo.completed}
        onChange={() => onToggle(todo.id)}
        aria-label="完了切替"
        className="mt-1 h-4 w-4 flex-shrink-0 cursor-pointer accent-primary"
      />

      <div className="min-w-0 flex-1">
        <p
          data-testid="todo-title"
          className={cn(
            "text-sm font-medium text-foreground",
            todo.completed && "line-through",
          )}
        >
          {todo.title}
        </p>
        {todo.note && (
          <p className="mt-0.5 text-xs text-muted-foreground">{todo.note}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          <span
            className={cn(
              "rounded px-1.5 py-0.5 font-medium ring-1 ring-inset",
              PRIORITY_BADGE[todo.priority],
            )}
          >
            優先度: {PRIORITY_LABELS[todo.priority]}
          </span>
          {todo.dueDate && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
              期限: {todo.dueDate}
            </span>
          )}
          {todo.category && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
              {todo.category}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-shrink-0 gap-1">
        <Button
          size="icon"
          variant="ghost"
          data-testid="todo-edit-button"
          aria-label="編集"
          onClick={startEdit}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          data-testid="todo-delete-button"
          aria-label="削除"
          onClick={() => onRemove(todo.id)}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </li>
  );
}
