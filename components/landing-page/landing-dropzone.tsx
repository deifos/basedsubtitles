"use client";

import { useCallback, useRef, useState } from "react";
import type { JSX, DragEvent, ChangeEvent } from "react";

import { Camera, Film, FolderOpen, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { CameraRecorder } from "@/components/landing-page/camera-recorder";

interface LandingDropzoneProps {
  onVideoSelect?: (file: File) => void;
}

export function LandingDropzone({
  onVideoSelect,
}: LandingDropzoneProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isRecorderOpen, setIsRecorderOpen] = useState(false);
  const dragCounterRef = useRef(0);

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      if (!file.type.startsWith("video/")) {
        return;
      }

      onVideoSelect?.(file);
    },
    [onVideoSelect],
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      handleFile(file);
      // allow selecting same file again
      event.target.value = "";
    },
    [handleFile],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragOver(false);
      const file = event.dataTransfer.files?.[0] ?? null;
      handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current++;
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleRecordedVideo = useCallback(
    (file: File) => {
      setIsRecorderOpen(false);
      onVideoSelect?.(file);
    },
    [onVideoSelect],
  );

  return (
    <>
      <div
        className={`group relative rounded-xl border-2 border-dashed p-4 shadow-sm transition-all focus-within:outline-none ${
          isDragOver
            ? "border-amber-400 bg-amber-50/60 scale-[1.02]"
            : "border-border bg-background hover:border-border"
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        <div
          className={`absolute inset-0 -z-10 rounded-xl transition-colors ${isDragOver ? "bg-amber-50/40" : "bg-muted"}`}
        />

        <div className="flex flex-col items-center justify-center py-5 text-center">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-background text-foreground">
            <Film className="h-5 w-5" strokeWidth={1.5} />
            <div className="pointer-events-none absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm ring-2 ring-background">
              <Plus className="h-3 w-3" strokeWidth={1.5} />
            </div>
          </div>
          <h2 className="mt-3 text-base font-semibold tracking-tight text-foreground">
            Drop a video here
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            MP4, MOV, WebM • processed locally in your browser
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={openFilePicker}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <FolderOpen className="h-4 w-4" strokeWidth={1.5} />
              Browse files
            </button>
            <button
              type="button"
              onClick={() => setIsRecorderOpen(true)}
              className="relative isolate inline-flex items-center gap-2 rounded-md border border-red-500 bg-red-600 px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-red-500/25 transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            >
              <span className="pointer-events-none absolute -inset-1 -z-10 rounded-lg bg-red-500/30 animate-ping" />
              <span className="h-2 w-2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]" />
              <Camera className="h-4 w-4" strokeWidth={1.5} />
              Record
            </button>
            <span className="text-xs text-muted-foreground">
              or drag & drop
            </span>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="sr-only"
          onChange={handleInputChange}
        />
      </div>

      <Dialog open={isRecorderOpen} onOpenChange={setIsRecorderOpen}>
        <DialogContent
          className="overflow-hidden p-0 sm:max-w-2xl"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Record a video</DialogTitle>
          <DialogDescription className="sr-only">
            Record a video with an available camera and use it for subtitles.
          </DialogDescription>
          <CameraRecorder
            onVideoReady={handleRecordedVideo}
            onCancel={() => setIsRecorderOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
