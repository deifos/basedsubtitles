"use client";

import { useCallback, useRef } from "react";
import type { JSX, DragEvent, ChangeEvent } from "react";
import { Film, FolderOpen, Plus } from "lucide-react";

interface LandingDropzoneProps {
  onVideoSelect?: (file: File) => void;
}

export function LandingDropzone({
  onVideoSelect,
}: LandingDropzoneProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      if (!file.type.startsWith("video/")) {
        return;
      }

      onVideoSelect?.(file);
    },
    [onVideoSelect]
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      handleFile(file);
      // allow selecting same file again
      event.target.value = "";
    },
    [handleFile]
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      const file = event.dataTransfer.files?.[0] ?? null;
      handleFile(file);
    },
    [handleFile]
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
    <div
      className="group relative rounded-xl border border-dashed border-slate-300 bg-white p-6 shadow-sm transition-colors hover:border-slate-400 focus-within:outline-none sm:p-8"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <div className="absolute inset-0 -z-10 rounded-xl bg-slate-50" />

      <div className="flex flex-col items-center justify-center py-10 text-center sm:py-14">
        <div className="relative flex h-16 w-16 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700">
          <Film className="h-7 w-7" strokeWidth={1.5} />
          <div className="pointer-events-none absolute -bottom-1.5 -right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm ring-2 ring-white">
            <Plus className="h-4 w-4" strokeWidth={1.5} />
          </div>
        </div>
        <h2 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">
          Drop a video here
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          MP4, MOV, WebM • up to ~2 hours • processed locally in your browser
        </p>
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={openFilePicker}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
          >
            <FolderOpen className="h-4 w-4" strokeWidth={1.5} />
            Browse files
          </button>
          <span className="text-xs text-slate-500">or drag & drop</span>
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
  );
}
