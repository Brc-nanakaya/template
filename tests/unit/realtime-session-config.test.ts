import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  HEALTH_ASSISTANT_INSTRUCTIONS,
  HEALTH_ASSISTANT_VOICE,
} from "@/lib/realtime/health-instructions";
import {
  buildHealthRealtimeSessionConfig,
  isRealtimeConfigured,
} from "@/lib/realtime/session-config";

describe("buildHealthRealtimeSessionConfig", () => {
  const prevModel = process.env.OPENAI_REALTIME_MODEL;
  const prevKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    if (prevModel === undefined) delete process.env.OPENAI_REALTIME_MODEL;
    else process.env.OPENAI_REALTIME_MODEL = prevModel;
    if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevKey;
  });

  it("健康アシスタント向けの session 設定を返す", () => {
    delete process.env.OPENAI_REALTIME_MODEL;
    const config = buildHealthRealtimeSessionConfig();
    expect(config.type).toBe("realtime");
    expect(config.model).toBe("gpt-realtime");
    expect(config.instructions).toBe(HEALTH_ASSISTANT_INSTRUCTIONS);
    expect(config.audio.output.voice).toBe(HEALTH_ASSISTANT_VOICE);
    expect(config.audio.input.turn_detection.type).toBe("server_vad");
    expect(config.audio.input.transcription.language).toBe("ja");
    expect(config.output_modalities).toContain("audio");
  });

  it("OPENAI_REALTIME_MODEL でモデルを上書きできる", () => {
    process.env.OPENAI_REALTIME_MODEL = "gpt-realtime-2.1";
    const config = buildHealthRealtimeSessionConfig();
    expect(config.model).toBe("gpt-realtime-2.1");
  });
});

describe("isRealtimeConfigured", () => {
  const prevKey = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    if (prevKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevKey;
  });

  it("キー未設定なら false", () => {
    expect(isRealtimeConfigured()).toBe(false);
  });

  it("キー設定済みなら true", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    expect(isRealtimeConfigured()).toBe(true);
  });
});
