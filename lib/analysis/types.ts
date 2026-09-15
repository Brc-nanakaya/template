import { z } from "zod";

/** Excel / DB に格納するセル値 */
export type CellValue = string | number | boolean | null;

export const cellValueSchema: z.ZodType<CellValue> = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const analysisRowSchema = z.object({
  id: z.string().min(1),
  values: z.record(z.string(), cellValueSchema),
});

export type AnalysisRow = z.infer<typeof analysisRowSchema>;

export const analysisDatasetSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  fileName: z.string().min(1),
  sheetName: z.string().min(1),
  tableName: z.string().min(1).optional(),
  columns: z.array(z.string()),
  rowCount: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
  rows: z.array(analysisRowSchema),
});

export type AnalysisDataset = z.infer<typeof analysisDatasetSchema>;

/** 一覧表示用（rows を含まない） */
export type AnalysisDatasetSummary = Omit<AnalysisDataset, "rows">;

export function toSummary(dataset: AnalysisDataset): AnalysisDatasetSummary {
  const { rows: _rows, ...summary } = dataset;
  return summary;
}

/** Excel パース結果（保存前） */
export interface ParsedExcel {
  sheetName: string;
  columns: string[];
  rows: Record<string, CellValue>[];
  warnings: string[];
  /** 合計行として除外した件数 */
  skippedTotalRows: number;
}
