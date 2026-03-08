import {
  pipeline,
  AutomaticSpeechRecognitionPipeline,
} from "@huggingface/transformers";

type DeviceType = "webgpu" | "wasm";
export type ModelSize = "tiny" | "base" | "small";

const MODEL_IDS: Record<ModelSize, string> = {
  tiny: "onnx-community/whisper-tiny_timestamped",
  base: "onnx-community/whisper-base_timestamped",
  small: "onnx-community/whisper-small_timestamped",
};

// Device configurations optimized as sample app
const PER_DEVICE_CONFIG = {
  webgpu: {
    dtype: {
      encoder_model: "fp32" as const,
      decoder_model_merged: "q4" as const,
    },
    device: "webgpu" as const,
  },
  wasm: {
    dtype: "q8" as const,
    device: "wasm" as const,
  },
};

/**
 * Simplified singleton pattern like the sample app
 */
class PipelineSingleton {
  static currentModelId: string | null = null;
  static instance: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

  static resetInstance(): void {
    this.instance = null;
    this.currentModelId = null;
  }

  static async getInstance(
    modelSize: ModelSize = "base",
    progress_callback?: (progress: {
      status?: string;
      data?: unknown;
      loaded?: number;
      total?: number;
      progress?: number;
    }) => void,
    device: DeviceType = "webgpu",
  ): Promise<AutomaticSpeechRecognitionPipeline> {
    const modelId = MODEL_IDS[modelSize];

    // If model changed, reset instance
    if (this.currentModelId && this.currentModelId !== modelId) {
      this.resetInstance();
    }

    if (!this.instance) {
      this.currentModelId = modelId;
      // @ts-expect-error - Transformers.js pipeline types produce complex union that TS cannot resolve
      this.instance = pipeline("automatic-speech-recognition", modelId, {
        ...PER_DEVICE_CONFIG[device],
        ...(progress_callback && { progress_callback }),
      });
    }
    return this.instance;
  }
}

let activeDevice: DeviceType | null = null;
let activeModelSize: ModelSize | null = null;
let loadPromise: Promise<void> | null = null;

// Handle messages from the main thread - simplified like sample app
self.addEventListener("message", async (e: MessageEvent) => {
  const { type, data } = e.data;

  switch (type) {
    case "load":
      await handleLoad(data);
      break;

    case "run":
      await handleRun(data);
      break;

    default:
      console.error(`Unknown message type: ${type}`);
  }
});

