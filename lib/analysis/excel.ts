import * as XLSX from "xlsx";
import {
  ANALYSIS_COLUMNS,
  definedColumnKeys,
  hasDefinedColumns,
  mapHeaderToKey,
} from "./schema";
import {
  coerceDate,
  findHeaderRowIndex,
  headerMatchCount,
  isExcludedRow,
  isTotalRow,
  normalizeSalesRow,
  pickSheetName,
} from "./sales";
import type { CellValue, ParsedExcel } from "./types";

const ACCEPTED_EXTENSIONS = [".xlsx", ".xls", ".xlsm", ".csv"];

export function isAcceptedExcelFileName(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function normalizeHeader(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function toCellValue(value: unknown): CellValue {
  if (value == null || value === "") return null;
  if (value instanceof Date) return coerceDate(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim();
  return String(value);
}

function sheetToMatrix(
  sheet: XLSX.WorkSheet,
): (string | number | boolean | Date | null)[][] {
  return XLSX.utils.sheet_to_json<
    (string | number | boolean | Date | null)[]
  >(sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  });
}

function peekHeaderHits(sheet: XLSX.WorkSheet): number {
  const matrix = sheetToMatrix(sheet);
  const headerIndex = findHeaderRowIndex(matrix);
  return headerMatchCount(matrix[headerIndex] ?? []);
}

function readWorkbook(buffer: ArrayBuffer | Buffer): XLSX.WorkBook {
  const type =
    typeof Buffer !== "undefined" && Buffer.isBuffer(buffer) ? "buffer" : "array";
  return XLSX.read(buffer, { type, cellDates: true });
}

/**
 * Excel / CSV バイナリをパースする。
 * 売上データシートを選び、合計行を除外して sales_data のカラムへ正規化する。
 */
export function parseExcelBuffer(
  buffer: ArrayBuffer | Buffer,
  options?: { sheetIndex?: number },
): ParsedExcel {
  const workbook = readWorkbook(buffer);
  const warnings: string[] = [];

  let sheetName: string | undefined;
  if (options?.sheetIndex != null) {
    sheetName = workbook.SheetNames[options.sheetIndex];
  } else {
    const picked = pickSheetName(workbook.SheetNames, (name) => {
      const sheet = workbook.Sheets[name];
      return sheet ? peekHeaderHits(sheet) : 0;
    });
    sheetName = picked.sheetName;
    if (picked.skippedSummarySheets.length > 0) {
      warnings.push(
        `月次サマリーシートは取り込み対象外です: ${picked.skippedSummarySheets.join(", ")}`,
      );
    }
  }

  if (!sheetName) {
    throw new Error("シートが見つかりません");
  }

  const sheet = workbook.Sheets[sheetName];
  const matrix = sheetToMatrix(sheet);

  if (matrix.length === 0) {
    throw new Error("シートにデータがありません");
  }

  const headerRowIndex = findHeaderRowIndex(matrix);
  const headerRow = matrix[headerRowIndex] ?? [];
  const rawColumns = headerRow.map(normalizeHeader);

  const mappedKeys = rawColumns.map((h) => mapHeaderToKey(h));
  const excelColumns = rawColumns.map((h, i) => mappedKeys[i] ?? (h || `col_${i + 1}`));

  const seen = new Map<string, number>();
  const columns = excelColumns.map((name) => {
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    return count === 0 ? name : `${name}_${count + 1}`;
  });

  if (hasDefinedColumns()) {
    const defined = definedColumnKeys();
    const missingRequired = ANALYSIS_COLUMNS.filter(
      (c) => c.required && !columns.includes(c.key),
    );
    if (missingRequired.length > 0) {
      throw new Error(
        `必須カラムが不足しています: ${missingRequired.map((c) => c.label).join(", ")}`,
      );
    }
    const unknown = columns.filter((c) => !defined.includes(c));
    if (unknown.length > 0) {
      warnings.push(`未定義のカラムを無視します: ${unknown.join(", ")}`);
    }
  }

  const activeColumns = hasDefinedColumns()
    ? definedColumnKeys()
    : columns;

  if (activeColumns.length === 0) {
    throw new Error("有効なカラムがありません");
  }

  const rows: Record<string, CellValue>[] = [];
  let skippedTotalRows = 0;
  let skippedInvalidRows = 0;

  for (let r = headerRowIndex + 1; r < matrix.length; r++) {
    const line = matrix[r] ?? [];
    const excelRowNumber = r + 1;

    if (isExcludedRow(line)) {
      if (isTotalRow(line)) skippedTotalRows += 1;
      continue;
    }

    const rawValues: Record<string, CellValue> = {};
    let hasAny = false;

    for (let c = 0; c < columns.length; c++) {
      const key = columns[c];
      if (hasDefinedColumns() && !definedColumnKeys().includes(key)) continue;
      const cell = toCellValue(line[c]);
      rawValues[key] = cell;
      if (cell !== null) hasAny = true;
    }

    if (!hasAny) continue;

    if (hasDefinedColumns()) {
      const normalized = normalizeSalesRow(rawValues, excelRowNumber);
      if (!normalized) {
        skippedInvalidRows += 1;
        continue;
      }
      rows.push({ ...normalized.values });
      warnings.push(...normalized.warnings);
      continue;
    }

    rows.push(rawValues);
  }

  if (skippedTotalRows > 0) {
    warnings.unshift(`合計行を ${skippedTotalRows} 件除外しました`);
  }
  if (skippedInvalidRows > 0) {
    warnings.push(
      `必須項目が不足している行を ${skippedInvalidRows} 件スキップしました`,
    );
  }

  return {
    sheetName,
    columns: activeColumns,
    rows,
    warnings,
    skippedTotalRows,
  };
}
