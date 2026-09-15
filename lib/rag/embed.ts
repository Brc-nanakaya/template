import { createHash } from "node:crypto";
import { tokenize } from "./tokens";

export const LOCAL_EMBED_DIM = 256;

function charNgrams(text: string, n: number): string[] {
  const compact = text.replace(/\s+/g, "");
  const grams: string[] = [];
  for (let i = 0; i <= compact.length - n; i++) {
    grams.push(compact.slice(i, i + n));
  }
  return grams;
}

function bucket(token: string): number {
  const hex = createHash("sha256").update(token).digest();
  return hex.readUInt16BE(0) % LOCAL_EMBED_DIM;
}

function l2normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

/**
 * ローカル用の埋め込み。API キー不要。
 * 後で OpenAI / Bedrock に差し替えてもチャンクの持ち方は同じ。
 */
export function embedLocal(text: string): number[] {
  const vec = new Array<number>(LOCAL_EMBED_DIM).fill(0);
  const tokens = [
    ...tokenize(text),
    ...charNgrams(text, 2),
    ...charNgrams(text, 3),
  ];
  for (const t of tokens) {
    vec[bucket(t)] += 1;
  }
  return l2normalize(vec);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += (a[i] ?? 0) * (b[i] ?? 0);
  return dot;
}
