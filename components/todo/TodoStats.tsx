"use client";

import { Todo } from "@/lib/todo/types";

interface TodoStatsProps {
  todos: Todo[];
}

export function TodoStats({ todos }: TodoStatsProps) {
  const total = todos.length;
  const completed = todos.filter((t) => t.completed).length;
  const active = total - completed;
  const rate = total === 0 ? 0 : Math.round((completed / total) * 100);

  const items = [
    { label: "総数", value: String(total), testid: "stat-total" },
    { label: "未完了", value: String(active), testid: "stat-active" },
    { label: "完了率", value: `${rate}%`, testid: "stat-rate" },
  ];

  return (
    <div data-testid="todo-stats" className="grid grid-cols-3 gap-2">
      {items.map((item) => (
        <div
          key={item.testid}
          data-testid={item.testid}
          className="rounded-lg border bg-card px-3 py-2 text-center shadow-sm"
        >
          <p className="text-lg font-bold text-foreground">{item.value}</p>
          <p className="text-xs text-muted-foreground">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
