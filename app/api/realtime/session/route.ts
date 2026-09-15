import { NextResponse } from "next/server";
import {
  buildHealthRealtimeSessionConfig,
  isRealtimeConfigured,
} from "@/lib/realtime/session-config";

export const runtime = "nodejs";

const REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

/** キー設定有無を返す（UI の事前チェック用） */
export async function GET() {
  return NextResponse.json({ configured: isRealtimeConfigured() });
}

/**
 * WebRTC SDP offer を受け取り、OpenAI Realtime（unified interface）へ中継する。
 * Body: application/sdp（SDP offer テキスト）
 * Response: application/sdp（SDP answer）または JSON エラー
 */
export async function POST(req: Request) {
  if (!isRealtimeConfigured()) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY が未設定です。.env.local に設定してサーバーを再起動してください。",
      },
      { status: 503 },
    );
  }

  const sdpOffer = await req.text();
  if (!sdpOffer.trim()) {
    return NextResponse.json(
      { error: "SDP offer が空です" },
      { status: 400 },
    );
  }

  const sessionConfig = buildHealthRealtimeSessionConfig();
  const form = new FormData();
  form.set("sdp", sdpOffer);
  form.set("session", JSON.stringify(sessionConfig));

  try {
    const upstream = await fetch(REALTIME_CALLS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "OpenAI-Safety-Identifier": "training-template-health-voice",
      },
      body: form,
    });

    const bodyText = await upstream.text();

    if (!upstream.ok) {
      let detail = bodyText;
      try {
        const parsed = JSON.parse(bodyText) as {
          error?: { message?: string };
        };
        detail = parsed.error?.message || bodyText;
      } catch {
        /* keep raw */
      }
      return NextResponse.json(
        {
          error: "Realtime セッションの確立に失敗しました",
          detail,
        },
        { status: upstream.status >= 400 ? upstream.status : 502 },
      );
    }

    return new NextResponse(bodyText, {
      status: 200,
      headers: { "Content-Type": "application/sdp" },
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: "OpenAI Realtime API への接続に失敗しました", detail },
      { status: 502 },
    );
  }
}
