import { Todo, todoArraySchema } from "./types";

/** localStorage の保存キー。 */
export const STORAGE_KEY = "training-todos";

/**
 * localStorage から Todo 一覧を読み込む。
 * SSR (window 不在)・未保存・JSON 破損・スキーマ不一致のいずれでも空配列を返す。
 */
export function loadTodos(): Todo[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = todoArraySchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** Todo 一覧を localStorage に保存する。SSR 時・容量超過時は黙って無視する。 */
export function saveTodos(todos: Todo[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch {
    /* quota などのエラーは無視 */
  }
}
