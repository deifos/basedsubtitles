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
    progress_callback?: (progress: { status?: string; data?: unknown; loaded?: number; total?: number; progress?: number }) => void,
    device: DeviceType = "webgpu"
  ): Promise<AutomaticSpeechRecognitionPipeline> {
    const modelId = MODEL_IDS[modelSize];

    // If model changed, reset instance
    if (this.currentModelId && this.currentModelId !== modelId) {
      this.resetInstance();
    }

    if (!this.instance) {
      this.currentModelId = modelId;
      // @ts-expect-error - Transformers.js pipeline types produce complex union that TS cannot resolve
      this.instance = pipeline(
        "automatic-speech-recognition",
        modelId,
        {
          ...PER_DEVICE_CONFIG[device],
          ...(progress_callback && { progress_callback }),
        }
      );
    }
    return this.instance;
  }
}

let activeDevice: DeviceType | null = null;
let activeModelSize: ModelSize | null = null;
let loadPromise: Promise<void> | null = null;
type TranscriptionResult = Awaited<ReturnType<AutomaticSpeechRecognitionPipeline>>;

let transcriptionPromise: Promise<TranscriptionResult> | null = null;

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
async function handleLoad({ device = "wasm", modelSize = "base" as ModelSize }: { device?: DeviceType; modelSize?: ModelSize }) {
  if (!loadPromise || device !== activeDevice || modelSize !== activeModelSize) {
    if (transcriptionPromise) {
      try {
        await transcriptionPromise;
      } catch {
        // Ignore errors from in-flight transcription while switching devices
      }
      transcriptionPromise = null;
    }

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
          device
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
    transcriptionPromise = null;
    self.postMessage({
      status: "error",
      data: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}

// Handle transcription requests - optimized like sample app
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
    const transcriber = await PipelineSingleton.getInstance(targetModelSize, undefined, targetDevice);

    if (transcriptionPromise) {
      await transcriptionPromise;
    }

    const start = performance.now();

    // Use same settings as sample app for better performance
    transcriptionPromise = transcriber(audio, {
      language,
      return_timestamps: "word",
      chunk_length_s: 30,
    });

    const result = await transcriptionPromise;

    const end = performance.now();

    self.postMessage({
      status: "complete",
      result,
      time: end - start,
    });
  } catch (error) {
    console.error("Worker: Error in transcription:", error);
    PipelineSingleton.resetInstance();
    activeDevice = null;
    loadPromise = null;
    transcriptionPromise = null;
    self.postMessage({
      status: "error",
      data: error instanceof Error ? error.message : "Unknown error occurred",
    });
  } finally {
    transcriptionPromise = null;
  }
}
