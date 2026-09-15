import { NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/server";
import { listRagDocuments } from "@/lib/rag/db";
import { ingestOrdinancePdf, MAX_PDF_BYTES } from "@/lib/rag/ingest-pdf";

export const runtime = "nodejs";

export async function GET() {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  try {
    return NextResponse.json({ documents: await listRagDocuments() });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "文書一覧の取得に失敗しました", detail },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "multipart で送ってください" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file が必要です" }, { status: 400 });
  }
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "ファイルサイズは 15MB までです" }, { status: 400 });
  }

  const title = String(form.get("title") ?? "").trim() || undefined;
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const ingested = await ingestOrdinancePdf({
      fileName: file.name,
      buffer,
      title,
      uploadedBy: user.id,
    });
    return NextResponse.json({ ingested }, { status: 201 });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "PDF の取り込みに失敗しました", detail },
      { status: 400 },
    );
  }
}
