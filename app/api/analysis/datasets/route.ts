import { NextResponse } from "next/server";
import { listDatasets } from "@/lib/analysis/db";
import { importExcelToDatabase } from "@/lib/analysis/import";
import { getApiUser } from "@/lib/auth/server";

export const runtime = "nodejs";

/** 保存済みデータセット一覧 */
export async function GET() {
  // middleware は Cookie の有無しか見ないため、ここで実際の検証を行う
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const datasets = await listDatasets();
    return NextResponse.json({ datasets });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "データセット一覧の取得に失敗しました", detail },
      { status: 500 },
    );
  }
}

/**
 * Excel を取り込んでデータベースに保存する。
 * multipart/form-data: file (必須), name (任意)
 */
export async function POST(req: Request) {
  const user = await getApiUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "file フィールドが必要です" },
      { status: 400 },
    );
  }

  const nameField = form.get("name");
  const name =
    typeof nameField === "string" && nameField.trim()
      ? nameField.trim()
      : undefined;

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await importExcelToDatabase({
    fileName: file.name,
    buffer,
    name,
    createdBy: user.id,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, detail: result.detail },
      { status: result.status },
    );
  }

  return NextResponse.json(
    { dataset: result.dataset, warnings: result.warnings },
    { status: 201 },
  );
}
