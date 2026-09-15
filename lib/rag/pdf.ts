export interface PdfPage {
  page: number;
  text: string;
}

export interface ExtractedPdf {
  title: string | null;
  pageCount: number;
  pages: PdfPage[];
  fullText: string;
}

/**
 * 区の条例 PDF からページ単位のテキストを取り出す。
 */
export async function extractPdf(buffer: Buffer): Promise<ExtractedPdf> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const extracted = await extractText(pdf, { mergePages: false });
  const raw = extracted.text;
  const texts = Array.isArray(raw) ? raw : [raw];
  const pages = texts.map((text, i) => ({
    page: i + 1,
    text: (text ?? "").replace(/\r\n/g, "\n").trim(),
  }));
  const fullText = pages.map((p) => p.text).join("\n");
  const titleFromBody = guessTitle(fullText);
  return {
    title: titleFromBody,
    pageCount: pages.length,
    pages,
    fullText,
  };
}

export function guessTitle(text: string): string | null {
  const line = text
    .split("\n")
    .map((l) => l.trim())
    .find((l) => /条例|規程|規則/.test(l) && l.length < 80);
  return line ?? null;
}

export function isPdfFileName(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(".pdf");
}
