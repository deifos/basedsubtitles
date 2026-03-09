"use client";

import {
  useCallback,
  useState,
  forwardRef,
  useEffect,
  memo,
  useRef,
} from "react";
import { cn, formatTime, type WordStyleOverride } from "@/lib/utils";
import { VideoCaption } from "./video-caption";
import { SubtitleStyle } from "./subtitle-styling";
import { UploadIcon, Play, Pause, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import {
  SAMPLE_FPS as SAMPLE_MASK_FPS,
  type MaskData,
} from "@/hooks/useBackgroundRemoval";
import {
  renderSubtitleToCanvas,
  renderDynamicBehindText,
  renderDynamicFrontText,
  estimateFaceFromMask,
} from "@/lib/render-subtitle";
import { computeCropX } from "@/lib/person-tracking";

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
  getCenterX?: () => number;
  isFaceTrackingActive?: boolean;
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
      getCenterX,
      isFaceTrackingActive = false,
    },
    ref,
  ) => {
    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSkipping, setIsSkipping] = useState(false);
    // Track the current blob URL so we can revoke it when it's no longer needed
    const videoObjectUrlRef = useRef<string | null>(null);
    const skipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    // Local time state: updated directly from video's timeupdate without going through main-app
    const [localTime, setLocalTime] = useState(0);
    const processedFileRef = useRef<File | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const faceTrackCanvasRef = useRef<HTMLCanvasElement>(null);
    const animFrameRef = useRef<number>(0);
    const faceTrackAnimFrameRef = useRef<number>(0);
    const blurCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const seekBarFillRef = useRef<HTMLDivElement>(null);
    const timeDisplayRef = useRef<HTMLSpanElement>(null);
    // Transient seeking state in refs — avoids re-renders during drag
    const seekingRef = useRef(false);
    const seekValueRef = useRef(0);

    // Revoke the current blob URL and clear the ref
    const revokeVideoObjectUrl = useCallback(() => {
      if (videoObjectUrlRef.current) {
        URL.revokeObjectURL(videoObjectUrlRef.current);
        videoObjectUrlRef.current = null;
      }
    }, []);

    // Clear pending timeouts on unmount
    useEffect(() => {
      return () => {
        if (skipTimeoutRef.current) clearTimeout(skipTimeoutRef.current);
      };
    }, []);

    // Sync progress bar fill + time display from currentTime prop, skip while dragging.
    // Also syncs localTime so VideoCaption reflects external seeks (sidebar clicks, reset).
    useEffect(() => {
      if (seekingRef.current) return;
      setLocalTime(currentTime);
      if (seekBarFillRef.current && duration > 0) {
        seekBarFillRef.current.style.width = `${(currentTime / duration) * 100}%`;
      }
      if (timeDisplayRef.current) {
        timeDisplayRef.current.textContent = formatTime(currentTime);
      }
    }, [currentTime, duration]);

    // Whether compositing mode is active
    const isDynamicMode =
      subtitleStyle.dynamicEnabled && bgRemovalReady && getMaskAtTime;
    const isBgRemovalMode =
      bgRemovalReady && subtitleStyle.backgroundRemovalEnabled && getMaskAtTime;
    const compositingActive = isDynamicMode || isBgRemovalMode;

    // Reset video source when ref.current.src is empty
    useEffect(() => {
      if (ref && typeof ref !== "function" && ref.current) {
        // Check if the video element has no source
        if (!ref.current.src || ref.current.src === window.location.href) {
          revokeVideoObjectUrl();
          setVideoSrc(null);
        }
      }
    }, [ref, revokeVideoObjectUrl]);

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

          const maxBytes = 1 * 1024 * 1024 * 1024; // 1 GB
          if (file.size > maxBytes) {
            throw new Error(
              `File is too large (${(file.size / 1024 / 1024 / 1024).toFixed(1)} GB). Please use a video under 1 GB to avoid running out of memory.`,
            );
          }

          // Create video element to check duration
          const video = document.createElement("video");
          video.preload = "metadata";

          // Revoke previous blob URL before creating a new one
          revokeVideoObjectUrl();
          const objectUrl = URL.createObjectURL(file);
          videoObjectUrlRef.current = objectUrl;

          await new Promise((resolve, reject) => {
            video.onloadedmetadata = resolve;
            video.onerror = reject;
            video.src = objectUrl;
          });

          // Detect aspect ratio from video dimensions
          const detectedRatio: "16:9" | "9:16" =
            video.videoHeight > video.videoWidth ? "9:16" : "16:9";

          setVideoSrc(objectUrl);
          setError(null);
          onVideoSelect(file);

          // Notify parent of detected aspect ratio
          if (onAspectRatioDetected) {
            onAspectRatioDetected(detectedRatio);
          }
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Error loading video";
          setError(message);
          toast.error(message);
          revokeVideoObjectUrl();
          setVideoSrc(null);
        }
      },
      [onVideoSelect, onAspectRatioDetected, revokeVideoObjectUrl],
    );

    const handleDrop = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();

        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      },
      [handleFile],
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);

        // Reset the input value to allow selecting the same file again
        e.target.value = "";
      },
      [handleFile],
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

      transcript.chunks.forEach((chunk) => {
        if (chunk.disabled) {
          disabledRanges.push(chunk.timestamp);
        }
      });

      // Sort ranges by start time and merge overlapping ranges
      disabledRanges.sort((a, b) => a[0] - b[0]);
      const mergedRanges: Array<[number, number]> = [];

      for (const range of disabledRanges) {
        if (
          mergedRanges.length === 0 ||
          mergedRanges[mergedRanges.length - 1][1] < range[0]
        ) {
          mergedRanges.push(range);
        } else {
          // Merge overlapping ranges
          mergedRanges[mergedRanges.length - 1][1] = Math.max(
            mergedRanges[mergedRanges.length - 1][1],
            range[1],
          );
        }
      }

      return mergedRanges;
    }, [transcript]);

    // Function to handle time updates and skip disabled segments
    const handleTimeUpdate = useCallback(
      (e: React.SyntheticEvent<HTMLVideoElement>) => {
        // During seeking the progress bar drives time — ignore video timeupdate
        if (seekingRef.current) return;

        const video = e.currentTarget;
        const time = video.currentTime;

        // Update local time for VideoCaption directly — avoids main-app round-trip re-renders
        setLocalTime(time);

        // Update seek bar + time display via refs (no React state involved)
        if (seekBarFillRef.current && duration > 0) {
          seekBarFillRef.current.style.width = `${(time / duration) * 100}%`;
        }
        if (timeDisplayRef.current) {
          timeDisplayRef.current.textContent = formatTime(time);
        }

        // Notify main-app (throttled to chunk boundaries inside main-app)
        onTimeUpdate?.(time);

        // Skip disabled segments
        if (!isSkipping && transcript) {
          const disabledRanges = getDisabledRanges();

          for (const [start, end] of disabledRanges) {
            // If current time is within a disabled range, skip to the end
            if (time >= start && time < end) {
              setIsSkipping(true);
              video.currentTime = end + 0.1; // Add small buffer to avoid edge cases

              // Reset skipping flag after a short delay
              if (skipTimeoutRef.current) clearTimeout(skipTimeoutRef.current);
              skipTimeoutRef.current = setTimeout(() => {
                setIsSkipping(false);
              }, 100);
              break;
            }
          }
        }
      },
      [onTimeUpdate, transcript, isSkipping, getDisabledRanges, duration],
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

      const videoEl = ref && typeof ref !== "function" ? ref.current : null;
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
      // Track last mask reference — skip expensive pixel conversion when mask hasn't changed (5fps cache)
      let lastMask: ReturnType<typeof getMaskAtTime> = null;

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

        // Look ahead by half a frame interval so the mask is centered around the
        // current time rather than always lagging behind (reduces perceived lag by ~50%).
        const mask = getMaskAtTime!(time + 0.5 / SAMPLE_MASK_FPS);

        // Compute center-crop region when canvas AR differs from video AR
        // (e.g. landscape video shown in a 9:16 container with object-cover)
        const vw = videoEl.videoWidth;
        const vh = videoEl.videoHeight;
        const w = canvas.width;
        const h = canvas.height;
        const canvasAR = w / h;
        const videoAR = vw / vh;
        let sx = 0,
          sy = 0,
          sw = vw,
          sh = vh;
        if (Math.abs(canvasAR - videoAR) > 0.01) {
          if (videoAR > canvasAR) {
            // Video is wider — crop sides
            sw = Math.round(vh * canvasAR);
            if (isFaceTrackingActive && getCenterX) {
              sx = computeCropX(getCenterX(), vw, sw);
            } else {
              sx = Math.round((vw - sw) / 2);
            }
          } else {
            // Video is taller — crop top/bottom
            sh = Math.round(vw / canvasAR);
            sy = Math.round((vh - sh) / 2);
          }
        }

        if (!mask) {
          ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, w, h);
          animFrameRef.current = requestAnimationFrame(render);
          return;
        }

        const isDynamic = subtitleStyle.dynamicEnabled;

        // Step 1: Draw background layer
        if (isDynamic) {
          // Dynamic mode: keep original video as background
          ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, w, h);
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

          // Draw video frame onto foreground canvas (with crop)
          fgCtx.clearRect(0, 0, w, h);
          fgCtx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, w, h);

          // Resize mask canvas only when mask dimensions change
          if (
            maskCanvas.width !== mask.width ||
            maskCanvas.height !== mask.height
          ) {
            maskCanvas.width = mask.width;
            maskCanvas.height = mask.height;
          }

          // Only re-process mask pixels when the mask reference changes (5fps cache → skip ~55/60 frames)
          if (mask !== lastMask) {
            lastMask = mask;

            if (lastMaskW !== mask.width || lastMaskH !== mask.height) {
              cachedMaskImageData = maskCtx.createImageData(
                mask.width,
                mask.height,
              );
              lastMaskW = mask.width;
              lastMaskH = mask.height;
            }

            const maskImageData = cachedMaskImageData!;
            const pixels = maskImageData.data;
            for (let i = 0; i < mask.data.length; i++) {
              const idx = i * 4;
              pixels[idx] = 255; // R
              pixels[idx + 1] = 255; // G
              pixels[idx + 2] = 255; // B
              pixels[idx + 3] = mask.data[i]; // A = mask alpha
            }
            maskCtx.putImageData(maskImageData, 0, 0);
          }

          // Use destination-in to clip the video frame to the mask shape.
          // Apply the same crop as the video so the mask aligns with the
          // visible region (e.g. landscape → portrait center/face-track crop).
          fgCtx.globalCompositeOperation = "destination-in";
          const msx = (sx / vw) * maskCanvas.width;
          const msy = (sy / vh) * maskCanvas.height;
          const msw = (sw / vw) * maskCanvas.width;
          const msh = (sh / vh) * maskCanvas.height;
          fgCtx.drawImage(maskCanvas, msx, msy, msw, msh, 0, 0, w, h);
          fgCtx.globalCompositeOperation = "source-over";

          // Draw masked foreground onto main canvas
          ctx.drawImage(fgCanvas, 0, 0);
        }

        // Step 4: Render front text (dynamic) or on-top text (non-dynamic)
        if (isDynamic && transcript) {
          const faceBounds = estimateFaceFromMask(
            mask.data,
            mask.width,
            mask.height,
            w,
            h,
          );
          renderDynamicFrontText(
            ctx,
            transcript,
            time,
            subtitleStyle,
            w,
            h,
            faceBounds,
          );
        } else if (transcript) {
          renderSubtitleToCanvas(
            ctx,
            transcript,
            time,
            subtitleStyle,
            mode,
            w,
            h,
          );
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
    }, [
      compositingActive,
      ref,
      subtitleStyle,
      transcript,
      mode,
      getMaskAtTime,
      isFaceTrackingActive,
      getCenterX,
    ]);

    // Non-compositing face tracking canvas loop:
    // When face tracking is active but compositing is NOT active,
    // render a canvas that mirrors the video with dynamic crop.
    const needsFaceTrackCanvas =
      isFaceTrackingActive && !compositingActive && ratio === "9:16";

    useEffect(() => {
      if (!needsFaceTrackCanvas || !faceTrackCanvasRef.current) {
        if (faceTrackAnimFrameRef.current) {
          cancelAnimationFrame(faceTrackAnimFrameRef.current);
          faceTrackAnimFrameRef.current = 0;
        }
        return;
      }

      const videoEl = ref && typeof ref !== "function" ? ref.current : null;
      if (!videoEl) return;

      const canvas = faceTrackCanvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      let lastRenderedTime = -1;

      const render = () => {
        if (!videoEl) {
          faceTrackAnimFrameRef.current = requestAnimationFrame(render);
          return;
        }

        const time = videoEl.currentTime;
        if (videoEl.paused && time === lastRenderedTime) {
          faceTrackAnimFrameRef.current = requestAnimationFrame(render);
          return;
        }
        lastRenderedTime = time;

        const displayWidth = canvas.clientWidth;
        const displayHeight = canvas.clientHeight;
        if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
          canvas.width = displayWidth;
          canvas.height = displayHeight;
        }

        const vw = videoEl.videoWidth;
        const vh = videoEl.videoHeight;
        const w = canvas.width;
        const h = canvas.height;
        const canvasAR = w / h;
        const videoAR = vw / vh;

        let sx = 0,
          sy = 0,
          sw = vw,
          sh = vh;
        if (videoAR > canvasAR) {
          sw = Math.round(vh * canvasAR);
          sx = getCenterX
            ? computeCropX(getCenterX(), vw, sw)
            : Math.round((vw - sw) / 2);
        } else if (videoAR < canvasAR) {
          sh = Math.round(vw / canvasAR);
          sy = Math.round((vh - sh) / 2);
        }

        ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, w, h);
        faceTrackAnimFrameRef.current = requestAnimationFrame(render);
      };

      faceTrackAnimFrameRef.current = requestAnimationFrame(render);

      return () => {
        if (faceTrackAnimFrameRef.current) {
          cancelAnimationFrame(faceTrackAnimFrameRef.current);
          faceTrackAnimFrameRef.current = 0;
        }
      };
    }, [needsFaceTrackCanvas, ref, ratio, getCenterX]);

    return (
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg transition-colors overflow-hidden",
          videoSrc ? "" : "min-h-[300px]",
          className,
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
                ratio === "16:9" ? "w-full" : "w-auto",
              )}
            >
              <div
                className={cn(
                  "relative flex justify-center",
                  ratio === "16:9" && "max-h-[500px]",
                )}
                style={{
                  aspectRatio: ratio === "16:9" ? "16/9" : "9/16",
                }}
              >
                <video
                  ref={ref}
                  src={videoSrc}
                  playsInline
                  preload="auto"
                  className={cn(
                    ratio === "16:9"
                      ? "object-cover w-full max-w-4xl max-h-[500px]"
                      : ratio === "9:16" && !zoomPortrait
                        ? "object-cover h-[500px] max-h-[500px]"
                        : "object-contain h-[500px] max-h-[500px]",
                    needsFaceTrackCanvas && "invisible",
                  )}
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onLoadedMetadata={(e) =>
                    setDuration(e.currentTarget.duration)
                  }
                  onClick={() => {
                    if (!compositingActive && !needsFaceTrackCanvas) {
                      const videoEl =
                        ref && typeof ref !== "function" ? ref.current : null;
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
                          : "h-[500px] max-h-[500px] mx-auto",
                    )}
                    style={{
                      aspectRatio: ratio === "16:9" ? "16/9" : "9/16",
                    }}
                    onClick={() => {
                      const videoEl =
                        ref && typeof ref !== "function" ? ref.current : null;
                      if (videoEl) {
                        if (videoEl.paused) videoEl.play().catch(() => {});
                        else videoEl.pause();
                      }
                    }}
                  />
                )}
                {/* Canvas overlay for face-tracking crop (non-compositing mode) */}
                {needsFaceTrackCanvas && (
                  <canvas
                    ref={faceTrackCanvasRef}
                    className={cn(
                      "absolute inset-0 cursor-pointer",
                      ratio === "9:16" && zoomPortrait
                        ? "h-[500px] max-h-[500px] mx-auto"
                        : "h-[500px] max-h-[500px] mx-auto",
                    )}
                    style={{
                      aspectRatio: "9/16",
                    }}
                    onClick={() => {
                      const videoEl =
                        ref && typeof ref !== "function" ? ref.current : null;
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
                    currentTime={localTime}
                    style={subtitleStyle}
                    mode={mode}
                    ratio={ratio}
                    getFaceX={getCenterX}
                  />
                )}
              </div>
              {/* Custom player controls — always visible */}
              <div className="flex items-center gap-2 px-3 py-2 bg-black/90 rounded-b-lg w-full">
                {/* Play/Pause */}
                <button
                  onClick={() => {
                    const videoEl =
                      ref && typeof ref !== "function" ? ref.current : null;
                    if (videoEl) {
                      if (videoEl.paused) videoEl.play().catch(() => {});
                      else videoEl.pause();
                    }
                  }}
                  className="text-white hover:text-white/80 transition-colors shrink-0"
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </button>

                {/* Time — updated via ref during drag to avoid re-renders */}
                <span
                  ref={timeDisplayRef}
                  className="text-white text-xs tabular-nums shrink-0"
                >
                  {formatTime(currentTime)}
                </span>

                {/* Custom progress bar — div-based with pointer capture for reliable mobile touch.
                    No pause/resume during drag (avoids mobile autoplay restrictions).
                    Seeks video only on release (avoids overwhelming mobile decoder).
                    Calls onTimeUpdate during drag so subtitles stay in sync. */}
                <div
                  role="slider"
                  tabIndex={0}
                  aria-valuemin={0}
                  aria-valuemax={duration || 1}
                  aria-valuenow={currentTime}
                  aria-label="Seek"
                  className="flex-1 h-8 flex items-center cursor-pointer touch-none select-none"
                  onPointerDown={(e) => {
                    seekingRef.current = true;
                    e.currentTarget.setPointerCapture(e.pointerId);

                    const rect = e.currentTarget.getBoundingClientRect();
                    const fraction = Math.max(
                      0,
                      Math.min(1, (e.clientX - rect.left) / rect.width),
                    );
                    const time = fraction * (duration || 1);
                    seekValueRef.current = time;

                    if (seekBarFillRef.current)
                      seekBarFillRef.current.style.width = `${fraction * 100}%`;
                    if (timeDisplayRef.current)
                      timeDisplayRef.current.textContent = formatTime(time);
                    setLocalTime(time);
                    onTimeUpdate?.(time);
                  }}
                  onPointerMove={(e) => {
                    if (!seekingRef.current) return;

                    const rect = e.currentTarget.getBoundingClientRect();
                    const fraction = Math.max(
                      0,
                      Math.min(1, (e.clientX - rect.left) / rect.width),
                    );
                    const time = fraction * (duration || 1);
                    seekValueRef.current = time;

                    if (seekBarFillRef.current)
                      seekBarFillRef.current.style.width = `${fraction * 100}%`;
                    if (timeDisplayRef.current)
                      timeDisplayRef.current.textContent = formatTime(time);
                    setLocalTime(time);
                    onTimeUpdate?.(time);
                  }}
                  onPointerUp={() => {
                    seekingRef.current = false;
                    const videoEl =
                      ref && typeof ref !== "function" ? ref.current : null;
                    if (videoEl) {
                      videoEl.currentTime = seekValueRef.current;
                    }
                  }}
                  onLostPointerCapture={() => {
                    // Fallback if pointer capture is lost (e.g. browser tab switch)
                    if (seekingRef.current) {
                      seekingRef.current = false;
                      const videoEl =
                        ref && typeof ref !== "function" ? ref.current : null;
                      if (videoEl) {
                        videoEl.currentTime = seekValueRef.current;
                      }
                    }
                  }}
                  onKeyDown={(e) => {
                    const videoEl =
                      ref && typeof ref !== "function" ? ref.current : null;
                    if (!videoEl) return;
                    if (e.key === "ArrowLeft") {
                      videoEl.currentTime = Math.max(
                        0,
                        videoEl.currentTime - 5,
                      );
                      e.preventDefault();
                    } else if (e.key === "ArrowRight") {
                      videoEl.currentTime = Math.min(
                        duration,
                        videoEl.currentTime + 5,
                      );
                      e.preventDefault();
                    }
                  }}
                >
                  <div className="relative w-full h-1 bg-white/30 rounded-full overflow-hidden">
                    <div
                      ref={seekBarFillRef}
                      className="absolute inset-y-0 left-0 bg-white rounded-full"
                    />
                  </div>
                </div>

                {/* Duration */}
                <span className="text-white text-xs tabular-nums shrink-0">
                  {formatTime(duration)}
                </span>

                {/* Mute toggle */}
                <button
                  onClick={() => {
                    const videoEl =
                      ref && typeof ref !== "function" ? ref.current : null;
                    if (videoEl) {
                      videoEl.muted = !videoEl.muted;
                      setIsMuted(!isMuted);
                    }
                  }}
                  className="text-white hover:text-white/80 transition-colors shrink-0"
                >
                  {isMuted ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
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
              Supports MP4, WebM, and MOV formats, max 1 GB
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive text-center mt-2">{error}</p>
        )}
      </div>
    );
  },
);

VideoUploadComponent.displayName = "VideoUpload";

// Memoized export for better performance
export const VideoUpload = memo(VideoUploadComponent);
