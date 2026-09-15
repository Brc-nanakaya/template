"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isAcceptedExcelFileName, parseExcelBuffer } from "@/lib/analysis/excel";
import type { ParsedExcel } from "@/lib/analysis/types";
import { cn } from "@/lib/utils";

export interface ExcelPreview {
  file: File;
  parsed: ParsedExcel;
}

interface ExcelUploaderProps {
  preview: ExcelPreview | null;
  busy?: boolean;
  onPreview: (preview: ExcelPreview | null) => void;
  onError: (message: string) => void;
}

export function ExcelUploader({
  preview,
  busy = false,
  onPreview,
  onError,
}: ExcelUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);

  async function handleFile(file: File | null | undefined) {
    if (!file) return;

    if (!isAcceptedExcelFileName(file.name)) {
      onError("対応形式は .xlsx / .xls / .xlsm / .csv です");
      return;
    }

    setParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseExcelBuffer(buffer);
      if (parsed.rows.length === 0) {
        onError(
          parsed.skippedTotalRows > 0
            ? "明細行がありません（合計行は除外されます）"
            : "データ行がありません",
        );
        onPreview(null);
        return;
      }
      onPreview({ file, parsed });
    } catch (e) {
      onError(e instanceof Error ? e.message : "ファイルの解析に失敗しました");
      onPreview(null);
    } finally {
      setParsing(false);
    }
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    void handleFile(file);
    e.target.value = "";
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (busy || parsing) return;
    void handleFile(e.dataTransfer.files?.[0]);
  }

  return (
    <div className="space-y-3" data-testid="excel-uploader">
      <div
        role="button"
        tabIndex={0}
        data-testid="excel-dropzone"
        onClick={() => !busy && !parsing && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!busy && !parsing) inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition",
          dragging
            ? "border-[#bc0017] bg-[#bc0017]/5"
            : "border-black/15 bg-[#fafafa] hover:border-[#bc0017]/50 hover:bg-white",
          (busy || parsing) && "pointer-events-none opacity-60",
        )}
      >
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#bc0017]/10 text-[#bc0017]">
          {preview ? (
            <FileSpreadsheet className="h-6 w-6" aria-hidden />
          ) : (
            <Upload className="h-6 w-6" aria-hidden />
          )}
        </span>
        <p className="mt-3 text-sm font-semibold text-[#050505]">
          {parsing
            ? "解析中…"
            : preview
              ? preview.file.name
              : "Excel ファイルをドラッグ＆ドロップ"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          またはクリックして選択（.xlsx / .xls / .xlsm / .csv）
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.xlsm,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          className="hidden"
          data-testid="excel-file-input"
          onChange={onInputChange}
          disabled={busy || parsing}
        />
      </div>

      {preview && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <p data-testid="excel-preview-meta">
            シート: {preview.parsed.sheetName} / カラム:{" "}
            {preview.parsed.columns.length} / 行: {preview.parsed.rows.length}
            {preview.parsed.skippedTotalRows > 0
              ? `（合計 ${preview.parsed.skippedTotalRows} 件除外）`
              : ""}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="excel-clear"
            disabled={busy}
            onClick={() => onPreview(null)}
          >
            クリア
          </Button>
        </div>
      )}
    </div>
  );
}
