import {
  DEFAULT_REALTIME_MODEL,
  HEALTH_ASSISTANT_INSTRUCTIONS,
  HEALTH_ASSISTANT_VOICE,
} from "./health-instructions";

/** OpenAI /v1/realtime/calls に渡す session オブジェクト */
export interface RealtimeSessionConfig {
  type: "realtime";
  model: string;
  instructions: string;
  output_modalities: Array<"audio" | "text">;
  audio: {
    input: {
      transcription: {
        model: string;
        language?: string;
      };
      turn_detection: {
        type: "server_vad";
        threshold: number;
        prefix_padding_ms: number;
        silence_duration_ms: number;
        create_response: boolean;
        interrupt_response: boolean;
      };
    };
    output: {
      voice: string;
    };
  };
}

/** 健康アシスタント用の Realtime session 設定を組み立てる */
export function buildHealthRealtimeSessionConfig(
  model = process.env.OPENAI_REALTIME_MODEL || DEFAULT_REALTIME_MODEL,
): RealtimeSessionConfig {
  return {
    type: "realtime",
    model,
    instructions: HEALTH_ASSISTANT_INSTRUCTIONS,
    output_modalities: ["audio"],
    audio: {
      input: {
        transcription: {
          model: "whisper-1",
          language: "ja",
        },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 700,
          create_response: true,
          interrupt_response: true,
        },
      },
      output: {
        voice: HEALTH_ASSISTANT_VOICE,
      },
    },
  };
}

export function isRealtimeConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
