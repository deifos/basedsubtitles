import { pipeline, RawImage } from "@huggingface/transformers";

type DeviceType = "webgpu" | "wasm";

/**
 * Singleton for the background-removal pipeline (MODNet via Xenova/modnet).
 * Follows the same pattern as the ASR worker in app/worker.ts.
 */
class PipelineSingleton {
  static model_id = "Xenova/modnet";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static instance: Promise<any> | null = null;

  static resetInstance(): void {
    this.instance = null;
  }

  static async getInstance(
    progress_callback?: (progress: {
      status?: string;
      data?: unknown;
      loaded?: number;
      total?: number;
      progress?: number;
    }) => void,
    device: DeviceType = "webgpu"
  ) {
    if (!this.instance) {
      this.instance = pipeline("background-removal", this.model_id, {
        device,
        dtype: "fp32" as const,
        ...(progress_callback && { progress_callback }),
      });
    }
    return this.instance;
  }
}

let activeDevice: DeviceType | null = null;
let loadPromise: Promise<void> | null = null;

self.addEventListener("message", async (e: MessageEvent) => {
  const { type, data } = e.data;

  switch (type) {
    case "load":
      await handleLoad(data ?? {});
      break;

    case "process-frame":
      await handleProcessFrame(data);
      break;

    default:
      console.error(`[bg-removal-worker] Unknown message type: ${type}`);
  }
});

async function handleLoad({ device = "webgpu" }: { device?: DeviceType }) {
  if (!loadPromise || device !== activeDevice) {
    if (device !== activeDevice) {
      PipelineSingleton.resetInstance();
      loadPromise = null;
    }

    self.postMessage({
      status: "loading",
      data: `Loading background removal model (${device})...`,
    });

    loadPromise = (async () => {
      try {
        const pipe = await PipelineSingleton.getInstance(
          (progressInfo) => {
            self.postMessage(progressInfo);
          },
          device
        );

        activeDevice = device;

        // Set the feature extractor size for efficient processing
        if (pipe.processor?.feature_extractor?.size) {
          pipe.processor.feature_extractor.size = { shortest_edge: 256 };
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
    console.error("[bg-removal-worker] Error loading model:", error);
    loadPromise = null;
    self.postMessage({
      status: "error",
      data: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
}

async function handleProcessFrame({
  imageData,
  width,
  height,
  frameIndex,
}: {
  imageData: Uint8ClampedArray;
  width: number;
  height: number;
  frameIndex: number;
}) {
  try {
    if (loadPromise) {
      await loadPromise;
    }

    const pipe = await PipelineSingleton.getInstance(
      undefined,
      activeDevice ?? "webgpu"
    );

    // Create RawImage from the pixel data
    const rawImage = new RawImage(new Uint8ClampedArray(imageData), width, height, 4);

    // Run the background removal pipeline
    const output = await pipe(rawImage);

    // output is an array of RawImage objects; the first one is the result
    const result = output[0];

    // Extract the alpha channel as the mask
    // The pipeline returns an RGBA image where alpha = person mask
    const resultData = result.data as Uint8Array;
    const maskWidth = result.width as number;
    const maskHeight = result.height as number;
    const channels = result.channels as number;

    let mask: Uint8Array;
    if (channels === 1) {
      // Already a single-channel mask
      mask = new Uint8Array(resultData);
    } else if (channels === 4) {
      // Extract alpha channel
      mask = new Uint8Array(maskWidth * maskHeight);
      for (let i = 0; i < maskWidth * maskHeight; i++) {
        mask[i] = resultData[i * 4 + 3];
      }
    } else {
      // Use first channel as mask
      mask = new Uint8Array(maskWidth * maskHeight);
      for (let i = 0; i < maskWidth * maskHeight; i++) {
        mask[i] = resultData[i * channels];
      }
    }

    self.postMessage(
      {
        status: "mask-ready",
        frameIndex,
        mask,
        width: maskWidth,
        height: maskHeight,
      },
      // Transfer the buffer for zero-copy
      // @ts-expect-error - transferable list
      [mask.buffer]
    );
  } catch (error) {
    console.error(
      `[bg-removal-worker] Error processing frame ${frameIndex}:`,
      error
    );
    self.postMessage({
      status: "error",
      data: error instanceof Error ? error.message : "Unknown error occurred",
      frameIndex,
    });
  }
}
