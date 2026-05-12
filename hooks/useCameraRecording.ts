"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  Output,
  BufferTarget,
  Mp4OutputFormat,
  CanvasSource,
  MediaStreamAudioTrackSource,
  type AudioSource,
} from "mediabunny";

export type CameraState =
  | "idle"
  | "requesting"
  | "previewing"
  | "recording"
  | "finalizing"
  | "recorded"
  | "error";

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export interface UseCameraRecordingReturn {
  state: CameraState;
  error: string | null;
  elapsedSeconds: number;
  recordedVideoUrl: string | null;
  facingMode: "user" | "environment";
  videoDevices: CameraDevice[];
  selectedDeviceId: string | null;
  selectedDeviceLabel: string | null;
  canSwitchCamera: boolean;
  previewRef: RefObject<HTMLVideoElement | null>;

  openCamera: () => Promise<void>;
  startRecording: () => void;
  stopRecording: () => void;
  flipCamera: () => Promise<void>;
  selectCamera: (deviceId: string) => Promise<void>;
  acceptRecording: () => File | null;
  discardRecording: () => void;
  closeCamera: () => void;
}

const MAX_RECORDING_SECONDS = 300;
const FRAME_RATE = 24;
const MAX_DIMENSION = 1280; // cap at 720p

function getFacingModeFromLabel(label: string): "user" | "environment" | null {
  const normalized = label.toLowerCase();
  if (/(front|user|face|facetime|selfie)/.test(normalized)) return "user";
  if (/(back|rear|environment|world|main)/.test(normalized)) {
    return "environment";
  }
  return null;
}

function getDeviceLabel(
  device: MediaDeviceInfo,
  index: number,
  activeDeviceId?: string | null,
): string {
  if (device.label) return device.label;
  if (activeDeviceId && device.deviceId === activeDeviceId) {
    return "Current camera";
  }
  return `Camera ${index + 1}`;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case "NotAllowedError":
        return "Camera access was denied. Please allow camera access in your browser settings.";
      case "NotFoundError":
        return "No camera found on this device.";
      case "NotReadableError":
        return "Camera is in use by another application.";
      default:
        return `Camera error: ${err.message}`;
    }
  }
  return "An unexpected error occurred while accessing the camera.";
}

