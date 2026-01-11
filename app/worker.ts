import {
  pipeline,
  AutomaticSpeechRecognitionPipeline,
} from "@huggingface/transformers";

type DeviceType = "webgpu" | "wasm";

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
  static model_id = "onnx-community/whisper-base_timestamped";
  static instance: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

  static resetInstance(): void {
    this.instance = null;
  }

  static async getInstance(
    progress_callback?: (progress: { status?: string; data?: unknown; loaded?: number; total?: number; progress?: number }) => void,
    device: DeviceType = "webgpu"
  ): Promise<AutomaticSpeechRecognitionPipeline> {
    if (!this.instance) {
      // @ts-expect-error - Transformers.js pipeline types produce complex union that TS cannot resolve
      this.instance = pipeline(
        "automatic-speech-recognition",
        this.model_id,
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
async function handleLoad({ device = "wasm" }: { device?: DeviceType }) {
  if (!loadPromise || device !== activeDevice) {
    if (transcriptionPromise) {
      try {
        await transcriptionPromise;
      } catch {
        // Ignore errors from in-flight transcription while switching devices
      }
      transcriptionPromise = null;
    }

    if (device !== activeDevice) {
      PipelineSingleton.resetInstance();
      loadPromise = null;
    }

    self.postMessage({
      status: "loading",
      data: `Loading model (${device})...`,
    });

    loadPromise = (async () => {
      try {
        const transcriber = await PipelineSingleton.getInstance(
          (progressInfo) => {
            self.postMessage(progressInfo);
          },
          device
        );

        activeDevice = device;

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
}: {
  audio: Float32Array;
  language?: string;
  device?: DeviceType;
}) {
  try {
    if (loadPromise) {
      await loadPromise;
    }

    const targetDevice = device ?? activeDevice ?? "wasm";
    const transcriber = await PipelineSingleton.getInstance(undefined, targetDevice);

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
