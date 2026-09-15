import { z } from "zod";

/** タスクの優先度。配列順がそのまま「高→低」の表示・ソート順になる。 */
export const PRIORITIES = ["high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

/**
 * localStorage に保存される Todo の zod スキーマ。
 * 永続データの破損・スキーマ変更に備え、読み込み時はこのスキーマで検証する。
 */
export const todoSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, "タイトルは必須です"),
  note: z.string().default(""),
  priority: z.enum(PRIORITIES),
  /** 期限 (YYYY-MM-DD)。未設定は null。 */
  dueDate: z.string().nullable().default(null),
  category: z.string().default(""),
  completed: z.boolean().default(false),
  /** 作成日時 (epoch ms)。 */
  createdAt: z.number(),
});

export type Todo = z.infer<typeof todoSchema>;

export const todoArraySchema = z.array(todoSchema);

/** タスク作成・編集時の入力値。 */
export interface TodoInput {
  title: string;
  note?: string;
  priority?: Priority;
  dueDate?: string | null;
  category?: string;
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `todo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 入力値から新規 Todo を生成する。id・createdAt・completed を補完する。 */
export function createTodo(input: TodoInput): Todo {
  return {
    id: generateId(),
    title: input.title.trim(),
    note: input.note?.trim() ?? "",
    priority: input.priority ?? "medium",
    dueDate: input.dueDate?.trim() ? input.dueDate.trim() : null,
    category: input.category?.trim() ?? "",
    completed: false,
    createdAt: Date.now(),
  };
}