export function useCameraRecording(): UseCameraRecordingReturn {
  const [state, setState] = useState<CameraState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [videoDevices, setVideoDevices] = useState<CameraDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  const previewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const recordedBytesRef = useRef<Uint8Array | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedDeviceIdRef = useRef<string | null>(null);

  // MediaBunny refs
  const outputRef = useRef<Output | null>(null);
  const videoSourceRef = useRef<CanvasSource | null>(null);
  const audioSourcesRef = useRef<AudioSource[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  const recordingStartRef = useRef<number>(0);
  const lastFrameNumberRef = useRef<number>(-1);
  const readyForFrameRef = useRef<boolean>(true);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const clearFrameInterval = useCallback(() => {
    if (frameIntervalRef.current !== null) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
  }, []);

  const attachStream = useCallback((stream: MediaStream) => {
    streamRef.current = stream;
    if (previewRef.current) {
      previewRef.current.srcObject = stream;
      previewRef.current.play().catch(() => {});
    }
  }, []);

  const refreshDevices = useCallback(
    async (activeDeviceId?: string | null): Promise<CameraDevice[]> => {
      if (typeof navigator.mediaDevices?.enumerateDevices !== "function") {
        return [];
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices
        .filter((device) => device.kind === "videoinput")
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: getDeviceLabel(device, index, activeDeviceId),
        }));

      setVideoDevices(cameras);
      return cameras;
    },
    [],
  );

  const syncActiveCamera = useCallback(
    async (stream: MediaStream, fallbackFacing: "user" | "environment") => {
      const [track] = stream.getVideoTracks();
      const settings = track?.getSettings();
      const activeDeviceId = settings?.deviceId ?? null;

      selectedDeviceIdRef.current = activeDeviceId;
      setSelectedDeviceId(activeDeviceId);

      const cameras = await refreshDevices(activeDeviceId);
      const activeDevice = cameras.find(
        (camera) => camera.deviceId === activeDeviceId,
      );
      const settingsFacing =
        settings?.facingMode === "user" ||
        settings?.facingMode === "environment"
          ? settings.facingMode
          : null;
      const inferredFacing =
        settingsFacing ??
        (activeDevice ? getFacingModeFromLabel(activeDevice.label) : null);

      setFacingMode(inferredFacing ?? fallbackFacing);
    },
    [refreshDevices],
  );

  // On mobile, the <video> element doesn't exist during "requesting" state
  // (component renders a spinner instead). When state transitions to "previewing"
  // the element mounts but srcObject was never set. This effect re-attaches it.
  useEffect(() => {
    if (
      previewRef.current &&
      streamRef.current &&
      (state === "previewing" || state === "recording") &&
      previewRef.current.srcObject !== streamRef.current
    ) {
      previewRef.current.srcObject = streamRef.current;
      previewRef.current.play().catch(() => {});
    }
  }, [state]);

  const requestStream = useCallback(
    async ({
      deviceId,
      facing,
    }: {
      deviceId?: string | null;
      facing: "user" | "environment";
    }): Promise<MediaStream> => {
      if (deviceId) {
        try {
          return await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: deviceId } },
            audio: true,
          });
        } catch (err) {
          if (
            !(err instanceof DOMException) ||
            (err.name !== "OverconstrainedError" &&
              err.name !== "NotFoundError")
          ) {
            throw err;
          }
        }
      }

      try {
        // Use exact facingMode so the browser doesn't silently pick the wrong camera
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: facing } },
          audio: true,
        });
      } catch (err) {
        if (
          err instanceof DOMException &&
          (err.name === "OverconstrainedError" || err.name === "NotFoundError")
        ) {
          // Device doesn't have this camera — fall back to any available camera
          return await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        }
        throw err;
      }
    },
    [],
  );

  const openCamera = useCallback(async () => {
    setState("requesting");
    setError(null);

    if (typeof navigator.mediaDevices?.getUserMedia !== "function") {
      setError("Camera access is not supported in this browser.");
      setState("error");
      return;
    }

    try {
      const stream = await requestStream({
        deviceId: selectedDeviceIdRef.current,
        facing: facingMode,
      });
      attachStream(stream);
      await syncActiveCamera(stream, facingMode);
      setState("previewing");
    } catch (err) {
      setError(getErrorMessage(err));
      setState("error");
    }
  }, [facingMode, requestStream, attachStream, syncActiveCamera]);

  const startRecording = useCallback(async () => {
    if (state !== "previewing" || !streamRef.current || !previewRef.current)
      return;

    const video = previewRef.current;
    let width = video.videoWidth || 1280;
    let height = video.videoHeight || 720;

    // Cap resolution to 720p to keep encoding fast (especially on mobile)
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const scale = MAX_DIMENSION / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }
    // Ensure even dimensions (required by H.264)
    width = width & ~1;
    height = height & ~1;

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;
    canvas.width = width;
    canvas.height = height;
    ctxRef.current = canvas.getContext("2d", { willReadFrequently: false });

    try {
      const output = new Output({
        format: new Mp4OutputFormat({ fastStart: "fragmented" }),
        target: new BufferTarget(),
      });
      outputRef.current = output;

      const videoBitrate = 8_000_000;

      const videoSource = new CanvasSource(canvas, {
        codec: "avc",
        bitrate: videoBitrate,
        keyFrameInterval: 2,
        latencyMode: "realtime",
      });
      videoSourceRef.current = videoSource;
      output.addVideoTrack(videoSource, { frameRate: FRAME_RATE });

      // Add audio tracks from the camera stream
      const audioSources: AudioSource[] = [];
      const audioTracks = streamRef.current.getAudioTracks();
      for (const track of audioTracks) {
        try {
          const audioSource = new MediaStreamAudioTrackSource(track, {
            codec: "aac",
            bitrate: 192_000,
          });
          audioSource.errorPromise.catch((e: unknown) =>
            console.warn("Camera audio source error:", e),
          );
          audioSources.push(audioSource);
          output.addAudioTrack(audioSource);
        } catch (e) {
          console.warn("Failed to add audio track:", e);
        }
      }
      audioSourcesRef.current = audioSources;

      await output.start();

      recordingStartRef.current = Date.now();
      lastFrameNumberRef.current = -1;
      readyForFrameRef.current = true;

      // Frame capture loop — draw camera to canvas, let CanvasSource encode it
      const addFrame = async () => {
        if (!readyForFrameRef.current || !videoSourceRef.current) return;

        const elapsed = (Date.now() - recordingStartRef.current) / 1000;
        const frameNumber = Math.round(elapsed * FRAME_RATE);
        if (frameNumber === lastFrameNumberRef.current) return;

        lastFrameNumberRef.current = frameNumber;
        const timestamp = frameNumber / FRAME_RATE;

        readyForFrameRef.current = false;
        try {
          ctxRef.current?.drawImage(video, 0, 0, width, height);
          await videoSourceRef.current.add(timestamp, 1 / FRAME_RATE);
        } catch (e) {
          console.warn("Frame encode error:", e);
        }
        readyForFrameRef.current = true;
      };

      frameIntervalRef.current = window.setInterval(() => {
        addFrame().catch((e) => console.warn("Frame capture error:", e));
      }, 1000 / FRAME_RATE);

      setElapsedSeconds(0);
      setState("recording");

      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => {
          const next = prev + 1;
          if (next >= MAX_RECORDING_SECONDS) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      console.error("Error starting MP4 recording:", err);
      clearFrameInterval();
      outputRef.current?.cancel();
      outputRef.current = null;
      setError(
        "Failed to start recording. Your browser may not support MP4 encoding.",
      );
      setState("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, clearFrameInterval]);

  const stopRecording = useCallback(async () => {
    if (!outputRef.current) return;

    clearTimer();
    clearFrameInterval();

    // Show spinner while MP4 is being finalized
    setState("finalizing");
    recordedBytesRef.current = null;

    try {
      videoSourceRef.current?.close();
      videoSourceRef.current = null;

      for (const src of audioSourcesRef.current) {
        src.close();
      }
      audioSourcesRef.current = [];

      await outputRef.current.finalize();

      const buffer = (outputRef.current.target as BufferTarget).buffer;
      if (!buffer) {
        throw new Error("No output buffer from MP4 encoder.");
      }

      const recordedBytes = new Uint8Array(buffer).slice();
      const blob = new Blob([recordedBytes], { type: "video/mp4" });
      recordedBytesRef.current = recordedBytes;
      blobRef.current = blob;

      // Stop camera stream so it's not running during review
      stopTracks();
      if (previewRef.current) {
        previewRef.current.srcObject = null;
      }

      const url = URL.createObjectURL(blob);
      setRecordedVideoUrl(url);
      outputRef.current = null;

      // Only transition to recorded AFTER the blob URL is ready
      setState("recorded");
    } catch (err) {
      console.error("Error finalizing MP4:", err);
      outputRef.current?.cancel();
      outputRef.current = null;
      recordedBytesRef.current = null;
      setError("Failed to finalize recording.");
      setState("error");
    }
  }, [clearTimer, clearFrameInterval, stopTracks]);

  const selectCamera = useCallback(
    async (deviceId: string) => {
      selectedDeviceIdRef.current = deviceId;
      setSelectedDeviceId(deviceId);

      if (state !== "previewing") return;

      stopTracks();
      setState("requesting");
      setError(null);

      try {
        const stream = await requestStream({ deviceId, facing: facingMode });
        attachStream(stream);
        await syncActiveCamera(stream, facingMode);
        setState("previewing");
      } catch (err) {
        setError(getErrorMessage(err));
        setState("error");
      }
    },
    [
      state,
      facingMode,
      stopTracks,
      requestStream,
      attachStream,
      syncActiveCamera,
    ],
  );

  const flipCamera = useCallback(async () => {
    if (state !== "previewing") return;

    const cameras =
      videoDevices.length > 0
        ? videoDevices
        : await refreshDevices(selectedDeviceIdRef.current);

    if (cameras.length > 1) {
      const currentIndex = cameras.findIndex(
        (camera) => camera.deviceId === selectedDeviceIdRef.current,
      );
      const nextCamera = cameras[(currentIndex + 1) % cameras.length];
      await selectCamera(nextCamera.deviceId);
      return;
    }

    stopTracks();
    const newFacing = facingMode === "user" ? "environment" : "user";
    setFacingMode(newFacing);
    setState("requesting");

    try {
      const stream = await requestStream({ facing: newFacing });
      attachStream(stream);
      await syncActiveCamera(stream, newFacing);
      setState("previewing");
    } catch (err) {
      setError(getErrorMessage(err));
      setState("error");
    }
  }, [
    state,
    videoDevices,
    refreshDevices,
    stopTracks,
    facingMode,
    requestStream,
    attachStream,
    syncActiveCamera,
    selectCamera,
  ]);

  const acceptRecording = useCallback((): File | null => {
    if (!blobRef.current || !recordedBytesRef.current) return null;

    const fileBytes = recordedBytesRef.current.slice();

    const file = new File([fileBytes], "camera-recording.mp4", {
      type: "video/mp4",
      lastModified: Date.now(),
    });

    if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
    setRecordedVideoUrl(null);
    recordedBytesRef.current = null;
    blobRef.current = null;
    stopTracks();
    setState("idle");
    setElapsedSeconds(0);

    return file;
  }, [recordedVideoUrl, stopTracks]);

  const discardRecording = useCallback(async () => {
    if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
    setRecordedVideoUrl(null);
    recordedBytesRef.current = null;
    blobRef.current = null;

    try {
      const stream = await requestStream({
        deviceId: selectedDeviceIdRef.current,
        facing: facingMode,
      });
      attachStream(stream);
      await syncActiveCamera(stream, facingMode);
      setState("previewing");
    } catch (err) {
      setError(getErrorMessage(err));
      setState("error");
    }
    setElapsedSeconds(0);
  }, [
    recordedVideoUrl,
    facingMode,
    requestStream,
    attachStream,
    syncActiveCamera,
  ]);

  const closeCamera = useCallback(() => {
    clearTimer();
    clearFrameInterval();

    // Cancel any in-progress encoding
    if (outputRef.current) {
      videoSourceRef.current?.close();
      videoSourceRef.current = null;
      for (const src of audioSourcesRef.current) {
        src.close();
      }
      audioSourcesRef.current = [];
      outputRef.current.cancel();
      outputRef.current = null;
    }

    stopTracks();
    if (previewRef.current) {
      previewRef.current.srcObject = null;
    }
    if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
    setRecordedVideoUrl(null);
    recordedBytesRef.current = null;
    blobRef.current = null;
    setElapsedSeconds(0);
    setError(null);
    setState("idle");
  }, [clearTimer, clearFrameInterval, stopTracks, recordedVideoUrl]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      recordedBytesRef.current = null;
      if (outputRef.current) {
        videoSourceRef.current?.close();
        for (const src of audioSourcesRef.current) src.close();
        outputRef.current.cancel();
      }
    };
  }, []);

  const selectedDeviceLabel = useMemo(
    () =>
      videoDevices.find((device) => device.deviceId === selectedDeviceId)
        ?.label ?? null,
    [selectedDeviceId, videoDevices],
  );
  const canSwitchCamera = videoDevices.length > 1 || !selectedDeviceId;

  return {
    state,
    error,
    elapsedSeconds,
    recordedVideoUrl,
    facingMode,
    videoDevices,
    selectedDeviceId,
    selectedDeviceLabel,
    canSwitchCamera,
    previewRef,
    openCamera,
    startRecording,
    stopRecording,
    flipCamera,
    selectCamera,
    acceptRecording,
    discardRecording,
    closeCamera,
  };
}