// Handle model loading - simplified like sample app
async function handleLoad({
  device = "wasm",
  modelSize = "base" as ModelSize,
}: {
  device?: DeviceType;
  modelSize?: ModelSize;
}) {
  if (
    !loadPromise ||
    device !== activeDevice ||
    modelSize !== activeModelSize
  ) {
    if (device !== activeDevice || modelSize !== activeModelSize) {
      PipelineSingleton.resetInstance();
      loadPromise = null;
    }

    self.postMessage({
      status: "loading",
      data: `Loading ${modelSize} model (${device})...`,
    });

    loadPromise = (async () => {
      try {
        const transcriber = await PipelineSingleton.getInstance(
          modelSize,
          (progressInfo) => {
            self.postMessage(progressInfo);
          },
          device,
        );

        activeDevice = device;
        activeModelSize = modelSize;

        if (device === "webgpu") {
          self.postMessage({
            status: "loading",
            data: "Compiling shaders and warming up model...",
          });

          await transcriber(new Float32Array(16_000), {
            language: "en",
          });
        }
      } catch (error) {
        PipelineSingleton.resetInstance();
        activeDevice = null;
        activeModelSize = null;
        throw error;
      }
    })();
  }

  try {
    await loadPromise;
    self.postMessage({ status: "ready" });
  } catch (error) {
    console.error("Worker: Error loading model:", error);
    loadPromise = null;
    self.postMessage({
      status: "error",
      data: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}

// Handle transcription requests.
//
// Instead of calling the high-level pipeline (which processes all chunks then
// merges at the end with no intermediate results), we replicate _call_whisper's
// internal loop from the library source and call _decode_asr after every chunk.
// This gives streaming partial results with accuracy identical to the single
// full pipeline call, because we use the same chunking math and merge logic.
async function handleRun({
  audio,
  language = "en",
  device,
  modelSize,
}: {
  audio: Float32Array;
  language?: string;
  device?: DeviceType;
  modelSize?: ModelSize;
}) {
  try {
    if (loadPromise) {
      await loadPromise;
    }

    const targetDevice = device ?? activeDevice ?? "wasm";
    const targetModelSize = modelSize ?? activeModelSize ?? "base";
    const transcriber = await PipelineSingleton.getInstance(
      targetModelSize,
      undefined,
      targetDevice,
    );

    // Access the pipeline's internal components (same as _call_whisper uses)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = transcriber as any;
    const proc = p.processor;
    const model = p.model;
    const tokenizer = p.tokenizer;

    const sampling_rate: number = proc.feature_extractor.config.sampling_rate;
    const hop_length: number = proc.feature_extractor.config.hop_length;
    const time_precision: number =
      proc.feature_extractor.config.chunk_length /
      model.config.max_source_positions;

    // Match the library's default chunk/stride settings
    const CHUNK_S = 30;
    const STRIDE_S = 5;
    const window_samples = sampling_rate * CHUNK_S;
    const stride_samples = sampling_rate * STRIDE_S;
    const jump_samples = window_samples - 2 * stride_samples; // 20s step

    // Generation config:
    //   return_timestamps: true  → model generates timestamp tokens in the output,
    //                              which _decode_asr needs for proper stride-aware
    //                              chunk merging (skipping left/right stride regions).
    //   return_token_timestamps: true → model also returns per-token timestamps via
    //                              its alignment head, used by _decode_asr("word")
    //                              to produce word-level output.
    // Combining both matches the sample app's approach while giving word timestamps.
    const generation_config: Record<string, unknown> = {
      language,
      return_timestamps: true,
      return_token_timestamps: true,
      force_full_sequences: false,
    };

    const start = performance.now();

    // Build chunk list (feature extraction for each 30s window)
    type Chunk = {
      stride: number[]; // [length_samples, left_stride_samples, right_stride_samples]
      input_features: unknown;
      is_last: boolean;
      tokens?: bigint[];
      token_timestamps?: number[];
    };
    const chunks: Chunk[] = [];
    let offset = 0;
    while (true) {
      const offset_end = offset + window_samples;
      const subarr = audio.subarray(offset, offset_end);
      const feature = await proc(subarr);
      const is_first = offset === 0;
      const is_last = offset_end >= audio.length;
      chunks.push({
        stride: [
          subarr.length,
          is_first ? 0 : stride_samples,
          is_last ? 0 : stride_samples,
        ],
        input_features: feature.input_features,
        is_last,
      });
      if (is_last) break;
      offset += jump_samples;
    }

    // Run model.generate() per chunk, streaming _decode_asr results after each one.
    // This is identical to _call_whisper's loop, just with an intermediate decode.
    const processed: Chunk[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      const data = await model.generate({
        inputs: chunk.input_features,
        ...generation_config,
        num_frames: Math.floor(chunk.stride[0] / hop_length),
      });

      chunk.tokens = data.sequences.tolist()[0] as bigint[];
      chunk.token_timestamps = (
        data.token_timestamps.tolist()[0] as number[]
      ).map((x: number) => Math.round(x * 100) / 100);

      // Convert stride from samples → seconds (required by _decode_asr)
      chunk.stride = chunk.stride.map((x) => x / sampling_rate);

      processed.push(chunk);

      // Merge all chunks processed so far — same call the library makes at the end
      const [partialText, partialOptional] = tokenizer._decode_asr(processed, {
        time_precision,
        return_timestamps: "word",
        force_full_sequences: false,
      }) as [
        string,
        { chunks?: Array<{ text: string; timestamp: [number, number] }> },
      ];

      self.postMessage({
        status: "update",
        result: {
          text: partialText,
          chunks: partialOptional.chunks ?? [],
        },
        progress: 60 + Math.round(((i + 1) / chunks.length) * 39),
      });
    }

    const end = performance.now();

    // The last update already has the final result, but re-run for the complete message
    const [fullText, fullOptional] = tokenizer._decode_asr(processed, {
      time_precision,
      return_timestamps: "word",
      force_full_sequences: false,
    }) as [
      string,
      { chunks?: Array<{ text: string; timestamp: [number, number] }> },
    ];

    self.postMessage({
      status: "complete",
      result: { text: fullText, chunks: fullOptional.chunks ?? [] },
      time: end - start,
    });
  } catch (error) {
    console.error("Worker: Error in transcription:", error);
    PipelineSingleton.resetInstance();
    activeDevice = null;
    loadPromise = null;
    self.postMessage({
      status: "error",
      data: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}
