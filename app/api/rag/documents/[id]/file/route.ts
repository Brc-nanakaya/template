import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { getRagDocument } from "@/lib/rag/db";
import { getBinary } from "@/lib/rag/storage";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const doc = await getRagDocument(params.id);
  if (!doc) {
    return NextResponse.json({ error: "文書が見つかりません" }, { status: 404 });
  }

  const body = await getBinary(doc.objectKey);
  if (!body) {
    return NextResponse.json({ error: "ファイルが見つかりません" }, { status: 404 });
  }

  const type =
    doc.sourceType === "pdf" || doc.fileName.toLowerCase().endsWith(".pdf")
      ? "application/pdf"
      : "text/plain; charset=utf-8";
  const encoded = encodeURIComponent(doc.fileName);

  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": type,
      "Content-Disposition": `inline; filename*=UTF-8''${encoded}`,
    },
  });
}
