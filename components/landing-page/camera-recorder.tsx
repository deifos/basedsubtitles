"use client";

import { useEffect, useRef } from "react";
import type { JSX } from "react";
import {
  Circle,
  Square,
  SwitchCamera,
  RotateCcw,
  Loader2,
  AlertCircle,
  Video,
  X,
} from "lucide-react";
import { useCameraRecording } from "@/hooks/useCameraRecording";
import { formatTime } from "@/lib/transcript-utils";

interface CameraRecorderProps {
  onVideoReady: (file: File) => void;
  onCancel: () => void;
}

export function CameraRecorder({
  onVideoReady,
  onCancel,
}: CameraRecorderProps): JSX.Element {
  const {
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
  } = useCameraRecording();

  const hasOpenedRef = useRef(false);
  useEffect(() => {
    if (!hasOpenedRef.current) {
      hasOpenedRef.current = true;
      openCamera();
    }
  }, [openCamera]);

  const handleCancel = () => {
    closeCamera();
    onCancel();
  };

  const handleAccept = () => {
    const file = acceptRecording();
    if (file) onVideoReady(file);
  };

  // Requesting state
  if (state === "requesting") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Loader2
          className="h-8 w-8 animate-spin text-muted-foreground"
          strokeWidth={1.5}
        />
        <p className="mt-4 text-sm text-muted-foreground">
          Requesting camera access…
        </p>
      </div>
    );
  }

  // Error state
  if (state === "error") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
          <AlertCircle className="h-6 w-6 text-red-500" strokeWidth={1.5} />
        </div>
        <p className="mt-4 max-w-sm text-sm text-foreground">{error}</p>
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => openCamera()}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Finalizing state — MP4 is being assembled
  if (state === "finalizing") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Loader2
          className="h-8 w-8 animate-spin text-muted-foreground"
          strokeWidth={1.5}
        />
        <p className="mt-4 text-sm text-muted-foreground">Processing video…</p>
      </div>
    );
  }

  // Recorded state — review screen (camera stream is stopped, only blob URL plays)
  if (state === "recorded" && recordedVideoUrl) {
    return (
      <div className="flex flex-col overflow-hidden">
        <div className="relative aspect-video w-full bg-black">
          <video
            key={recordedVideoUrl}
            src={recordedVideoUrl}
            controls
            playsInline
            className="h-full w-full object-contain"
          />
        </div>
        <div className="flex items-center justify-center gap-3 bg-black/80 px-4 py-3 backdrop-blur-sm">
          <button
            type="button"
            onClick={discardRecording}
            className="inline-flex items-center gap-2 rounded-md border border-white/20 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
            Re-record
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="inline-flex items-center gap-2 rounded-md bg-background px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Video className="h-4 w-4" strokeWidth={1.5} />
            Use this video
          </button>
        </div>
      </div>
    );
  }

  // Previewing / Recording states — live camera
  return (
    <div className="flex flex-col overflow-hidden">
      <div className="relative aspect-video w-full bg-black">
        <video
          ref={previewRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full object-cover"
          style={
            facingMode === "user" ? { transform: "scaleX(-1)" } : undefined
          }
        />

        {/* Recording indicator */}
        {state === "recording" && (
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-sm">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            <span className="text-sm font-medium tabular-nums text-white">
              {formatTime(elapsedSeconds)}
            </span>
          </div>
        )}

        {state === "previewing" && videoDevices.length > 1 && (
          <label className="absolute right-3 top-3 inline-flex max-w-[min(14rem,calc(100%-1.5rem))] items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 text-white shadow-sm backdrop-blur-sm">
            <Video className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
            <select
              value={selectedDeviceId ?? ""}
              onChange={(event) => void selectCamera(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-xs font-medium outline-none"
              title="Choose camera"
            >
              {videoDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Controls bar */}
      <div className="flex items-center justify-center gap-4 bg-black/80 px-4 py-3 backdrop-blur-sm">
        {/* Cancel */}
        <button
          type="button"
          onClick={handleCancel}
          className="flex h-10 w-10 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          title="Cancel"
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>

        {/* Start / Stop */}
        {state === "previewing" ? (
          <button
            type="button"
            onClick={startRecording}
            className="relative isolate flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-white bg-red-600 shadow-lg shadow-red-500/40 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            title="Start recording"
          >
            <span className="pointer-events-none absolute -inset-2 -z-10 rounded-full bg-red-500/35 animate-ping" />
            <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-red-500 animate-pulse">
              <Circle className="h-8 w-8 fill-white text-white" />
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={stopRecording}
            className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-red-500 transition-transform hover:scale-105"
            title="Stop recording"
          >
            <Square
              className="h-6 w-6 fill-red-500 text-red-500"
              strokeWidth={0}
            />
          </button>
        )}

        {/* Flip camera — only visible in previewing state */}
        {state === "previewing" && canSwitchCamera ? (
          <button
            type="button"
            onClick={flipCamera}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            title={
              selectedDeviceLabel
                ? `Switch camera (${selectedDeviceLabel})`
                : "Switch camera"
            }
          >
            <SwitchCamera className="h-5 w-5" strokeWidth={1.5} />
          </button>
        ) : (
          <div className="h-10 w-10" />
        )}
      </div>
    </div>
  );
}
