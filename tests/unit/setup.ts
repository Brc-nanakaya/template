import { config } from "dotenv";
import "@testing-library/jest-dom/vitest";

// DB を使うテスト向けに .env.local を読み込む（Vitest は自動で読まない）
config({ path: [".env.local", ".env"], quiet: true });

/**
 * jsdom の localStorage が不完全（clear 未実装）な環境向けの in-memory ポリフィル。
 * テストごとの独立性を担保するため、Storage 互換の実装で差し替える。
 */
class MemoryStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

// node 環境のテスト（DB / サーバーロジック）では window が無いのでスキップする
if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", {
    value: new MemoryStorage(),
    configurable: true,
  });
}
