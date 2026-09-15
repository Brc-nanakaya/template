import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { datasetRows, datasets } from "@/lib/db/schema";
import { SALES_TABLE_NAME } from "./schema";
import {
  analysisDatasetSchema,
  type AnalysisDataset,
  type AnalysisDatasetSummary,
  type CellValue,
  type ParsedExcel,
} from "./types";

/**
 * データセットの永続化層（PostgreSQL + Drizzle）。
 *
 * 行データは `dataset_rows.values`（jsonb）に入れているため、
 * 取り込む Excel の列が増減してもマイグレーションは不要。
 * 列を固定のカラムに落とし込みたくなったら `lib/db/schema.ts` に
 * 専用テーブルを足して、ここから書き込みを増やすだけでよい。
 */

/** 1 回の INSERT に含める行数。パラメータ上限とメモリのバランスを取る */
const ROW_INSERT_CHUNK = 500;

function toSummaryRow(row: {
  id: string;
  name: string;
  fileName: string;
  sheetName: string;
  tableName: string | null;
  columns: string[];
  rowCount: number;
  createdAt: Date;
}): AnalysisDatasetSummary {
  return {
    id: row.id,
    name: row.name,
    fileName: row.fileName,
    sheetName: row.sheetName,
    tableName: row.tableName ?? undefined,
    columns: row.columns,
    rowCount: row.rowCount,
    createdAt: row.createdAt.toISOString(),
  };
}

/** 保存済みデータセット一覧（rows なし・新しい順） */
export async function listDatasets(): Promise<AnalysisDatasetSummary[]> {
  const rows = await getDb()
    .select({
      id: datasets.id,
      name: datasets.name,
      fileName: datasets.fileName,
      sheetName: datasets.sheetName,
      tableName: datasets.tableName,
      columns: datasets.columns,
      rowCount: datasets.rowCount,
      createdAt: datasets.createdAt,
    })
    .from(datasets)
    .orderBy(desc(datasets.createdAt), desc(datasets.id));

  return rows.map(toSummaryRow);
}

/** ID 指定でデータセットを取得（行データ込み）。存在しなければ null */
export async function getDataset(id: string): Promise<AnalysisDataset | null> {
  if (!isUuid(id)) return null;

  const found = await getDb()
    .select({
      id: datasets.id,
      name: datasets.name,
      fileName: datasets.fileName,
      sheetName: datasets.sheetName,
      tableName: datasets.tableName,
      columns: datasets.columns,
      rowCount: datasets.rowCount,
      createdAt: datasets.createdAt,
    })
    .from(datasets)
    .where(eq(datasets.id, id))
    .limit(1);

  const head = found[0];
  if (!head) return null;

  const rows = await getDb()
    .select({ id: datasetRows.id, values: datasetRows.values })
    .from(datasetRows)
    .where(eq(datasetRows.datasetId, id))
    .orderBy(asc(datasetRows.rowIndex));

  return {
    ...toSummaryRow(head),
    rows: rows.map((r) => ({ id: r.id, values: r.values })),
  };
}

export interface SaveDatasetInput {
  name: string;
  fileName: string;
  parsed: ParsedExcel;
  /** 取り込んだユーザー ID（任意） */
  createdBy?: string | null;
}

/** パース済み Excel をデータベースに保存する */
export async function saveDataset(
  input: SaveDatasetInput,
): Promise<AnalysisDataset> {
  const values = input.parsed.rows as Record<string, CellValue>[];

  // ヘッダーと行を 1 トランザクションで書く（途中で失敗しても中途半端に残らない）
  const dataset = await getDb().transaction(async (tx) => {
    const inserted = await tx
      .insert(datasets)
      .values({
        name: input.name.trim() || input.fileName,
        fileName: input.fileName,
        sheetName: input.parsed.sheetName,
        tableName: SALES_TABLE_NAME,
        columns: input.parsed.columns,
        rowCount: values.length,
        createdBy: input.createdBy ?? null,
      })
      .returning({
        id: datasets.id,
        name: datasets.name,
        fileName: datasets.fileName,
        sheetName: datasets.sheetName,
        tableName: datasets.tableName,
        columns: datasets.columns,
        rowCount: datasets.rowCount,
        createdAt: datasets.createdAt,
      });

    const head = inserted[0];
    if (!head) throw new Error("データセットの作成に失敗しました");

    const savedRows: { id: string; values: Record<string, CellValue> }[] = [];
    for (let i = 0; i < values.length; i += ROW_INSERT_CHUNK) {
      const chunk = values.slice(i, i + ROW_INSERT_CHUNK).map((v, j) => ({
        datasetId: head.id,
        rowIndex: i + j,
        values: v,
      }));
      const returned = await tx
        .insert(datasetRows)
        .values(chunk)
        .returning({ id: datasetRows.id, values: datasetRows.values });
      savedRows.push(...returned);
    }

    return { ...toSummaryRow(head), rows: savedRows };
  });

  // 保存後の形が想定どおりかを検証（UI / API が受け取る形の契約）
  return analysisDatasetSchema.parse(dataset);
}

/** データセットを削除する。dataset_rows は ON DELETE CASCADE で消える */
export async function deleteDataset(id: string): Promise<boolean> {
  if (!isUuid(id)) return false;

  const deleted = await getDb()
    .delete(datasets)
    .where(eq(datasets.id, id))
    .returning({ id: datasets.id });

  return deleted.length > 0;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** uuid 以外の ID で Postgres の型エラーを起こさないためのガード */
function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
