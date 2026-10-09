import { replaceAllDatasets, saveDataset } from "./db";
import { isAcceptedExcelFileName, parseExcelBuffer } from "./excel";
import type { AnalysisDatasetSummary } from "./types";
import { toSummary } from "./types";

export type ImportResult =
  | {
      ok: true;
      dataset: AnalysisDatasetSummary;
      warnings: string[];
      /** 全件入れ替えで削除した既存データセット数（追加保存のときは 0） */
      replacedCount: number;
    }
  | {
      ok: false;
      status: number;
      error: string;
      detail?: string;
    };

/**
 * Excel ファイルをパースしてデータベースに保存する。
 * API ルートとテストの両方から利用する。
 */
export async function importExcelToDatabase(input: {
  fileName: string;
  buffer: ArrayBuffer | Buffer;
  name?: string;
  /** 取り込んだユーザー ID（監査用・任意） */
  createdBy?: string | null;
  /** true なら既存のデータセットを全て削除してから保存する */
  replaceAll?: boolean;
}): Promise<ImportResult> {
  if (!isAcceptedExcelFileName(input.fileName)) {
    return {
      ok: false,
      status: 400,
      error: "対応形式は .xlsx / .xls / .xlsm / .csv です",
    };
  }

  try {
    const parsed = parseExcelBuffer(input.buffer);
    if (parsed.rows.length === 0) {
      return {
        ok: false,
        status: 400,
        error:
          parsed.skippedTotalRows > 0
            ? "明細行がありません（合計行は除外されます）"
            : "データ行がありません",
      };
    }

    const name =
      input.name?.trim() || input.fileName.replace(/\.[^.]+$/, "");

    const saveInput = {
      name,
      fileName: input.fileName,
      parsed,
      createdBy: input.createdBy ?? null,
    };
    const { dataset, replacedCount } = input.replaceAll
      ? await replaceAllDatasets(saveInput)
      : { dataset: await saveDataset(saveInput), replacedCount: 0 };

    return {
      ok: true,
      dataset: toSummary(dataset),
      warnings: parsed.warnings,
      replacedCount,
    };
  } catch (e) {
    return {
      ok: false,
      status: 400,
      error: "Excel の取り込みに失敗しました",
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}
