/** 条文チャンク（条・項単位）。環境が違ってもこの形は揃える。 */
export interface RagChunk {
  chunkKey: string;
  lawId: string;
  lawTitle: string;
  article: number;
  paragraph: number | null;
  heading: string | null;
  body: string;
}

export type RagReferenceKind = "refers" | "applies";

export interface RagReference {
  fromChunkKey: string;
  toLawId: string;
  toArticle: number;
  toChunkKey: string | null;
  kind: RagReferenceKind;
  rawText: string;
}

export interface RagDocumentSummary {
  lawId: string;
  title: string;
  fileName: string;
  objectKey: string;
  chunkCount: number;
}

export interface RetrievalHit {
  chunk: RagChunk;
  reason: "exact" | "keyword" | "hop";
  score: number;
  viaChunkKey?: string;
}

export interface RetrievalResult {
  query: string;
  hits: RetrievalHit[];
}

export interface Citation {
  chunkKey: string;
  lawTitle: string;
  article: number;
  heading: string | null;
  quote: string;
}

export interface RagAnswer {
  answer: string;
  abstained: boolean;
  citations: Citation[];
  hops: RetrievalHit[];
  provider: "extractive" | "bedrock";
}

export interface RagEvalCase {
  id: string;
  question: string;
  /** 必ず当たってほしいチャンクキー */
  expectedChunkKeys: string[];
  /** 1 hop で付いてほしいチャンクキー */
  expectedHopKeys?: string[];
  /** true なら根拠なしで棄権すること */
  abstain?: boolean;
}

export interface RagEvalCaseResult {
  id: string;
  question: string;
  passed: boolean;
  missingChunkKeys: string[];
  missingHopKeys: string[];
  unexpectedAnswer: boolean;
}

export interface RagEvalReport {
  passed: boolean;
  total: number;
  passedCount: number;
  results: RagEvalCaseResult[];
}
