import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { CellValue } from "@/lib/analysis/types";

/**
 * アプリ全体のテーブル定義（Drizzle スキーマ）。
 * ここを編集して `npm run db:generate` → `npm run db:migrate` でスキーマを更新する。
 */

/** ユーザー権限。admin はデータセットの削除やユーザー管理まで行える */
export const userRoleEnum = pgEnum("user_role", ["admin", "member"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** ログイン ID。メールアドレス形式に限定せず小文字で正規化して保存する */
    loginId: text("login_id").notNull(),
    name: text("name").notNull(),
    /** scrypt ハッシュ（`lib/auth/password.ts` 形式: scrypt$N$r$p$salt$hash） */
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    loginIdUnique: uniqueIndex("users_login_id_unique").on(t.loginId),
  }),
);

export const sessions = pgTable(
  "sessions",
  {
    /**
     * Cookie に入る生トークンの SHA-256 ハッシュ。
     * DB が漏れてもトークンそのものは復元できない。
     */
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdIdx: index("sessions_user_id_idx").on(t.userId),
    expiresAtIdx: index("sessions_expires_at_idx").on(t.expiresAt),
  }),
);

export const datasets = pgTable(
  "datasets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    fileName: text("file_name").notNull(),
    sheetName: text("sheet_name").notNull(),
    /** 論理テーブル名（`lib/analysis/schema.ts` の SALES_TABLE_NAME） */
    tableName: text("table_name"),
    /** 列キーの並び順 */
    columns: jsonb("columns").$type<string[]>().notNull(),
    rowCount: integer("row_count").notNull().default(0),
    /** 取り込んだユーザー。ユーザー削除後もデータセットは残す */
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    createdAtIdx: index("datasets_created_at_idx").on(t.createdAt),
  }),
);

export const datasetRows = pgTable(
  "dataset_rows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    /** 取り込み時の行順を保持する */
    rowIndex: integer("row_index").notNull(),
    /** 1 行分のセル値。列を増減してもマイグレーション不要にするため jsonb */
    values: jsonb("values").$type<Record<string, CellValue>>().notNull(),
  },
  (t) => ({
    datasetRowIdx: index("dataset_rows_dataset_id_row_index_idx").on(
      t.datasetId,
      t.rowIndex,
    ),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  datasets: many(datasets),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const datasetsRelations = relations(datasets, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [datasets.createdBy],
    references: [users.id],
  }),
  rows: many(datasetRows),
}));

export const datasetRowsRelations = relations(datasetRows, ({ one }) => ({
  dataset: one(datasets, {
    fields: [datasetRows.datasetId],
    references: [datasets.id],
  }),
}));

/** 条文間の関係。本文は持たず、条どうしの辺だけを残す */
export const ragReferenceKindEnum = pgEnum("rag_reference_kind", [
  "refers",
  "applies",
]);

export const ragDocuments = pgTable(
  "rag_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** 法令・規程の安定 ID（例: demo-internal-control） */
    lawId: text("law_id").notNull(),
    title: text("title").notNull(),
    fileName: text("file_name").notNull(),
    /** S3 / MinIO / ローカル FS 上のオブジェクトキー */
    objectKey: text("object_key").notNull(),
    sourceType: text("source_type").notNull().default("text"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    lawIdUnique: uniqueIndex("rag_documents_law_id_unique").on(t.lawId),
  }),
);

export const ragChunks = pgTable(
  "rag_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => ragDocuments.id, { onDelete: "cascade" }),
    lawId: text("law_id").notNull(),
    article: integer("article").notNull(),
    paragraph: integer("paragraph"),
    /** `lawId:article` または `lawId:article:paragraph` */
    chunkKey: text("chunk_key").notNull(),
    heading: text("heading"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    chunkKeyUnique: uniqueIndex("rag_chunks_chunk_key_unique").on(t.chunkKey),
    lawArticleIdx: index("rag_chunks_law_id_article_idx").on(
      t.lawId,
      t.article,
    ),
  }),
);

export const ragReferences = pgTable(
  "rag_references",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromChunkId: uuid("from_chunk_id")
      .notNull()
      .references(() => ragChunks.id, { onDelete: "cascade" }),
    toLawId: text("to_law_id").notNull(),
    toArticle: integer("to_article").notNull(),
    toChunkId: uuid("to_chunk_id").references(() => ragChunks.id, {
      onDelete: "set null",
    }),
    kind: ragReferenceKindEnum("kind").notNull(),
    rawText: text("raw_text").notNull(),
  },
  (t) => ({
    fromIdx: index("rag_references_from_chunk_id_idx").on(t.fromChunkId),
    toIdx: index("rag_references_to_law_article_idx").on(t.toLawId, t.toArticle),
  }),
);

export const ragDocumentsRelations = relations(ragDocuments, ({ many }) => ({
  chunks: many(ragChunks),
}));

export const ragChunksRelations = relations(ragChunks, ({ one, many }) => ({
  document: one(ragDocuments, {
    fields: [ragChunks.documentId],
    references: [ragDocuments.id],
  }),
  outgoing: many(ragReferences, { relationName: "rag_ref_from" }),
  incoming: many(ragReferences, { relationName: "rag_ref_to" }),
}));

export const ragReferencesRelations = relations(ragReferences, ({ one }) => ({
  fromChunk: one(ragChunks, {
    fields: [ragReferences.fromChunkId],
    references: [ragChunks.id],
    relationName: "rag_ref_from",
  }),
  toChunk: one(ragChunks, {
    fields: [ragReferences.toChunkId],
    references: [ragChunks.id],
    relationName: "rag_ref_to",
  }),
}));

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type SessionRow = typeof sessions.$inferSelect;
export type DatasetRecord = typeof datasets.$inferSelect;
export type DatasetRowRecord = typeof datasetRows.$inferSelect;
export type RagDocumentRecord = typeof ragDocuments.$inferSelect;
export type RagChunkRecord = typeof ragChunks.$inferSelect;
export type RagReferenceRecord = typeof ragReferences.$inferSelect;
