"use client";

import { useEffect } from "react";
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
import { formatTime } from "@/lib/utils";

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
    previewRef,
    openCamera,
    startRecording,
    stopRecording,
    flipCamera,
    acceptRecording,
    discardRecording,
    closeCamera,
  } = useCameraRecording();

  useEffect(() => {
    openCamera();
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
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" strokeWidth={1.5} />
        <p className="mt-4 text-sm text-slate-600">Requesting camera access…</p>
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
        <p className="mt-4 max-w-sm text-sm text-slate-700">{error}</p>
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => openCamera()}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
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
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" strokeWidth={1.5} />
        <p className="mt-4 text-sm text-slate-600">Processing video…</p>
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
            className="inline-flex items-center gap-2 rounded-md bg-white px-3.5 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-100"
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
            className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-white transition-transform hover:scale-105"
            title="Start recording"
          >
            <Circle className="h-10 w-10 fill-red-500 text-red-500" />
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
        {state === "previewing" ? (
          <button
            type="button"
            onClick={flipCamera}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            title="Flip camera"
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
