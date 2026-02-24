"use client";

import { useCallback, useState, forwardRef, useEffect, memo, useRef } from "react";
import { cn } from "@/lib/utils";
import { VideoCaption } from "./video-caption";
import { SubtitleStyle } from "./subtitle-styling";
import { UploadIcon } from "lucide-react";
import type { MaskData } from "@/hooks/useBackgroundRemoval";
import { renderSubtitleToCanvas, renderDynamicBehindText, renderDynamicFrontText, estimateFaceFromMask } from "@/lib/render-subtitle";

interface VideoUploadProps {
  onVideoSelect: (file: File) => void;
  onTimeUpdate?: (time: number) => void;
  onAspectRatioDetected?: (ratio: "16:9" | "9:16") => void;
  className?: string;
  transcript?: {
    text: string;
    chunks: Array<{
      text: string;
      timestamp: [number, number];
      disabled?: boolean;
    }>;
  } | null;
  currentTime?: number;
  subtitleStyle: SubtitleStyle;
  mode: "word" | "phrase" | "dynamic";
  ratio: "16:9" | "9:16";
  zoomPortrait: boolean;
  initialFile?: File | null;
  bgRemovalReady?: boolean;
  getMaskAtTime?: (time: number, fps?: number) => MaskData | null;
}

const VideoUploadComponent = forwardRef<HTMLVideoElement, VideoUploadProps>(
  (
    {
      onVideoSelect,
      onTimeUpdate,
      onAspectRatioDetected,
      className,
      transcript,
      currentTime = 0,
      subtitleStyle,
      mode,
      ratio,
      zoomPortrait,
      initialFile,
      bgRemovalReady = false,
      getMaskAtTime,
    },
    ref
  ) => {
    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSkipping, setIsSkipping] = useState(false);
    const processedFileRef = useRef<File | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animFrameRef = useRef<number>(0);
    const blurCanvasRef = useRef<HTMLCanvasElement | null>(null);

    // Whether compositing mode is active
    const isDynamicMode = mode === "dynamic" && bgRemovalReady && getMaskAtTime;
    const isBgRemovalMode = bgRemovalReady && subtitleStyle.backgroundRemovalEnabled && getMaskAtTime;
    const compositingActive = isDynamicMode || isBgRemovalMode;

    // Reset video source when ref.current.src is empty
    useEffect(() => {
      if (ref && typeof ref !== "function" && ref.current) {
        // Check if the video element has no source
        if (!ref.current.src || ref.current.src === window.location.href) {
          setVideoSrc(null);
        }
      }
    }, [ref]);

    // Reset state when component is mounted
    useEffect(() => {
      setVideoSrc(null);
      setError(null);
    }, []);

    const handleFile = useCallback(
      async (file: File) => {
        try {
          if (!file.type.startsWith("video/")) {
            throw new Error("Please select a video file");
          }

          // Create video element to check duration
          const video = document.createElement("video");
          video.preload = "metadata";

          await new Promise((resolve, reject) => {
            video.onloadedmetadata = resolve;
            video.onerror = reject;
            video.src = URL.createObjectURL(file);
          });

          if (video.duration > 300) {
            URL.revokeObjectURL(video.src);
            throw new Error("Video must be less than 5 minutes");
          }

          // Detect aspect ratio from video dimensions
          const detectedRatio: "16:9" | "9:16" = video.videoHeight > video.videoWidth ? "9:16" : "16:9";

          setVideoSrc(video.src);
          setError(null);
          onVideoSelect(file);

          // Notify parent of detected aspect ratio
          if (onAspectRatioDetected) {
            onAspectRatioDetected(detectedRatio);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Error loading video");
          setVideoSrc(null);
        }
      },
      [onVideoSelect, onAspectRatioDetected]
    );

    const handleDrop = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();

        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      },
      [handleFile]
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);

        // Reset the input value to allow selecting the same file again
        e.target.value = "";
      },
      [handleFile]
    );

    useEffect(() => {
      if (!initialFile) {
        return;
      }

      if (processedFileRef.current === initialFile) {
        return;
      }

      processedFileRef.current = initialFile;
      void handleFile(initialFile);
    }, [initialFile, handleFile]);

    // Function to get disabled time ranges
    const getDisabledRanges = useCallback(() => {
      if (!transcript) return [];

      const disabledRanges: Array<[number, number]> = [];

      transcript.chunks.forEach(chunk => {
        if (chunk.disabled) {
          disabledRanges.push(chunk.timestamp);
        }
      });

      // Sort ranges by start time and merge overlapping ranges
      disabledRanges.sort((a, b) => a[0] - b[0]);
      const mergedRanges: Array<[number, number]> = [];

      for (const range of disabledRanges) {
        if (mergedRanges.length === 0 || mergedRanges[mergedRanges.length - 1][1] < range[0]) {
          mergedRanges.push(range);
        } else {
          // Merge overlapping ranges
          mergedRanges[mergedRanges.length - 1][1] = Math.max(
            mergedRanges[mergedRanges.length - 1][1],
            range[1]
          );
        }
      }

      return mergedRanges;
    }, [transcript]);

    // Function to handle time updates and skip disabled segments
    const handleTimeUpdate = useCallback(
      (e: React.SyntheticEvent<HTMLVideoElement>) => {
        const video = e.currentTarget;
        const currentTime = video.currentTime;

        // Call the original onTimeUpdate
        onTimeUpdate?.(currentTime);

        // Skip disabled segments
        if (!isSkipping && transcript) {
          const disabledRanges = getDisabledRanges();

          for (const [start, end] of disabledRanges) {
            // If current time is within a disabled range, skip to the end
            if (currentTime >= start && currentTime < end) {
              setIsSkipping(true);
              video.currentTime = end + 0.1; // Add small buffer to avoid edge cases

              // Reset skipping flag after a short delay
              setTimeout(() => {
                setIsSkipping(false);
              }, 100);
              break;
            }
          }
        }
      },
      [onTimeUpdate, transcript, isSkipping, getDisabledRanges]
    );

    // Canvas compositing loop for background removal preview
    useEffect(() => {
      if (!compositingActive || !canvasRef.current) {
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = 0;
        }
        return;
      }

      const videoEl =
        ref && typeof ref !== "function" ? ref.current : null;
      if (!videoEl) return;

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Create reusable temp canvases
      if (!blurCanvasRef.current) {
        blurCanvasRef.current = document.createElement("canvas");
      }
      const fgCanvas = document.createElement("canvas");
      const maskCanvas = document.createElement("canvas");

      const render = () => {
        if (!videoEl || (videoEl.paused && videoEl.currentTime === 0)) {
          animFrameRef.current = requestAnimationFrame(render);
          return;
        }

        // Match canvas to displayed size
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
          canvas.width = displayWidth;
          canvas.height = displayHeight;
        }

        const time = videoEl.currentTime;
        const mask = getMaskAtTime!(time);

        if (!mask) {
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          animFrameRef.current = requestAnimationFrame(render);
          return;
        }

        const w = canvas.width;
        const h = canvas.height;
        const isDynamic = mode === "dynamic";

        // Step 1: Draw background layer
        if (isDynamic) {
          // Dynamic mode: keep original video as background
          ctx.drawImage(videoEl, 0, 0, w, h);
        } else if (subtitleStyle.backgroundType === "blur") {
          const blurCanvas = blurCanvasRef.current!;
          blurCanvas.width = w;
          blurCanvas.height = h;
          const blurCtx = blurCanvas.getContext("2d");
          if (blurCtx) {
            blurCtx.filter = "blur(20px)";
            blurCtx.drawImage(videoEl, 0, 0, w, h);
            blurCtx.filter = "none";
            ctx.drawImage(blurCanvas, 0, 0);
          }
        } else {
          ctx.fillStyle = subtitleStyle.solidBackgroundColor;
          ctx.fillRect(0, 0, w, h);
        }

        // Step 2: Render subtitle behind person
        if (isDynamic && transcript) {
          // Dynamic mode: render only "behind" words as big text
          renderDynamicBehindText(ctx, transcript, time, subtitleStyle, w, h);
        } else if (subtitleStyle.subtitleBehindPerson && transcript) {
          // Non-dynamic behind mode: render all text behind
          renderSubtitleToCanvas(ctx, transcript, time, subtitleStyle, mode, w, h);
        }

        // Step 3: Draw masked foreground using canvas compositing
        fgCanvas.width = w;
        fgCanvas.height = h;
        const fgCtx = fgCanvas.getContext("2d");
        if (fgCtx) {
          // Draw video frame onto foreground canvas
          fgCtx.clearRect(0, 0, w, h);
          fgCtx.drawImage(videoEl, 0, 0, w, h);

          // Create mask canvas at mask resolution, then scale
          maskCanvas.width = mask.width;
          maskCanvas.height = mask.height;
          const maskCtx = maskCanvas.getContext("2d");
          if (maskCtx) {
            const maskImageData = maskCtx.createImageData(mask.width, mask.height);
            for (let i = 0; i < mask.data.length; i++) {
              const idx = i * 4;
              maskImageData.data[idx] = 255;     // R
              maskImageData.data[idx + 1] = 255; // G
              maskImageData.data[idx + 2] = 255; // B
              maskImageData.data[idx + 3] = mask.data[i]; // A = mask alpha
            }
            maskCtx.putImageData(maskImageData, 0, 0);

            // Use destination-in to clip the video frame to the mask shape
            fgCtx.globalCompositeOperation = "destination-in";
            fgCtx.drawImage(maskCanvas, 0, 0, w, h);
            fgCtx.globalCompositeOperation = "source-over";
          }

          // Draw masked foreground onto main canvas
          ctx.drawImage(fgCanvas, 0, 0);
        }

        // Step 4: Render front text (dynamic) or on-top text (non-dynamic)
        if (isDynamic && transcript) {
          // Estimate face from mask for positioning front text below chin
          const faceBounds = estimateFaceFromMask(mask.data, mask.width, mask.height, w, h);
          renderDynamicFrontText(ctx, transcript, time, subtitleStyle, w, h, faceBounds);
        } else if (!subtitleStyle.subtitleBehindPerson && transcript) {
          renderSubtitleToCanvas(ctx, transcript, time, subtitleStyle, mode, w, h);
        }

        animFrameRef.current = requestAnimationFrame(render);
      };

      animFrameRef.current = requestAnimationFrame(render);

      return () => {
        if (animFrameRef.current) {
          cancelAnimationFrame(animFrameRef.current);
          animFrameRef.current = 0;
        }
      };
    }, [compositingActive, ref, subtitleStyle, transcript, mode, getMaskAtTime]);

    return (
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg transition-colors overflow-hidden",
          videoSrc ? "" : "min-h-[300px]",
          className
        )}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={handleDrop}
      >
        {videoSrc ? (
          <div className="relative flex items-center justify-center w-full">
            <div
              className={cn(
                "relative mx-auto flex justify-center",
                ratio === "16:9" ? "w-full" : "w-auto"
              )}
              style={{
                aspectRatio: ratio === "16:9" ? "16/9" : "9/16"
              }}
            >
              <video
                ref={ref}
                src={videoSrc}
                controls
                className={cn(
                  ratio === "16:9"
                    ? "object-cover w-full max-w-4xl max-h-[500px]"
                    : ratio === "9:16" && zoomPortrait
                      ? "object-cover h-[500px] max-h-[500px]"
                      : "object-contain h-[500px] max-h-[500px]"
                )}
                style={{
                  aspectRatio: ratio === "16:9" ? "16/9" : "9/16"
                }}
                onTimeUpdate={handleTimeUpdate}
              />
              {/* Canvas overlay for background removal compositing - pointer-events-none so video controls remain clickable */}
              {compositingActive && (
                <canvas
                  ref={canvasRef}
                  className={cn(
                    "absolute inset-0 pointer-events-none",
                    ratio === "16:9"
                      ? "w-full max-w-4xl max-h-[500px]"
                      : ratio === "9:16" && zoomPortrait
                        ? "h-[500px] max-h-[500px]"
                        : "h-[500px] max-h-[500px]"
                  )}
                  style={{
                    aspectRatio: ratio === "16:9" ? "16/9" : "9/16"
                  }}
                />
              )}
              {isSkipping && (
                <div className="absolute top-4 right-4 bg-black bg-opacity-75 text-white px-3 py-1 rounded-md text-sm font-medium">
                  Skipping disabled segment
                </div>
              )}
              {/* Only show DOM-based captions when NOT compositing (compositing draws its own) */}
              {transcript && !compositingActive && (
                <VideoCaption
                  transcript={transcript}
                  currentTime={currentTime}
                  style={subtitleStyle}
                  mode={mode}
                  ratio={ratio}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <input
              type="file"
              accept="video/*"
              onChange={handleChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <p className="mb-2">
              Drag and drop a video file here, or click to select{" "}
              <UploadIcon className="mx-auto mt-8" />
            </p>
            <p className="text-xs text-muted-foreground">
              Supports MP4 and WebM formats, max 5 minutes
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive text-center mt-2">{error}</p>
        )}
      </div>
    );
  }
);

VideoUploadComponent.displayName = "VideoUpload";

// Memoized export for better performance
export const VideoUpload = memo(VideoUploadComponent);
