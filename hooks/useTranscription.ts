import { useState, useRef, useEffect, useCallback } from "react";
import { extractAudioFromVideo } from "@/lib/audio-utils";

type DeviceType = "webgpu" | "wasm";

export type TranscriptionStatus =
  | "idle"
  | "loading"
  | "extracting"
  | "uploading"
  | "transcribing"
  | "processing"
  | "ready";

export interface TranscriptionResult {
  text: string;
  chunks: Array<{
    text: string;
    timestamp: [number, number];
  }>;
}

export const STATUS_MESSAGES: Record<TranscriptionStatus, string> = {
  idle: "Ready to start",
  loading: "Loading model...",
  extracting: "Extracting audio...",
  uploading: "Uploading video...",
  transcribing: "Trying to understand your gibberish...",
  processing: "Processing video...",
  ready: "Ready",
};

async function detectPreferredDevice(): Promise<DeviceType> {
  if (typeof navigator === "undefined" || typeof (navigator as any).gpu === "undefined") {
    return "wasm";
  }

  try {
    const adapter = await (navigator as any).gpu.requestAdapter();
    return adapter ? "webgpu" : "wasm";
  } catch {
    return "wasm";
  }
}

export function useTranscription() {
  const [status, setStatusState] = useState<TranscriptionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [device, setDevice] = useState<DeviceType>("wasm");
  const worker = useRef<Worker | null>(null);
  const deviceRef = useRef<DeviceType>("wasm");
  const modelReadyRef = useRef(false);
  const modelLoadingPromiseRef = useRef<Promise<void> | null>(null);
  const modelLoadResolveRef = useRef<(() => void) | null>(null);
  const modelLoadRejectRef = useRef<((error: Error) => void) | null>(null);
  const statusRef = useRef<TranscriptionStatus>("idle");

  const updateStatus = useCallback((nextStatus: TranscriptionStatus) => {
    statusRef.current = nextStatus;
    setStatusState(nextStatus);
  }, []);

  useEffect(() => {
    let cancelled = false;

    detectPreferredDevice().then((preferredDevice) => {
      if (cancelled) {
        return;
      }
      setDevice(preferredDevice);
      deviceRef.current = preferredDevice;
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const workerMessageHandler = useCallback((e: MessageEvent) => {
    switch (e.data.status) {
      case "loading":
        updateStatus("loading");
        modelReadyRef.current = false;
        break;

      case "ready":
        modelReadyRef.current = true;
        if (statusRef.current === "loading") {
          updateStatus("ready");
        }
        setProgress((prev) => Math.max(prev, 90));
        if (modelLoadResolveRef.current) {
          modelLoadResolveRef.current();
        }
        modelLoadingPromiseRef.current = null;
        modelLoadResolveRef.current = null;
        modelLoadRejectRef.current = null;
        break;

      case "complete":
        setResult(e.data.result);
        updateStatus("ready");
        setProgress(100);
        break;

      case "error":
        setError(e.data.data);
        updateStatus("idle");
        setProgress(0);
        modelReadyRef.current = false;
        if (modelLoadRejectRef.current) {
          modelLoadRejectRef.current(new Error(e.data.data));
        }
        modelLoadingPromiseRef.current = null;
        modelLoadResolveRef.current = null;
        modelLoadRejectRef.current = null;
        break;

      case "progress":
      case "initiate":
      case "download":
      case "done":
        if (typeof e.data.progress === "number") {
          const clamped = Math.max(0, Math.min(1, e.data.progress));
          setProgress(Math.round(clamped * 100));
        }
        break;
    }
  }, [updateStatus]);

  const initializeWorker = useCallback(() => {
    if (worker.current || typeof window === "undefined") {
      return;
    }

    const newWorker = new Worker(new URL("../app/worker.ts", import.meta.url), {
      type: "module",
    });

    newWorker.addEventListener("message", workerMessageHandler);
    worker.current = newWorker;
  }, [workerMessageHandler]);

  useEffect(() => {
    initializeWorker();

    return () => {
      if (worker.current) {
        worker.current.removeEventListener("message", workerMessageHandler);
        worker.current.terminate();
        worker.current = null;
      }
    };
  }, [initializeWorker, workerMessageHandler]);

  const ensureModelLoaded = useCallback(async () => {
    initializeWorker();

    if (modelReadyRef.current) {
      return;
    }

    if (!worker.current) {
      throw new Error("Worker not initialized properly");
    }

    if (!modelLoadingPromiseRef.current) {
      modelLoadingPromiseRef.current = new Promise<void>((resolve, reject) => {
        modelLoadResolveRef.current = resolve;
        modelLoadRejectRef.current = reject;
      });

      worker.current.postMessage({
        type: "load",
        data: { device: deviceRef.current },
      });
    }

    await modelLoadingPromiseRef.current;
  }, [initializeWorker]);

  // Initialize worker
  useEffect(() => {
    modelReadyRef.current = false;
  }, []);

  const handleVideoSelect = async (file: File) => {
    try {
      // Reset states
      setError(null);
      setResult(null);
      setProgress(0);

      console.log(
        "Processing video:",
        file.name,
        "Size:",
        file.size,
        "Type:",
        file.type
      );

      updateStatus("processing");
      setProgress(5);

      if (!modelReadyRef.current) {
        updateStatus("loading");
      }

      await ensureModelLoaded();

      updateStatus("extracting");
      setProgress(30);
      const audioData = await extractAudioFromVideo(file);

      if (!worker.current) {
        throw new Error("Worker not initialized properly");
      }

      updateStatus("transcribing");
      setProgress(60);
      worker.current.postMessage({
        type: "run",
        data: {
          audio: audioData,
          language: "en",
          device: deviceRef.current,
        },
      });
    } catch (err) {
      console.error("Error in handleVideoSelect:", err);
      if (err instanceof Error) {
        console.error("Error stack:", err.stack);
      }
      setError(err instanceof Error ? err.message : String(err));
      updateStatus("idle");
      setProgress(0);
      modelReadyRef.current = false;
      modelLoadingPromiseRef.current = null;
      modelLoadResolveRef.current = null;
      modelLoadRejectRef.current = null;

      // Reset worker on error
      if (worker.current) {
        worker.current.terminate();
        worker.current = null;
      }
    }
  };

  const resetTranscription = () => {
    // Reset states
    setError(null);
    setResult(null);
    updateStatus(modelReadyRef.current ? "ready" : "idle");
    setProgress(0);

    if (!worker.current) {
      initializeWorker();
    }
  };

  const cancelTranscription = useCallback(() => {
    setError(null);
    setResult(null);
    updateStatus("idle");
    setProgress(0);
    modelReadyRef.current = false;
    modelLoadingPromiseRef.current = null;
    modelLoadResolveRef.current = null;
    modelLoadRejectRef.current = null;

    if (worker.current) {
      worker.current.removeEventListener("message", workerMessageHandler);
      worker.current.terminate();
      worker.current = null;
    }

    initializeWorker();
  }, [initializeWorker, updateStatus, workerMessageHandler]);

  return {
    status,
    error,
    result,
    progress,
    setResult,
    setStatus: updateStatus,
    setProgress,
    handleVideoSelect,
    resetTranscription,
    cancelTranscription,
  };
}
