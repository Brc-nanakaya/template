"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PRIORITIES, PRIORITY_LABELS, Priority, TodoInput } from "@/lib/todo/types";

const inputClass =
  "h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface TodoFormProps {
  onAdd: (input: TodoInput) => void;
}

export function TodoForm({ onAdd }: TodoFormProps) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState("");
  const [note, setNote] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({ title, priority, dueDate: dueDate || null, category, note });
    setTitle("");
    setPriority("medium");
    setDueDate("");
    setCategory("");
    setNote("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="todo-form"
      className="rounded-lg border bg-card p-4 shadow-sm"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            タイトル
          </label>
          <input
            data-testid="todo-input-title"
            className={inputClass}
            placeholder="やることを入力…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            優先度
          </label>
          <select
            data-testid="todo-input-priority"
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
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            期限
          </label>
          <input
            data-testid="todo-input-due"
            type="date"
            className={inputClass}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            カテゴリ
          </label>
          <input
            data-testid="todo-input-category"
            className={inputClass}
            placeholder="仕事 / 私用 など"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            メモ
          </label>
          <input
            data-testid="todo-input-note"
            className={inputClass}
            placeholder="補足（任意）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <Button type="submit" data-testid="todo-add-button" disabled={!title.trim()}>
          追加
        </Button>
      </div>
    </form>
  );
}
