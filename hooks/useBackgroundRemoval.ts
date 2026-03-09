import { useState, useCallback, useRef, useEffect } from "react";

export interface MaskData {
  data: Uint8Array;
  width: number;
  height: number;
}

interface UseBackgroundRemovalReturn {
  isModelLoading: boolean;
  isProcessing: boolean;
  progress: number;
  isReady: boolean;
  processVideo: (videoElement: HTMLVideoElement) => Promise<void>;
  getMaskAtTime: (time: number, fps?: number) => MaskData | null;
  reset: () => void;
  processFrame: (
    imageData: Uint8ClampedArray,
    width: number,
    height: number,
    frameIndex: number,
  ) => Promise<MaskData>;
}

const SAMPLE_FPS = 5;

export function useBackgroundRemoval(): UseBackgroundRemovalReturn {
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const modelReadyRef = useRef(false);
  const masksRef = useRef<Map<number, MaskData>>(new Map());
  const pendingFramesRef = useRef<
    Map<
      number,
      { resolve: (mask: MaskData) => void; reject: (err: Error) => void }
    >
  >(new Map());

  // Initialize worker
  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../app/bg-removal-worker.ts", import.meta.url),
        { type: "module" },
      );

      workerRef.current.addEventListener("message", (e: MessageEvent) => {
        const { status, data, frameIndex, mask, width, height } = e.data;

        switch (status) {
          case "loading":
            setIsModelLoading(true);
            break;

          case "ready":
            setIsModelLoading(false);
            modelReadyRef.current = true;
            break;

          case "error": {
            setIsModelLoading(false);
            console.error("[useBackgroundRemoval] Worker error:", data);
            // Reject any pending frame promise for this frameIndex
            if (frameIndex !== undefined) {
              const pending = pendingFramesRef.current.get(frameIndex);
              if (pending) {
                pending.reject(new Error(data));
                pendingFramesRef.current.delete(frameIndex);
              }
            }
            break;
          }

          case "mask-ready": {
            const maskData: MaskData = {
              data: new Uint8Array(mask),
              width,
              height,
            };

            // Store in ref for immediate access
            masksRef.current.set(frameIndex, maskData);

            // Resolve pending promise
            const pending = pendingFramesRef.current.get(frameIndex);
            if (pending) {
              pending.resolve(maskData);
              pendingFramesRef.current.delete(frameIndex);
            }
            break;
          }
        }
      });
    }
    return workerRef.current;
  }, []);

  // Ensure model is loaded
  const ensureModelLoaded = useCallback(async (): Promise<void> => {
    if (modelReadyRef.current) return;

    const worker = getWorker();

    return new Promise((resolve, reject) => {
      const handler = (e: MessageEvent) => {
        if (e.data.status === "ready") {
          worker.removeEventListener("message", handler);
          resolve();
        } else if (e.data.status === "error") {
          worker.removeEventListener("message", handler);
          reject(new Error(e.data.data));
        }
      };

      worker.addEventListener("message", handler);

      // Try WebGPU first, same as the transcription worker
      const device =
        typeof navigator !== "undefined" && "gpu" in navigator
          ? "webgpu"
          : "wasm";
      worker.postMessage({ type: "load", data: { device } });
    });
  }, [getWorker]);

  // Process a single frame and return a promise for the mask
  const processFrame = useCallback(
    (
      imageData: Uint8ClampedArray,
      width: number,
      height: number,
      frameIndex: number,
    ): Promise<MaskData> => {
      const worker = getWorker();

      return new Promise((resolve, reject) => {
        pendingFramesRef.current.set(frameIndex, { resolve, reject });
        worker.postMessage({
          type: "process-frame",
          data: { imageData, width, height, frameIndex },
        });
      });
    },
    [getWorker],
  );

  // Process entire video for preview masks
  const processVideo = useCallback(
    async (videoElement: HTMLVideoElement) => {
      setIsProcessing(true);
      setProgress(0);
      setIsReady(false);
      masksRef.current = new Map();

      try {
        // Load model first
        await ensureModelLoaded();

        const duration = videoElement.duration;
        if (!duration || !isFinite(duration)) {
          throw new Error("Invalid video duration");
        }

        const totalFrames = Math.ceil(duration * SAMPLE_FPS);
        const canvas = document.createElement("canvas");
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });

        if (!ctx) {
          throw new Error("Failed to create canvas context");
        }

        // Create a cloned video to avoid interfering with playback
        const processingVideo = document.createElement("video");
        processingVideo.src = videoElement.src;
        processingVideo.muted = true;
        processingVideo.preload = "auto";

        await new Promise<void>((resolve, reject) => {
          processingVideo.onloadeddata = () => resolve();
          processingVideo.onerror = () =>
            reject(new Error("Failed to load processing video"));
        });

        // Process frames sequentially using seek
        for (let i = 0; i < totalFrames; i++) {
          const time = i / SAMPLE_FPS;

          // Seek to target time
          await new Promise<void>((resolve) => {
            const onSeeked = () => {
              processingVideo.removeEventListener("seeked", onSeeked);
              resolve();
            };
            processingVideo.addEventListener("seeked", onSeeked);
            processingVideo.currentTime = Math.min(time, duration - 0.01);
          });

          // Draw frame to canvas
          ctx.drawImage(processingVideo, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          // Send to worker and wait for result
          await processFrame(imageData.data, canvas.width, canvas.height, i);

          // Update progress
          const pct = Math.round(((i + 1) / totalFrames) * 100);
          setProgress(pct);
        }

        // Cleanup processing video
        processingVideo.onloadeddata = null;
        processingVideo.onerror = null;
        processingVideo.src = "";
        processingVideo.load();

        // Terminate worker to free segmentation model memory (~500MB-1GB)
        // Worker will be re-created on demand if needed for export
        if (workerRef.current) {
          workerRef.current.terminate();
          workerRef.current = null;
        }
        modelReadyRef.current = false;

        setIsReady(true);
      } catch (error) {
        console.error("[useBackgroundRemoval] Processing failed:", error);
        setIsReady(false);
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [ensureModelLoaded, processFrame],
  );

  // Get the nearest cached mask for a given video time
  const getMaskAtTime = useCallback(
    (time: number, fps: number = SAMPLE_FPS): MaskData | null => {
      const currentMasks = masksRef.current;
      if (currentMasks.size === 0) return null;

      // Find nearest frame index
      const frameIndex = Math.round(time * fps);

      // Try exact match first
      if (currentMasks.has(frameIndex)) {
        return currentMasks.get(frameIndex)!;
      }

      // Find closest frame
      let closest: number | null = null;
      let closestDist = Infinity;

      for (const key of currentMasks.keys()) {
        const dist = Math.abs(key - frameIndex);
        if (dist < closestDist) {
          closestDist = dist;
          closest = key;
        }
      }

      return closest !== null ? currentMasks.get(closest)! : null;
    },
    [],
  );

  // Reset all state
  const reset = useCallback(() => {
    masksRef.current = new Map();
    pendingFramesRef.current = new Map();
    setIsReady(false);
    setIsProcessing(false);
    setProgress(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
    };
  }, []);

  return {
    isModelLoading,
    isProcessing,
    progress,
    isReady,
    processVideo,
    getMaskAtTime,
    reset,
    processFrame,
  };
}
