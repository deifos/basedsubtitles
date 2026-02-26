"use client";

import { useCallback, useState, forwardRef, useEffect, memo, useRef } from "react";
import { cn, formatTime, type WordStyleOverride } from "@/lib/utils";
import { VideoCaption } from "./video-caption";
import { SubtitleStyle } from "./subtitle-styling";
import { UploadIcon, Play, Pause, Volume2, VolumeX } from "lucide-react";
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
      subtitleHidden?: boolean;
      styleOverride?: WordStyleOverride;
    }>;
  } | null;
  currentTime?: number;
  subtitleStyle: SubtitleStyle;
  mode: "word" | "phrase";
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
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const processedFileRef = useRef<File | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animFrameRef = useRef<number>(0);
    const blurCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const seekBarRef = useRef<HTMLInputElement>(null);

    // Whether compositing mode is active
    const isDynamicMode = subtitleStyle.dynamicEnabled && bgRemovalReady && getMaskAtTime;
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
      const fgCtx = fgCanvas.getContext("2d");
      const maskCanvas = document.createElement("canvas");
      const maskCtx = maskCanvas.getContext("2d");

      // Reusable ImageData for mask — avoids allocating ~8MB per frame
      let cachedMaskImageData: ImageData | null = null;
      let lastMaskW = 0;
      let lastMaskH = 0;

      // Track last rendered time to skip redundant draws when paused
      let lastRenderedTime = -1;

      const render = () => {
        if (!videoEl) {
          animFrameRef.current = requestAnimationFrame(render);
          return;
        }

        const time = videoEl.currentTime;

        // Skip rendering when paused and we already drew this frame
        if (videoEl.paused && time === lastRenderedTime) {
          animFrameRef.current = requestAnimationFrame(render);
          return;
        }
        lastRenderedTime = time;

        // Match canvas to displayed size
        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
          canvas.width = displayWidth;
          canvas.height = displayHeight;
        }

        const mask = getMaskAtTime!(time);

        if (!mask) {
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          animFrameRef.current = requestAnimationFrame(render);
          return;
        }

        const w = canvas.width;
        const h = canvas.height;
        const isDynamic = subtitleStyle.dynamicEnabled;

        // Step 1: Draw background layer
        if (isDynamic) {
          // Dynamic mode: keep original video as background
          ctx.drawImage(videoEl, 0, 0, w, h);
        } else if (subtitleStyle.backgroundType === "blur") {
          const blurCanvas = blurCanvasRef.current!;
          if (blurCanvas.width !== w || blurCanvas.height !== h) {
            blurCanvas.width = w;
            blurCanvas.height = h;
          }
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

        // Step 2: Render subtitle behind person (dynamic mode only)
        if (isDynamic && transcript) {
          renderDynamicBehindText(ctx, transcript, time, subtitleStyle, w, h);
        }

        // Step 3: Draw masked foreground using canvas compositing
        if (fgCtx && maskCtx) {
          if (fgCanvas.width !== w || fgCanvas.height !== h) {
            fgCanvas.width = w;
            fgCanvas.height = h;
          }

          // Draw video frame onto foreground canvas
          fgCtx.clearRect(0, 0, w, h);
          fgCtx.drawImage(videoEl, 0, 0, w, h);

          // Resize mask canvas only when mask dimensions change
          if (maskCanvas.width !== mask.width || maskCanvas.height !== mask.height) {
            maskCanvas.width = mask.width;
            maskCanvas.height = mask.height;
          }

          // Reuse ImageData if dimensions match, otherwise create new one
          if (lastMaskW !== mask.width || lastMaskH !== mask.height) {
            cachedMaskImageData = maskCtx.createImageData(mask.width, mask.height);
            lastMaskW = mask.width;
            lastMaskH = mask.height;
          }

          const maskImageData = cachedMaskImageData!;
          const pixels = maskImageData.data;
          for (let i = 0; i < mask.data.length; i++) {
            const idx = i * 4;
            pixels[idx] = 255;     // R
            pixels[idx + 1] = 255; // G
            pixels[idx + 2] = 255; // B
            pixels[idx + 3] = mask.data[i]; // A = mask alpha
          }
          maskCtx.putImageData(maskImageData, 0, 0);

          // Use destination-in to clip the video frame to the mask shape
          fgCtx.globalCompositeOperation = "destination-in";
          fgCtx.drawImage(maskCanvas, 0, 0, w, h);
          fgCtx.globalCompositeOperation = "source-over";

          // Draw masked foreground onto main canvas
          ctx.drawImage(fgCanvas, 0, 0);
        }

        // Step 4: Render front text (dynamic) or on-top text (non-dynamic)
        if (isDynamic && transcript) {
          const faceBounds = estimateFaceFromMask(mask.data, mask.width, mask.height, w, h);
          renderDynamicFrontText(ctx, transcript, time, subtitleStyle, w, h, faceBounds);
        } else if (transcript) {
          renderSubtitleToCanvas(ctx, transcript, time, subtitleStyle, mode, w, h);
        }

        // Step 5: Branding watermark
        if (subtitleStyle.brandingWatermark) {
          const fontSize = Math.max(10, Math.round(h * 0.012));
          const padding = w * 0.03;
          ctx.save();
          ctx.font = `700 ${fontSize}px system-ui, -apple-system, sans-serif`;
          ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
          ctx.textAlign = "left";
          ctx.textBaseline = "bottom";
          ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
          ctx.shadowBlur = 3;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 1;
          ctx.fillText("basedsubs.getbasedapps.com", padding, h - h * 0.03);
          ctx.restore();
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
          <div className="relative flex flex-col items-center justify-center w-full">
            <div
              className={cn(
                "relative mx-auto flex flex-col",
                ratio === "16:9" ? "w-full" : "w-auto"
              )}
            >
            <div
              className="relative flex justify-center"
              style={{
                aspectRatio: ratio === "16:9" ? "16/9" : "9/16"
              }}
            >
              <video
                ref={ref}
                src={videoSrc}
                playsInline
                className={cn(
                  ratio === "16:9"
                    ? "object-cover w-full max-w-4xl max-h-[500px]"
                    : ratio === "9:16" && zoomPortrait
                      ? "object-cover h-[500px] max-h-[500px]"
                      : "object-contain h-[500px] max-h-[500px]"
                )}
                onTimeUpdate={handleTimeUpdate}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onClick={() => {
                  if (!compositingActive) {
                    const videoEl = ref && typeof ref !== "function" ? ref.current : null;
                    if (videoEl) {
                      if (videoEl.paused) videoEl.play().catch(() => {});
                      else videoEl.pause();
                    }
                  }
                }}
                style={{
                  aspectRatio: ratio === "16:9" ? "16/9" : "9/16",
                  cursor: "pointer",
                }}
              />
              {/* Canvas overlay for background removal compositing */}
              {compositingActive && (
                <canvas
                  ref={canvasRef}
                  className={cn(
                    "absolute inset-0 cursor-pointer",
                    ratio === "16:9"
                      ? "w-full max-w-4xl max-h-[500px] mx-auto"
                      : ratio === "9:16" && zoomPortrait
                        ? "h-[500px] max-h-[500px] mx-auto"
                        : "h-[500px] max-h-[500px] mx-auto"
                  )}
                  style={{
                    aspectRatio: ratio === "16:9" ? "16/9" : "9/16",
                  }}
                  onClick={() => {
                    const videoEl = ref && typeof ref !== "function" ? ref.current : null;
                    if (videoEl) {
                      if (videoEl.paused) videoEl.play().catch(() => {});
                      else videoEl.pause();
                    }
                  }}
                />
              )}
              {isSkipping && (
                <div className="absolute top-4 right-4 bg-black bg-opacity-75 text-white px-3 py-1 rounded-md text-sm font-medium z-10">
                  Skipping disabled segment
                </div>
              )}
              {/* Branding watermark DOM overlay (non-compositing mode) */}
              {subtitleStyle.brandingWatermark && !compositingActive && (
                <div
                  className="absolute bottom-[3%] left-[3%] pointer-events-none z-20"
                  style={{
                    fontSize: "clamp(8px, 1.2vw, 13px)",
                    fontWeight: 700,
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    color: "rgba(255, 255, 255, 0.6)",
                    textShadow: "0 1px 3px rgba(0, 0, 0, 0.5)",
                    letterSpacing: "0.02em",
                  }}
                >
                  basedsubs.getbasedapps.com
                </div>
              )}
              {/* DOM-based captions: visible when not compositing, invisible hit-targets when compositing + word select active */}
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
            {/* Custom player controls — always visible */}
              <div className="flex items-center gap-2 px-3 py-2 bg-black/90 rounded-b-lg w-full">
                {/* Play/Pause */}
                <button
                  onClick={() => {
                    const videoEl = ref && typeof ref !== "function" ? ref.current : null;
                    if (videoEl) {
                      if (videoEl.paused) videoEl.play().catch(() => {});
                      else videoEl.pause();
                    }
                  }}
                  className="text-white hover:text-white/80 transition-colors shrink-0"
                >
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>

                {/* Time */}
                <span className="text-white text-xs tabular-nums shrink-0">
                  {formatTime(currentTime)}
                </span>

                {/* Seek bar */}
                <input
                  ref={seekBarRef}
                  type="range"
                  min={0}
                  max={duration || 1}
                  step={0.1}
                  value={currentTime}
                  onChange={(e) => {
                    const videoEl = ref && typeof ref !== "function" ? ref.current : null;
                    if (videoEl) {
                      videoEl.currentTime = parseFloat(e.target.value);
                    }
                  }}
                  className="flex-1 h-1 appearance-none bg-white/30 rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0"
                />

                {/* Duration */}
                <span className="text-white text-xs tabular-nums shrink-0">
                  {formatTime(duration)}
                </span>

                {/* Mute toggle */}
                <button
                  onClick={() => {
                    const videoEl = ref && typeof ref !== "function" ? ref.current : null;
                    if (videoEl) {
                      videoEl.muted = !videoEl.muted;
                      setIsMuted(!isMuted);
                    }
                  }}
                  className="text-white hover:text-white/80 transition-colors shrink-0"
                >
                  {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              </div>
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
