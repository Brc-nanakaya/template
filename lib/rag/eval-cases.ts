import type { RagEvalCase } from "./types";

/** 制度確認用の固定セット。スタックを変えても同じケースで再実行する。 */
export const RAG_EVAL_CASES: RagEvalCase[] = [
  {
    id: "director-duty",
    question: "取締役は内部統制について誰が責任を負う？",
    expectedChunkKeys: ["demo-internal-control:4"],
  },
  {
    id: "audit-applies",
    question: "内部監査の手続は何を準用する？",
    expectedChunkKeys: ["demo-internal-control:5"],
    expectedHopKeys: ["demo-internal-control:4"],
  },
  {
    id: "retention-years",
    question: "内部統制の記録は何年保存しなければならない？",
    expectedChunkKeys: ["demo-internal-control:6"],
  },
  {
    id: "cross-law-retention",
    question: "機密情報の保存期間は？",
    expectedChunkKeys: ["demo-info-policy:3"],
    expectedHopKeys: ["demo-internal-control:6"],
  },
  {
    id: "unknown",
    question: "宇宙旅行の許可条件は何年ですか？",
    expectedChunkKeys: [],
    abstain: true,
  },
];
