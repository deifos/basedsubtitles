import { useState, useCallback, useRef } from "react";
import {
  Input,
  Output,
  CanvasSource,
  AudioBufferSource,
  Mp4OutputFormat,
  WebMOutputFormat,
  BufferTarget,
  BlobSource,
  VideoSampleSink,
  VideoSample,
  ALL_FORMATS,
  QUALITY_HIGH,
  QUALITY_MEDIUM,
  QUALITY_LOW,
  QUALITY_VERY_HIGH,
  Conversion,
} from "mediabunny";
import { SubtitleStyle } from "@/components/subtitle-styling";
import { processTranscriptChunks, type WordStyleOverride } from "@/lib/utils";
import { estimateFaceFromMask, type FaceBounds } from "@/lib/render-subtitle";
import type { MaskData } from "@/hooks/useBackgroundRemoval";
import {
  type PositionTimeline,
  interpolateCenterX,
  computeCropX,
} from "@/lib/person-tracking";

// Shared font mapping — CSS custom properties to actual font names for Canvas rendering
const FONT_MAPPINGS: Record<string, string> = {
  "var(--font-bangers)": "Bangers",
  "var(--font-montserrat)": "Montserrat",
  "var(--font-inter)": "Inter",
  "var(--font-bebas-neue)": "Bebas Neue",
  "var(--font-poppins)": "Poppins",
  "var(--font-open-sans)": "Open Sans",
  "var(--font-oswald)": "Oswald",
  "var(--font-anton)": "Anton",
  "var(--font-fredoka)": "Fredoka",
  "var(--font-righteous)": "Righteous",
  "var(--font-nunito)": "Nunito",
  "var(--font-roboto)": "Roboto",
  "var(--font-permanent-marker)": "Permanent Marker",
  "var(--font-pacifico)": "Pacifico",
  "var(--font-lobster)": "Lobster",
  "var(--font-alfa-slab-one)": "Alfa Slab One",
  "var(--font-staatliches)": "Staatliches",
  "var(--font-fugaz-one)": "Fugaz One",
  "var(--font-chewy)": "Chewy",
  "var(--font-playfair-display)": "Playfair Display",
  "var(--font-lora)": "Lora",
  "var(--font-plus-jakarta-sans)": "Plus Jakarta Sans",
  "var(--font-outfit)": "Outfit",
  "var(--font-lilita-one)": "Lilita One",
};

/** Resolve CSS var(--font-*) to actual font name for Canvas */
function resolveFontFamily(fontFamily: string): string {
  if (!fontFamily.includes("var(")) return fontFamily;
  for (const [cssVar, actualFont] of Object.entries(FONT_MAPPINGS)) {
    if (fontFamily.includes(cssVar)) {
      return fontFamily.replace(cssVar, actualFont);
    }
  }
  const fallbackMatch = fontFamily.match(/,\s*(.+)$/);
  return fallbackMatch ? fallbackMatch[1] : "Arial, sans-serif";
}

// Types
interface TranscriptChunk {
  text: string;
  timestamp: [number, number];
  disabled?: boolean;
  subtitleHidden?: boolean;
  dynamicPosition?: "behind" | "front";
  styleOverride?: WordStyleOverride;
  words?: WordTiming[];
}

interface UseVideoDownloadMediaBunnyProps {
  video: HTMLVideoElement | null;
  transcriptChunks: TranscriptChunk[];
  subtitleStyle: SubtitleStyle;
  mode: "word" | "phrase";
  ratio?: "16:9" | "9:16";
  format?: "mp4" | "webm";
  quality?: "low" | "medium" | "high" | "very_high";
  fps?: number;
  bgRemovalReady?: boolean;
  processFrame?: (
    imageData: Uint8ClampedArray,
    width: number,
    height: number,
    frameIndex: number,
  ) => Promise<MaskData>;
  getMaskAtTime?: (time: number, fps?: number) => MaskData | null;
  buildExportTimeline?: (
    videoElement: HTMLVideoElement,
  ) => Promise<PositionTimeline>;
}

// Quality mapping
const qualityMap = {
  low: QUALITY_LOW,
  medium: QUALITY_MEDIUM,
  high: QUALITY_HIGH,
  very_high: QUALITY_VERY_HIGH,
} as const;

interface WordTiming {
  text: string;
  timestamp: [number, number];
  dynamicPosition?: "behind" | "front";
  styleOverride?: WordStyleOverride;
}

type ProcessedChunk = ReturnType<typeof processTranscriptChunks>[number];

function isPhraseChunk(
  chunk: ProcessedChunk,
): chunk is ProcessedChunk & { words: WordTiming[] } {
  return Array.isArray((chunk as { words?: WordTiming[] }).words);
}

function drawBrandingWatermark(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  enabled?: boolean,
) {
  if (!enabled) return;
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

const LETTER_SPACING_EM = 0.05;
const HIGHLIGHT_SPACE_EM = 0.35;
const WORD_PADDING_X_EM = 0.15;
const WORD_PADDING_Y_EM = 0.08;
const HIGHLIGHT_RADIUS_EM = 0.35;
const WORD_EMPHASIS_SCALE = 1.18;
const HIGHLIGHT_BG_ALPHA = 0.65;

export function useVideoDownloadMediaBunny({
  video,
  transcriptChunks,
  subtitleStyle,
  mode,
  ratio = "16:9",
  format = "mp4",
  quality = "high",
  fps = 30,
  bgRemovalReady = false,
  processFrame: bgProcessFrame,
  getMaskAtTime,
  buildExportTimeline,
}: UseVideoDownloadMediaBunnyProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>("");
  const cancelContextRef = useRef<{
    cancelRequested: boolean;
    output: Output | null;
    videoSource: CanvasSource | null;
  }>({ cancelRequested: false, output: null, videoSource: null });

  const downloadVideo = useCallback(async () => {
    if (!video?.src || transcriptChunks.length === 0) {
      console.error("Missing video or transcript data");
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setStatus("Initializing MediaBunny...");
    cancelContextRef.current.cancelRequested = false;
    cancelContextRef.current.output = null;
    cancelContextRef.current.videoSource = null;

    let cancelled = false;

    // Declare reusable buffers outside try so finally can null them for GC
    let reusableBlurCanvas: HTMLCanvasElement | null = null;
    let reusableFgCanvas: HTMLCanvasElement | null = null;
    let reusableMaskCanvas: HTMLCanvasElement | null = null;
    let reusableMaskImageData: ImageData | null = null;
    let reusableFrameCanvas: HTMLCanvasElement | null = null;
    let reusableFrameCtx: CanvasRenderingContext2D | null = null;
    let decodeCanvas: HTMLCanvasElement | null = null;
    let decodeCtx: CanvasRenderingContext2D | null = null;

    try {
      // Create canvas matching video dimensions, capped on mobile to prevent
      // canvas memory overflow. Mobile browsers limit total canvas memory;
      // the export pipeline creates multiple full-res offscreen canvases
      // (main + frame + blur + fg + mask) which can silently degrade quality
      // when exceeding the budget (e.g. 5× 4K canvases ≈ 165 MB).
      const canvas = document.createElement("canvas");
      let exportWidth = video.videoWidth;
      let exportHeight = video.videoHeight;
      const srcW = video.videoWidth;
      const srcH = video.videoHeight;
      const isLandscape = srcW > srcH;

      // When the user chose 9:16 on a landscape video, center-crop to portrait
      let cropX = 0;
      let cropY = 0;
      let cropW = srcW;
      let cropH = srcH;
      if (ratio === "9:16" && isLandscape) {
        // Target aspect ratio 9:16 — crop width to match, keep full height
        const targetW = Math.round(srcH * (9 / 16));
        cropX = Math.round((srcW - targetW) / 2);
        cropW = targetW;
        exportWidth = cropW;
        exportHeight = cropH;
      }

      // Ensure a minimum export resolution — low-res sources (e.g. 720p webcam
      // cropped to 9:16 → 405×720) get scaled up so the output isn't tiny.
      const MIN_EXPORT_DIMENSION = 1080;
      if (Math.max(exportWidth, exportHeight) < MIN_EXPORT_DIMENSION) {
        const scale =
          MIN_EXPORT_DIMENSION / Math.max(exportWidth, exportHeight);
        exportWidth = Math.round(exportWidth * scale);
        exportHeight = Math.round(exportHeight * scale);
      }

      const isMobile =
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 0 && window.innerWidth < 1024);
      const MAX_MOBILE_DIMENSION = 1920; // cap at 1080p
      if (
        isMobile &&
        Math.max(exportWidth, exportHeight) > MAX_MOBILE_DIMENSION
      ) {
        const scale =
          MAX_MOBILE_DIMENSION / Math.max(exportWidth, exportHeight);
        exportWidth = Math.round(exportWidth * scale);
        exportHeight = Math.round(exportHeight * scale);
      }

      // H.264 requires even dimensions
      exportWidth = exportWidth % 2 === 0 ? exportWidth : exportWidth - 1;
      exportHeight = exportHeight % 2 === 0 ? exportHeight : exportHeight - 1;

      canvas.width = exportWidth;
      canvas.height = exportHeight;
      const needsCrop = ratio === "9:16" && isLandscape;

      // Build face tracking timeline for dynamic crop during export
      let faceTimeline: PositionTimeline | null = null;
      if (needsCrop && buildExportTimeline) {
        setStatus("Analyzing face positions...");
        faceTimeline = await buildExportTimeline(video);
      }

      // For crop mode, sample.draw() doesn't support source crop, so decode
      // to a full-resolution canvas first, then blit the cropped region.
      if (needsCrop) {
        decodeCanvas = document.createElement("canvas");
        decodeCanvas.width = srcW;
        decodeCanvas.height = srcH;
        decodeCtx = decodeCanvas.getContext("2d");
      }

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Failed to create canvas context");
      }

      // Setup MediaBunny input
      setStatus("Reading original video...");
      const videoBlob = await fetch(video.src).then((r) => r.blob());
      using input = new Input({
        source: new BlobSource(videoBlob),
        formats: ALL_FORMATS,
      });

      // Get video metadata
      const duration = await input.computeDuration();
      const originalVideoTrack = await input.getPrimaryVideoTrack();
      const originalAudioTrack = await input.getPrimaryAudioTrack();

      const outputFormat =
        format === "webm"
          ? new WebMOutputFormat()
          : new Mp4OutputFormat({ fastStart: "in-memory" });
      const output = new Output({
        format: outputFormat,
        target: new BufferTarget(),
      });
      cancelContextRef.current.output = output;

      // Add video track
      const videoSource = new CanvasSource(canvas, {
        codec: format === "webm" ? "vp9" : "avc",
        bitrate: qualityMap[quality],
      });
      output.addVideoTrack(videoSource, { frameRate: fps });
      cancelContextRef.current.videoSource = videoSource;

      // Handle audio if present
      let audioSource: AudioBufferSource | null = null;
      if (originalAudioTrack) {
        setStatus("Processing audio...");
        let audioContext: AudioContext | null = null;
        try {
          const arrayBuffer = await videoBlob.arrayBuffer();
          audioContext = new (
            window.AudioContext || (window as any).webkitAudioContext
          )();
          const audioBuffer = await audioContext.decodeAudioData(
            arrayBuffer.slice(0),
          );

          audioSource = new AudioBufferSource({
            codec: format === "webm" ? "opus" : "aac",
            bitrate: 128_000,
          });
          output.addAudioTrack(audioSource);

          // Start output and add audio
          await output.start();
          await audioSource.add(audioBuffer);
          audioSource.close();
        } catch (error) {
          await output.start();
        } finally {
          // Always close AudioContext to free audio memory
          if (audioContext) {
            try {
              await audioContext.close();
            } catch {}
          }
        }
      } else {
        await output.start();
      }

      let videoSampleSink: VideoSampleSink | null = null;
      if (originalVideoTrack && (await originalVideoTrack.canDecode())) {
        videoSampleSink = new VideoSampleSink(originalVideoTrack);
      }

      // Process chunks according to mode (word/phrase) and filter enabled ones
      // When dynamic is enabled, use phrase mode with dynamicEnabled flag
      const isDynamic = subtitleStyle.dynamicEnabled;
      const processedChunks = processTranscriptChunks(
        { chunks: transcriptChunks },
        isDynamic ? "phrase" : mode,
        subtitleStyle.maxWordsPerLine,
        isDynamic,
      );
      const enabledChunks = processedChunks.filter((chunk) => {
        if ((mode === "phrase" || isDynamic) && isPhraseChunk(chunk)) {
          return !chunk.words.some((word) => {
            const originalChunk = transcriptChunks.find(
              (candidate) =>
                candidate.timestamp[0] === word.timestamp[0] &&
                candidate.timestamp[1] === word.timestamp[1],
            );
            return originalChunk?.disabled || originalChunk?.subtitleHidden;
          });
        }
        return !chunk.disabled && !chunk.subtitleHidden;
      });

      const totalFrames = Math.ceil(duration * fps);
      setStatus("Rendering video frames...");

      const timestampIterator = (async function* () {
        for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
          yield frameIndex / fps;
        }
      })();

      const sampleIterator = videoSampleSink
        ? videoSampleSink.samplesAtTimestamps(timestampIterator)
        : null;
      let iteratorResult: IteratorResult<VideoSample | null> | undefined;

      // Reusable canvases/buffers are declared before try block for cleanup in finally

      // Render each frame
      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        if (cancelContextRef.current.cancelRequested) {
          cancelled = true;
          setStatus("Cancelling download...");
          break;
        }

        const time = frameIndex / fps;

        // Update progress (convert to percentage 0-100)
        const progressPercent = Math.min(100, (frameIndex / totalFrames) * 100);
        if (frameIndex % 3 === 0 || frameIndex === totalFrames - 1) {
          setProgress(progressPercent);
          setStatus(
            `Rendering: ${Math.round(time)}s / ${Math.round(duration)}s (${Math.round(progressPercent)}%)`,
          );
        }

        // Compute per-frame crop X (face tracking or static center)
        const frameCropX = faceTimeline
          ? computeCropX(interpolateCenterX(faceTimeline, time), srcW, cropW)
          : cropX;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw video frame using iterator to avoid repeated decoder setup
        if (videoSampleSink && sampleIterator) {
          try {
            iteratorResult = await sampleIterator.next();
            const sample = iteratorResult.value ?? null;
            if (sample) {
              if (needsCrop && decodeCanvas && decodeCtx) {
                // Decode at full resolution, then crop the center region
                sample.draw(decodeCtx, 0, 0, srcW, srcH);
                ctx.drawImage(
                  decodeCanvas,
                  frameCropX,
                  cropY,
                  cropW,
                  cropH,
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                );
              } else {
                sample.draw(ctx, 0, 0, canvas.width, canvas.height);
              }
              sample.close();
            }
          } catch (error) {
            // Skip failed frames silently
          }
        } else {
          // Fallback: seek the video element and draw the frame directly.
          // This is slower but prevents a black video on mobile browsers
          // where WebCodecs decoding is unavailable (canDecode() === false).
          video.currentTime = time;
          await new Promise<void>((resolve) => {
            const onSeeked = () => {
              video.removeEventListener("seeked", onSeeked);
              resolve();
            };
            video.addEventListener("seeked", onSeeked);
            // If already at the target time, seeked won't fire
            if (Math.abs(video.currentTime - time) < 0.01) {
              video.removeEventListener("seeked", onSeeked);
              resolve();
            }
          });
          if (needsCrop) {
            ctx.drawImage(
              video,
              frameCropX,
              cropY,
              cropW,
              cropH,
              0,
              0,
              canvas.width,
              canvas.height,
            );
          } else {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }
        }

        // Find current subtitle chunk
        const currentChunk = enabledChunks.find((chunk) => {
          const [start, end] = chunk.timestamp;
          return time >= start && time <= end;
        });

        const isDynamicMode =
          subtitleStyle.dynamicEnabled && bgRemovalReady && bgProcessFrame;
        const bgActive =
          bgRemovalReady &&
          subtitleStyle.backgroundRemovalEnabled &&
          bgProcessFrame;
        const needsCompositing = isDynamicMode || bgActive;

        if (needsCompositing) {
          // Compositing at full resolution (bg removal or dynamic mode)
          // Save current frame to offscreen canvas via GPU blit (fast, no ImageData needed for restore)
          if (!reusableFrameCanvas) {
            reusableFrameCanvas = document.createElement("canvas");
            reusableFrameCanvas.width = canvas.width;
            reusableFrameCanvas.height = canvas.height;
            reusableFrameCtx = reusableFrameCanvas.getContext("2d");
          }
          reusableFrameCtx!.drawImage(canvas, 0, 0);

          // Use pre-computed masks (5fps cache) when available — avoids costly per-frame AI inference
          // Falls back to live inference only if cached masks aren't available
          let mask: MaskData;
          const cachedMask = getMaskAtTime?.(time);
          if (cachedMask) {
            mask = cachedMask;
          } else if (bgProcessFrame) {
            const framePixels = ctx.getImageData(
              0,
              0,
              canvas.width,
              canvas.height,
            );
            mask = await bgProcessFrame(
              framePixels.data,
              canvas.width,
              canvas.height,
              frameIndex,
            );
          } else {
            // No mask available — skip compositing for this frame
            if (currentChunk) {
              renderSubtitle(
                ctx,
                currentChunk,
                subtitleStyle,
                canvas,
                mode,
                time,
              );
            }
            drawBrandingWatermark(
              ctx,
              canvas.width,
              canvas.height,
              subtitleStyle.brandingWatermark,
            );
            try {
              await videoSource.add(time, 1 / fps);
            } catch {}
            continue;
          }

          // Step 1: Draw background
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          if (isDynamicMode) {
            // Dynamic mode: keep original video as background (GPU blit)
            ctx.drawImage(reusableFrameCanvas!, 0, 0);
          } else if (subtitleStyle.backgroundType === "blur") {
            // Reuse blurCanvas across frames
            if (!reusableBlurCanvas) {
              reusableBlurCanvas = document.createElement("canvas");
            }
            reusableBlurCanvas.width = canvas.width;
            reusableBlurCanvas.height = canvas.height;
            const blurCtx = reusableBlurCanvas.getContext("2d");
            if (blurCtx) {
              blurCtx.drawImage(reusableFrameCanvas!, 0, 0);
              ctx.filter = "blur(20px)";
              ctx.drawImage(reusableBlurCanvas, 0, 0);
              ctx.filter = "none";
            }
          } else {
            ctx.fillStyle = subtitleStyle.solidBackgroundColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }

          // Step 2: Render subtitle behind person
          if (isDynamicMode && currentChunk) {
            // Dynamic mode: render only "behind" words as big text
            renderDynamicBehindInExport(
              ctx,
              currentChunk,
              subtitleStyle,
              canvas,
              time,
            );
          }

          // Step 3: Draw masked foreground (reuse canvases across frames)
          if (!reusableFgCanvas) {
            reusableFgCanvas = document.createElement("canvas");
          }
          if (!reusableMaskCanvas) {
            reusableMaskCanvas = document.createElement("canvas");
          }
          reusableFgCanvas.width = canvas.width;
          reusableFgCanvas.height = canvas.height;
          const fgCtx = reusableFgCanvas.getContext("2d");
          if (fgCtx) {
            fgCtx.drawImage(reusableFrameCanvas!, 0, 0);

            reusableMaskCanvas.width = mask.width;
            reusableMaskCanvas.height = mask.height;
            const maskCtx = reusableMaskCanvas.getContext("2d");
            if (maskCtx) {
              // Reuse ImageData if mask dimensions haven't changed
              if (
                !reusableMaskImageData ||
                reusableMaskImageData.width !== mask.width ||
                reusableMaskImageData.height !== mask.height
              ) {
                reusableMaskImageData = maskCtx.createImageData(
                  mask.width,
                  mask.height,
                );
              }
              const pixels = reusableMaskImageData.data;
              for (let i = 0; i < mask.data.length; i++) {
                const idx = i * 4;
                pixels[idx] = 255;
                pixels[idx + 1] = 255;
                pixels[idx + 2] = 255;
                pixels[idx + 3] = mask.data[i];
              }
              maskCtx.putImageData(reusableMaskImageData, 0, 0);

              fgCtx.globalCompositeOperation = "destination-in";
              if (needsCrop && cachedMask) {
                // Cached masks cover the full video frame — crop to match
                const msx = (frameCropX / srcW) * mask.width;
                const msy = (cropY / srcH) * mask.height;
                const msw = (cropW / srcW) * mask.width;
                const msh = (cropH / srcH) * mask.height;
                fgCtx.drawImage(
                  reusableMaskCanvas,
                  msx,
                  msy,
                  msw,
                  msh,
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                );
              } else {
                fgCtx.drawImage(
                  reusableMaskCanvas,
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                );
              }
              fgCtx.globalCompositeOperation = "source-over";
            }

            ctx.drawImage(reusableFgCanvas, 0, 0);
          }

          // Step 4: Render front text (dynamic) or on-top text (non-dynamic)
          if (isDynamicMode && currentChunk) {
            let faceBounds: FaceBounds | null;
            if (needsCrop && cachedMask) {
              // Cached mask covers full frame — compute chin in full-frame coords then translate
              const fullFace = estimateFaceFromMask(
                mask.data,
                mask.width,
                mask.height,
                srcW,
                srcH,
              );
              faceBounds = fullFace
                ? { chinY: (fullFace.chinY - cropY) * (canvas.height / cropH) }
                : null;
            } else {
              faceBounds = estimateFaceFromMask(
                mask.data,
                mask.width,
                mask.height,
                canvas.width,
                canvas.height,
              );
            }
            renderDynamicFrontInExport(
              ctx,
              currentChunk,
              subtitleStyle,
              canvas,
              faceBounds,
              time,
            );
          } else if (currentChunk) {
            renderSubtitle(
              ctx,
              currentChunk,
              subtitleStyle,
              canvas,
              mode,
              time,
            );
          }
        } else {
          // Normal rendering (no compositing)
          if (currentChunk) {
            renderSubtitle(
              ctx,
              currentChunk,
              subtitleStyle,
              canvas,
              mode,
              time,
            );
          }
        }

        // Branding watermark — drawn on top of everything
        drawBrandingWatermark(
          ctx,
          canvas.width,
          canvas.height,
          subtitleStyle.brandingWatermark,
        );

        if (cancelContextRef.current.cancelRequested) {
          cancelled = true;
          setStatus("Cancelling download...");
          break;
        }

        try {
          await videoSource.add(time, 1 / fps);
        } catch (error) {
          if (cancelContextRef.current.cancelRequested) {
            cancelled = true;
            setStatus("Cancelling download...");
            break;
          }
          throw error;
        }
      }

      // Clean up iterator
      if (sampleIterator) {
        try {
          await sampleIterator.return?.();
        } catch (error) {
          // Cleanup error - safe to ignore
        }
      }

      // Finalize export
      try {
        videoSource.close();
      } catch (closeError) {
        // Close error - safe to ignore
      }

      if (cancelled) {
        await output.cancel();
        setProgress(0);
        setStatus("Download cancelled");
      } else {
        setStatus("Finalizing video...");
        await output.finalize();

        // Download file
        const bufferTarget = output.target as BufferTarget;
        const buffer = bufferTarget.buffer;

        if (!buffer) {
          throw new Error("Failed to generate video buffer");
        }

        const mimeType = format === "webm" ? "video/webm" : "video/mp4";
        const blob = new Blob([buffer], { type: mimeType });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `video_with_subtitles_${new Date().toISOString().replace(/[:.]/g, "-")}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setStatus("Export complete!");
        setProgress(100);
      }
    } catch (error) {
      console.error("MediaBunny video processing failed:", error);
      setStatus(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      // Release all reusable canvases and buffers to free memory
      reusableBlurCanvas = null;
      reusableFgCanvas = null;
      reusableMaskCanvas = null;
      reusableMaskImageData = null;
      reusableFrameCanvas = null;
      reusableFrameCtx = null;
      decodeCanvas = null;
      decodeCtx = null;

      cancelContextRef.current.output = null;
      cancelContextRef.current.videoSource = null;
      const wasCancelled = cancelled;
      setIsProcessing(false);
      if (wasCancelled) {
        setTimeout(() => setProgress(0), 500);
      } else {
        setTimeout(() => setProgress(0), 3000);
      }
      cancelContextRef.current.cancelRequested = false;
    }
  }, [
    video,
    transcriptChunks,
    subtitleStyle,
    mode,
    ratio,
    format,
    quality,
    fps,
    bgRemovalReady,
    bgProcessFrame,
    getMaskAtTime,
    buildExportTimeline,
  ]);

  const cancelDownload = useCallback(() => {
    if (!isProcessing) {
      return;
    }
    cancelContextRef.current.cancelRequested = true;
    setStatus("Cancelling download...");

    if (cancelContextRef.current.videoSource) {
      try {
        cancelContextRef.current.videoSource.close();
      } catch (error) {
        // Close error during cancel - safe to ignore
      } finally {
        cancelContextRef.current.videoSource = null;
      }
    }
  }, [isProcessing]);

  return {
    downloadVideo,
    cancelDownload,
    isProcessing,
    progress,
    status,
  };
}

// Subtitle rendering function
function renderSubtitle(
  ctx: CanvasRenderingContext2D,
  chunk: TranscriptChunk,
  style: SubtitleStyle,
  canvas: HTMLCanvasElement,
  mode: "word" | "phrase",
  currentTime: number,
) {
  // Progressive word reveal: only show words spoken so far
  let displayText = chunk.text;
  let chunkWords = chunk.words;
  if (style.dynamicFollowWord && mode === "phrase" && chunk.words) {
    const visibleWords = chunk.words.filter(
      (w) => currentTime >= w.timestamp[0],
    );
    if (visibleWords.length === 0) return;
    displayText = visibleWords.map((w) => w.text).join(" ");
    chunkWords = visibleWords;
  }

  const isVerticalVideo = canvas.height > canvas.width;

  // Calculate scale based on actual video dimensions
  // The preview shows at max 500px height, so we scale relative to that
  const previewHeight = 500;
  const videoScale = canvas.height / previewHeight;

  // Calculate font size to match preview proportions exactly
  // Use the video scale to maintain the same visual proportion
  const finalFontSize = Math.round(style.fontSize * videoScale);

  const fontFamily = resolveFontFamily(style.fontFamily);

  // Set font properties with font loading check
  const fontString = `${style.fontWeight} ${finalFontSize}px ${fontFamily}`;
  ctx.font = fontString;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Calculate positioning
  const x = canvas.width / 2;

  // Text wrapping logic
  const wordsInText = displayText.split(" ");
  const maxWordsPerLine = style.maxWordsPerLine ?? (isVerticalVideo ? 4 : 6);
  const shouldSplitText = wordsInText.length > maxWordsPerLine;

  let lines = [displayText];
  let splitPoint: number | null = null;
  if (shouldSplitText) {
    const midpoint = Math.ceil(wordsInText.length / 2);
    splitPoint = midpoint;

    for (
      let i = Math.max(2, midpoint - 2);
      i <= Math.min(wordsInText.length - 2, midpoint + 2);
      i++
    ) {
      if (/[,;:.!?]$/.test(wordsInText[i])) {
        splitPoint = i + 1;
        break;
      }
    }

    lines = [
      wordsInText.slice(0, splitPoint).join(" "),
      wordsInText.slice(splitPoint).join(" "),
    ].filter(Boolean);
  }

  const lineHeight = finalFontSize;
  const lineGap = 4 * videoScale;
  const totalHeight =
    lines.length * lineHeight + Math.max(0, lines.length - 1) * lineGap;

  // Compute baseY based on position
  const position = style.position ?? "bottom";
  let baseY: number;
  switch (position) {
    case "top":
      baseY = canvas.height * (isVerticalVideo ? 0.06 : 0.12) + totalHeight / 2;
      break;
    case "middle":
      baseY = canvas.height / 2;
      break;
    case "bottom":
    default:
      baseY = canvas.height - canvas.height * (isVerticalVideo ? 0.08 : 0.16);
      break;
  }

  const startY = baseY - totalHeight / 2 + lineHeight / 2;

  // Draw background if specified
  if (style.backgroundColor && style.backgroundColor !== "transparent") {
    const borderRadius = 8 * videoScale;
    const paddingX = 12 * videoScale;
    const paddingY = 8 * videoScale;

    // Measure maximum line width
    let maxWidth = 0;
    lines.forEach((line) => {
      const metrics = ctx.measureText(line.toUpperCase());
      maxWidth = Math.max(maxWidth, metrics.width);
    });

    // Draw background perfectly centered with text
    const bgX = x - maxWidth / 2 - paddingX;
    const bgY = baseY - totalHeight / 2 - paddingY;
    const bgWidth = maxWidth + paddingX * 2;
    const bgHeight = totalHeight + paddingY * 2;

    ctx.fillStyle = style.backgroundColor;
    ctx.beginPath();
    ctx.roundRect(bgX, bgY, bgWidth, bgHeight, borderRadius);
    ctx.fill();
  }

  const phraseWords = Array.isArray(chunkWords) ? chunkWords : undefined;
  const canEmphasize =
    (style.wordEmphasisEnabled || style.textFadeIn) &&
    mode === "phrase" &&
    phraseWords &&
    phraseWords.length > 0 &&
    Number.isFinite(currentTime);

  if (canEmphasize) {
    // Build line groups based on actual pixel width (accounts for per-word font overrides)
    const maxLineWidth = canvas.width * (isVerticalVideo ? 0.85 : 0.9);
    const emphSpaceWidth = 0.35 * finalFontSize;
    const lineWordGroups: (typeof phraseWords)[] = [];
    let currentLineWords: typeof phraseWords = [];
    let currentLineWidth = 0;

    const globalFontFamily = resolveFontFamily(style.fontFamily);

    for (let i = 0; i < phraseWords.length; i++) {
      const word = phraseWords[i];
      // Use emoji as display text for measurement when set
      const wordText = word.styleOverride?.emoji
        ? word.styleOverride.emoji
        : word.text.toUpperCase();

      // Measure with per-word font if needed
      if (word.styleOverride?.fontFamily || word.styleOverride?.fontSize) {
        ctx.font = buildWordFont(
          style,
          finalFontSize,
          globalFontFamily,
          word.styleOverride,
        );
      }
      const wordWidth = ctx.measureText(wordText).width;
      if (word.styleOverride?.fontFamily || word.styleOverride?.fontSize) {
        ctx.font = fontString;
      }

      const scale =
        currentTime >= word.timestamp[0] &&
        currentTime <= word.timestamp[1] &&
        style.wordEmphasisEnabled
          ? 1.18
          : 1;
      const scaledWordWidth = wordWidth * scale;
      const widthIfAdded =
        currentLineWidth +
        (currentLineWords.length > 0 ? emphSpaceWidth : 0) +
        scaledWordWidth;

      if (currentLineWords.length > 0 && widthIfAdded > maxLineWidth) {
        lineWordGroups.push(currentLineWords);
        currentLineWords = [word];
        currentLineWidth = scaledWordWidth;
      } else {
        currentLineWords.push(word);
        currentLineWidth = widthIfAdded;
      }
    }
    if (currentLineWords.length > 0) {
      lineWordGroups.push(currentLineWords);
    }

    // Recalculate vertical layout with the actual number of lines
    const emphTotalHeight =
      lineWordGroups.length * lineHeight +
      Math.max(0, lineWordGroups.length - 1) * lineGap;
    const emphStartY = baseY - emphTotalHeight / 2 + lineHeight / 2;

    const chunkEndTime = chunk.timestamp[1];
    lineWordGroups.forEach((wordGroup, index) => {
      const lineY = emphStartY + index * (lineHeight + lineGap);
      renderPhraseLineWithEmphasis(
        ctx,
        wordGroup,
        x,
        lineY,
        style,
        videoScale,
        currentTime,
        finalFontSize,
        chunkEndTime,
      );
    });
    return;
  }

  // Chunk-level fade for non-emphasis path (word mode or phrase without emphasis)
  const useChunkFade = style.textFadeIn ?? false;
  if (useChunkFade) {
    const chunkFadeInDuration = 0.15;
    const chunkFadeOutDuration = 0.25;
    const timeSinceChunkStart = currentTime - chunk.timestamp[0];
    const timeToChunkEnd = chunk.timestamp[1] - currentTime;
    const chunkFadeIn = Math.min(
      1,
      Math.max(0, timeSinceChunkStart / chunkFadeInDuration),
    );
    const chunkFadeOut = Math.min(
      1,
      Math.max(0, timeToChunkEnd / chunkFadeOutDuration),
    );
    ctx.save();
    ctx.globalAlpha = chunkFadeIn * chunkFadeOut;
  }

  lines.forEach((line, index) => {
    const lineY = startY + index * (lineHeight + lineGap);
    renderTextLine(ctx, line, x, lineY, style, videoScale);
  });

  if (useChunkFade) {
    ctx.restore();
  }
}

// Text rendering helper
function renderTextLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: SubtitleStyle,
  baseScale: number = 1,
) {
  const upperText = text.toUpperCase();
  if (style.borderWidth > 0) {
    ctx.save();
    ctx.strokeStyle = style.borderColor;
    const strokeWidth = Math.max(0.5, style.borderWidth * baseScale);
    ctx.lineWidth = strokeWidth;
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeText(upperText, x, y);
    ctx.restore();
  }

  let fillStyle: string | CanvasGradient = style.color;
  if (style.color === "#CCCCCC" || style.color === "#C0C0C0") {
    const textWidth = ctx.measureText(upperText).width;
    const gradientHeight = 20 * baseScale;
    const gradient = ctx.createLinearGradient(
      x - textWidth / 2,
      y - gradientHeight,
      x + textWidth / 2,
      y + gradientHeight,
    );
    gradient.addColorStop(0, "#FFFFFF");
    gradient.addColorStop(0.5, "#CCCCCC");
    gradient.addColorStop(1, "#999999");
    fillStyle = gradient;
  }

  ctx.save();
  if (style.dropShadowIntensity > 0) {
    const shadowOpacity = Math.min(1, style.dropShadowIntensity);
    ctx.shadowColor = `rgba(0,0,0,${shadowOpacity})`;
    ctx.shadowBlur = Math.max(2, style.dropShadowIntensity * 4 * baseScale);
    const shadowOffset = 2 * baseScale;
    ctx.shadowOffsetX = shadowOffset;
    ctx.shadowOffsetY = shadowOffset;
  } else {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
  ctx.fillStyle = fillStyle;
  ctx.fillText(upperText, x, y);
  ctx.restore();
}

// Helper to determine if a color is light or dark (matches video-caption.tsx logic)
function isLightColor(color: string): boolean {
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  }
  return false;
}

/** Build a font string, optionally applying per-word overrides. */
function buildWordFont(
  style: SubtitleStyle,
  finalFontSize: number,
  fontFamily: string,
  override?: WordStyleOverride,
): string {
  const family = override?.fontFamily
    ? resolveFontFamily(override.fontFamily)
    : fontFamily;
  const size = override?.fontSize
    ? Math.round(finalFontSize * override.fontSize)
    : finalFontSize;
  return `${style.fontWeight} ${size}px ${family}`;
}

function renderPhraseLineWithEmphasis(
  ctx: CanvasRenderingContext2D,
  words: WordTiming[],
  centerX: number,
  centerY: number,
  style: SubtitleStyle,
  baseScale: number,
  currentTime: number,
  finalFontSize: number,
  chunkEndTime?: number,
) {
  if (words.length === 0) {
    return;
  }

  const globalFontFamily = resolveFontFamily(style.fontFamily);
  const globalFont = `${style.fontWeight} ${finalFontSize}px ${globalFontFamily}`;

  // Build display texts: emoji replaces word text when set
  const displayTexts = words.map((word) =>
    word.styleOverride?.emoji
      ? word.styleOverride.emoji
      : word.text.toUpperCase(),
  );
  // Match preview spacer span width: 0.35em
  const spaceWidth = 0.35 * finalFontSize;
  const scales = words.map((word) =>
    currentTime >= word.timestamp[0] &&
    currentTime <= word.timestamp[1] &&
    style.wordEmphasisEnabled
      ? 1.18
      : 1,
  );

  // Measure each word with its own font (per-word override support)
  const baseWidths = displayTexts.map((value, index) => {
    const word = words[index];
    if (word.styleOverride?.fontFamily || word.styleOverride?.fontSize) {
      ctx.font = buildWordFont(
        style,
        finalFontSize,
        globalFontFamily,
        word.styleOverride,
      );
      const w = ctx.measureText(value).width;
      ctx.font = globalFont;
      return w;
    }
    return ctx.measureText(value).width;
  });

  const scaledWidths = baseWidths.map((width, index) => width * scales[index]);
  const totalWidth =
    scaledWidths.reduce((total, width) => total + width, 0) +
    spaceWidth * Math.max(0, words.length - 1);
  let cursor = centerX - totalWidth / 2;

  // Match inline span padding: ~0.15em horizontally, minimal vertical padding
  const highlightPaddingX = finalFontSize * 0.15;
  const highlightPaddingY = finalFontSize * 0.08;
  const highlightRadius = finalFontSize * 0.35;

  // Determine emphasis colors based on text color (matches preview logic)
  const textIsLight = isLightColor(style.color);
  const emphasisBgColor = textIsLight
    ? "rgba(0, 0, 0, 0.65)"
    : "rgba(255, 255, 255, 0.85)";
  const emphasisTextColor = textIsLight ? "#FFFFFF" : "#000000";

  // Fade constants
  const fadeOutDuration = 0.25; // 250ms chunk fade-out
  const useTextFade = style.textFadeIn ?? false;

  words.forEach((word, index) => {
    const displayText = displayTexts[index];
    const scale = scales[index];
    const scaledWidth = scaledWidths[index];
    const baseWidth = baseWidths[index];
    const isActive = scale > 1;
    const wordCenterX = cursor + scaledWidth / 2;
    const isKnockout = word.styleOverride?.effect === "knockout";
    const hasEmojiReplace = !!word.styleOverride?.emoji;

    // Per-word fade
    const timeSinceWordStart = currentTime - word.timestamp[0];
    const chunkFadeOut =
      useTextFade && chunkEndTime != null
        ? Math.min(
            1,
            Math.max(0, (chunkEndTime - currentTime) / fadeOutDuration),
          )
        : 1;
    const wordAlpha = chunkFadeOut;

    ctx.save();
    ctx.globalAlpha = wordAlpha;

    if (isActive) {
      const boxWidth = scaledWidth + highlightPaddingX * 2;
      const wordFontSize = word.styleOverride?.fontSize
        ? Math.round(finalFontSize * word.styleOverride.fontSize)
        : finalFontSize;
      const boxHeight = wordFontSize * scale + highlightPaddingY * 2;

      ctx.fillStyle = emphasisBgColor;
      ctx.beginPath();
      ctx.roundRect(
        wordCenterX - boxWidth / 2,
        centerY - boxHeight / 2,
        boxWidth,
        boxHeight,
        highlightRadius,
      );
      ctx.fill();
    }

    const wordColor = word.styleOverride?.color;
    const fillColor = isActive ? emphasisTextColor : (wordColor ?? style.color);

    // Set per-word font if override exists
    if (word.styleOverride?.fontFamily || word.styleOverride?.fontSize) {
      ctx.font = buildWordFont(
        style,
        finalFontSize,
        globalFontFamily,
        word.styleOverride,
      );
    }

    // Compute effective font size for this word
    const effectiveFontSize = word.styleOverride?.fontSize
      ? Math.round(finalFontSize * word.styleOverride.fontSize)
      : finalFontSize;

    // Compute per-character alphas for letter-by-letter fade (skip for emoji replace)
    let charAlphas: number[] | undefined;
    if (useTextFade && !isKnockout && !hasEmojiReplace) {
      const wordDuration = word.timestamp[1] - word.timestamp[0];
      const revealDuration = Math.min(0.3, wordDuration * 0.6);
      const charCount = displayText.length;
      const letterStagger = charCount > 0 ? revealDuration / charCount : 0;
      charAlphas = [];
      for (let ci = 0; ci < charCount; ci++) {
        charAlphas.push(
          Math.min(
            1,
            Math.max(0, (timeSinceWordStart - ci * letterStagger) / 0.06),
          ),
        );
      }
    }

    drawWordText(
      ctx,
      displayText,
      wordCenterX,
      centerY,
      style,
      baseScale,
      scale,
      baseWidth,
      fillColor,
      word.styleOverride?.effect,
      charAlphas,
    );

    // Draw emoji overlay above the word
    if (word.styleOverride?.emojiOverlay) {
      const emojiScale = word.styleOverride?.emojiScale ?? 1;
      ctx.save();
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = "transparent";
      ctx.lineWidth = 0;
      const overlayFontSize = effectiveFontSize * 1.4 * emojiScale;
      ctx.font = `${overlayFontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#000000";
      ctx.fillText(
        word.styleOverride.emojiOverlay,
        wordCenterX,
        centerY - effectiveFontSize * 1.2 * emojiScale,
      );
      ctx.restore();
    }

    // Restore global font
    if (word.styleOverride?.fontFamily || word.styleOverride?.fontSize) {
      ctx.font = globalFont;
    }

    ctx.restore();

    cursor += scaledWidth + spaceWidth;
  });
}

function drawWordText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  style: SubtitleStyle,
  baseScale: number,
  scale: number,
  baseWidth: number,
  fillColor: string,
  effect?: "knockout",
  charAlphas?: number[],
) {
  const uppercase = text.toUpperCase();
  const isKnockout = effect === "knockout";

  // Per-character rendering when charAlphas provided
  if (charAlphas && charAlphas.length > 0 && !isKnockout) {
    const savedAlpha = ctx.globalAlpha;
    const chars = uppercase.split("");
    const charWidths = chars.map((c) => ctx.measureText(c).width);
    const totalCharWidth = charWidths.reduce((a, b) => a + b, 0);
    let charX = -totalCharWidth / 2;

    for (let ci = 0; ci < chars.length; ci++) {
      const alpha = charAlphas[ci] ?? 1;
      ctx.globalAlpha = savedAlpha * alpha;

      const charCenterX = charX + charWidths[ci] / 2;

      if (style.borderWidth > 0) {
        ctx.save();
        ctx.strokeStyle = style.borderColor;
        const scaledBorderWidth = Math.max(
          0.5,
          (style.borderWidth * baseScale) / Math.max(scale, 0.001),
        );
        ctx.lineWidth = scaledBorderWidth;
        ctx.translate(centerX, centerY);
        ctx.scale(scale, scale);
        ctx.lineJoin = "round";
        ctx.miterLimit = 2;
        ctx.strokeText(chars[ci], charCenterX, 0);
        ctx.restore();
      }

      let charFillStyle: string | CanvasGradient = fillColor;
      if (
        fillColor === style.color &&
        (style.color === "#CCCCCC" || style.color === "#C0C0C0")
      ) {
        const scaledWidth = baseWidth * scale;
        const gradientHeight = 20 * baseScale;
        const gradient = ctx.createLinearGradient(
          centerX - scaledWidth / 2,
          centerY - gradientHeight,
          centerX + scaledWidth / 2,
          centerY + gradientHeight,
        );
        gradient.addColorStop(0, "#FFFFFF");
        gradient.addColorStop(0.5, "#CCCCCC");
        gradient.addColorStop(1, "#999999");
        charFillStyle = gradient;
      }

      ctx.save();
      if (style.dropShadowIntensity > 0) {
        const shadowOpacity = Math.min(1, style.dropShadowIntensity);
        ctx.shadowColor = `rgba(0,0,0,${shadowOpacity})`;
        ctx.shadowBlur = Math.max(2, style.dropShadowIntensity * 5 * baseScale);
        const shadowOffset = 2 * baseScale;
        ctx.shadowOffsetX = shadowOffset;
        ctx.shadowOffsetY = shadowOffset;
      } else {
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
      ctx.fillStyle = charFillStyle;
      ctx.translate(centerX, centerY);
      ctx.scale(scale, scale);
      ctx.fillText(chars[ci], charCenterX, 0);
      ctx.restore();

      charX += charWidths[ci];
    }
    ctx.globalAlpha = savedAlpha;
    return;
  }

  // Stroke closely matching WebKitTextStroke without over-thickening (skip for knockout)
  if (style.borderWidth > 0 && !isKnockout) {
    ctx.save();
    ctx.strokeStyle = style.borderColor;
    const scaledBorderWidth = Math.max(
      0.5,
      (style.borderWidth * baseScale) / Math.max(scale, 0.001),
    );
    ctx.lineWidth = scaledBorderWidth;
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeText(uppercase, 0, 0);
    ctx.restore();
  }

  if (isKnockout) {
    ctx.save();
    ctx.globalCompositeOperation = "difference";
    ctx.fillStyle = "#FFFFFF";
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.fillText(uppercase, 0, 0);
    ctx.restore();
    return;
  }

  let fillStyle: string | CanvasGradient = fillColor;
  if (
    fillColor === style.color &&
    (style.color === "#CCCCCC" || style.color === "#C0C0C0")
  ) {
    const scaledWidth = baseWidth * scale;
    const gradientHeight = 20 * baseScale;
    const gradient = ctx.createLinearGradient(
      centerX - scaledWidth / 2,
      centerY - gradientHeight,
      centerX + scaledWidth / 2,
      centerY + gradientHeight,
    );
    gradient.addColorStop(0, "#FFFFFF");
    gradient.addColorStop(0.5, "#CCCCCC");
    gradient.addColorStop(1, "#999999");
    fillStyle = gradient;
  }

  ctx.save();
  // Use canvas shadow with blur to resemble CSS drop-shadow in preview
  if (style.dropShadowIntensity > 0) {
    const shadowOpacity = Math.min(1, style.dropShadowIntensity);
    ctx.shadowColor = `rgba(0,0,0,${shadowOpacity})`;
    ctx.shadowBlur = Math.max(2, style.dropShadowIntensity * 5 * baseScale);
    const shadowOffset = 2 * baseScale;
    ctx.shadowOffsetX = shadowOffset;
    ctx.shadowOffsetY = shadowOffset;
  } else {
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
  ctx.fillStyle = fillStyle;
  ctx.translate(centerX, centerY);
  ctx.scale(scale, scale);
  ctx.fillText(uppercase, 0, 0);
  ctx.restore();
}

// Dynamic mode: large text with configurable size and position, word-wrapped
function renderDynamicWord(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: SubtitleStyle,
  canvas: HTMLCanvasElement,
) {
  const upperText = text.toUpperCase();
  const videoScale = canvas.height / 500;
  const fontSize = Math.round((style.dynamicFontSize ?? 80) * videoScale);
  const maxWidth = canvas.width * 0.85;

  const fontFamily = resolveFontFamily(style.fontFamily);

  ctx.font = `${style.fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Word-wrap the text
  const words = upperText.split(" ");
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  const lineHeight = fontSize * 1.1;
  const totalHeight = lines.length * lineHeight;
  const x = canvas.width / 2;
  const yPercent = style.dynamicYPosition ?? 35;
  const yCenter = canvas.height * (yPercent / 100);
  const startY = yCenter - totalHeight / 2 + lineHeight / 2;

  for (let i = 0; i < lines.length; i++) {
    const lineY = startY + i * lineHeight;
    const lineText = lines[i];

    // Stroke
    const strokeWidth = Math.max(2, fontSize * 0.03);
    ctx.save();
    ctx.strokeStyle = style.borderColor || "#000000";
    ctx.lineWidth = strokeWidth;
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeText(lineText, x, lineY);
    ctx.restore();

    // Fill
    let fillStyle: string | CanvasGradient = style.color;
    if (style.color === "#CCCCCC" || style.color === "#C0C0C0") {
      const textWidth = ctx.measureText(lineText).width;
      const gradient = ctx.createLinearGradient(
        x - textWidth / 2,
        lineY - fontSize / 2,
        x + textWidth / 2,
        lineY + fontSize / 2,
      );
      gradient.addColorStop(0, "#FFFFFF");
      gradient.addColorStop(0.5, "#CCCCCC");
      gradient.addColorStop(1, "#999999");
      fillStyle = gradient;
    }

    ctx.save();
    const shadowIntensity = Math.max(0.5, style.dropShadowIntensity);
    ctx.shadowColor = `rgba(0,0,0,${shadowIntensity})`;
    ctx.shadowBlur = Math.max(3, shadowIntensity * 6 * videoScale);
    ctx.shadowOffsetX = 2 * videoScale;
    ctx.shadowOffsetY = 2 * videoScale;
    ctx.fillStyle = fillStyle;
    ctx.fillText(lineText, x, lineY);
    ctx.restore();
  }
}

// Render only "behind" words from a dynamic chunk
function renderDynamicBehindInExport(
  ctx: CanvasRenderingContext2D,
  chunk: TranscriptChunk,
  style: SubtitleStyle,
  canvas: HTMLCanvasElement,
  currentTime: number,
) {
  if (!chunk.words) {
    // Fallback: render entire text as behind
    renderDynamicWord(ctx, chunk.text, style, canvas);
    return;
  }

  let behindWords = chunk.words.filter((w) => w.dynamicPosition === "behind");
  if (style.dynamicFollowWord) {
    behindWords = behindWords.filter((w) => currentTime >= w.timestamp[0]);
  }
  if (behindWords.length === 0) return;

  const behindText = behindWords.map((w) => w.text).join(" ");
  renderDynamicWordWithOptions(
    ctx,
    behindText,
    style,
    canvas,
    {
      fontSize: style.dynamicFontSize ?? 80,
      yPosition: style.dynamicYPosition ?? 35,
    },
    behindWords,
    currentTime,
    chunk.timestamp[1],
  );
}

// Render only "front" words from a dynamic chunk
function renderDynamicFrontInExport(
  ctx: CanvasRenderingContext2D,
  chunk: TranscriptChunk,
  style: SubtitleStyle,
  canvas: HTMLCanvasElement,
  faceBounds: FaceBounds | null,
  currentTime: number,
) {
  if (!chunk.words) return;

  let frontWords = chunk.words.filter((w) => w.dynamicPosition === "front");
  if (style.dynamicFollowWord) {
    frontWords = frontWords.filter((w) => currentTime >= w.timestamp[0]);
  }
  if (frontWords.length === 0) return;

  const frontText = frontWords.map((w) => w.text).join(" ");

  const fallbackY = style.dynamicFrontYPosition ?? 75;
  let yPosition = fallbackY;
  if (faceBounds) {
    const chinPercent = (faceBounds.chinY / canvas.height) * 100;
    const faceBasedY = Math.min(90, chinPercent + 10);
    // Use whichever is lower (further down) — never place above the fallback
    yPosition = Math.max(fallbackY, faceBasedY);
  }

  renderDynamicWordWithOptions(
    ctx,
    frontText,
    style,
    canvas,
    {
      fontSize: style.dynamicFrontFontSize ?? 40,
      yPosition,
    },
    frontWords,
    currentTime,
    chunk.timestamp[1],
  );
}

// Shared dynamic text renderer with configurable size and position
// When `wordTimings` is provided and any word has a styleOverride, renders word-by-word.
function renderDynamicWordWithOptions(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: SubtitleStyle,
  canvas: HTMLCanvasElement,
  options: { fontSize: number; yPosition: number },
  wordTimings?: WordTiming[],
  currentTime?: number,
  chunkEndTime?: number,
) {
  const videoScale = canvas.height / 500;
  const fontSize = Math.round(options.fontSize * videoScale);
  const maxWidth = canvas.width * 0.85;

  const fontFamily = resolveFontFamily(style.fontFamily);

  const globalFont = `${style.fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.font = globalFont;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const hasOverrides = wordTimings?.some((w) => w.styleOverride);

  // Word-wrap into lines, tracking word indices
  // Use emoji as display text when set
  const rawUpperWords = text.toUpperCase().split(" ");
  const upperWords = rawUpperWords.map((w, i) =>
    wordTimings?.[i]?.styleOverride?.emoji
      ? wordTimings[i].styleOverride!.emoji!
      : w,
  );
  const lines: string[] = [];
  const lineWordIndices: number[][] = [];
  let currentLine = "";
  let currentIndices: number[] = [];

  for (let wi = 0; wi < upperWords.length; wi++) {
    const word = upperWords[wi];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && currentLine) {
      lines.push(currentLine);
      lineWordIndices.push(currentIndices);
      currentLine = word;
      currentIndices = [wi];
    } else {
      currentLine = testLine;
      currentIndices.push(wi);
    }
  }
  if (currentLine) {
    lines.push(currentLine);
    lineWordIndices.push(currentIndices);
  }

  const lineHeight = fontSize * 1.1;
  const totalHeight = lines.length * lineHeight;
  const x = canvas.width / 2;
  const yCenter = canvas.height * (options.yPosition / 100);
  const startY = yCenter - totalHeight / 2 + lineHeight / 2;

  const useTextFade =
    (style.textFadeIn ?? false) && wordTimings && currentTime != null;
  const fadeOutDuration = 0.25;
  const chunkFadeOut =
    useTextFade && chunkEndTime != null
      ? Math.min(
          1,
          Math.max(0, (chunkEndTime - currentTime!) / fadeOutDuration),
        )
      : 1;

  const needsWordByWord = (hasOverrides || useTextFade) && wordTimings;

  for (let i = 0; i < lines.length; i++) {
    const lineY = startY + i * lineHeight;
    const lineText = lines[i];

    if (needsWordByWord) {
      const indices = lineWordIndices[i];
      const lineWords = indices.map((idx) => ({
        text: wordTimings[idx]?.styleOverride?.emoji
          ? wordTimings[idx].styleOverride!.emoji!
          : upperWords[idx],
        override: wordTimings[idx]?.styleOverride,
        timing: wordTimings[idx],
      }));

      const spaceWidth = ctx.measureText(" ").width;
      const wordWidths = lineWords.map((w) => {
        if (w.override?.fontFamily || w.override?.fontSize) {
          ctx.font = buildWordFont(style, fontSize, fontFamily, w.override);
          const width = ctx.measureText(w.text).width;
          ctx.font = globalFont;
          return width;
        }
        return ctx.measureText(w.text).width;
      });
      const totalLineWidth =
        wordWidths.reduce((a, b) => a + b, 0) +
        spaceWidth * Math.max(0, lineWords.length - 1);
      let cursor = x - totalLineWidth / 2;

      for (let j = 0; j < lineWords.length; j++) {
        const w = lineWords[j];
        const wWidth = wordWidths[j];
        const wordX = cursor + wWidth / 2;
        const wordColor = w.override?.color ?? style.color;
        const isKnockout = w.override?.effect === "knockout";
        const hasEmojiReplace = !!w.override?.emoji;

        if (w.override?.fontFamily || w.override?.fontSize) {
          ctx.font = buildWordFont(style, fontSize, fontFamily, w.override);
        }

        // Compute per-character alphas for letter-by-letter fade (skip for emoji replace)
        let charAlphas: number[] | undefined;
        if (useTextFade && !isKnockout && !hasEmojiReplace && w.timing) {
          const timeSinceWordStart = currentTime! - w.timing.timestamp[0];
          const wordDuration = w.timing.timestamp[1] - w.timing.timestamp[0];
          const revealDuration = Math.min(0.3, wordDuration * 0.6);
          const charCount = w.text.length;
          const letterStagger = charCount > 0 ? revealDuration / charCount : 0;
          charAlphas = [];
          for (let ci = 0; ci < charCount; ci++) {
            charAlphas.push(
              Math.min(
                1,
                Math.max(0, (timeSinceWordStart - ci * letterStagger) / 0.06),
              ) * chunkFadeOut,
            );
          }
        }

        ctx.save();
        if (!charAlphas) ctx.globalAlpha = chunkFadeOut;
        renderDynamicSingleWord(
          ctx,
          w.text,
          wordX,
          lineY,
          style,
          wordColor,
          fontSize,
          videoScale,
          w.override?.effect,
          charAlphas,
        );
        ctx.restore();

        // Draw emoji overlay above the word
        if (w.override?.emojiOverlay) {
          const effectiveFontSize = w.override?.fontSize
            ? Math.round(fontSize * w.override.fontSize)
            : fontSize;
          const emojiScale = w.override?.emojiScale ?? 1;
          ctx.save();
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          ctx.strokeStyle = "transparent";
          ctx.lineWidth = 0;
          const overlayFontSize = effectiveFontSize * 1.4 * emojiScale;
          ctx.font = `${overlayFontSize}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = "#000000";
          ctx.fillText(
            w.override.emojiOverlay,
            wordX,
            lineY - effectiveFontSize * 1.2 * emojiScale,
          );
          ctx.restore();
        }

        if (w.override?.fontFamily || w.override?.fontSize) {
          ctx.font = globalFont;
        }

        cursor += wWidth + spaceWidth;
      }
    } else {
      // Fast path: no overrides and no textFadeIn, render full line
      renderDynamicSingleWord(
        ctx,
        lineText,
        x,
        lineY,
        style,
        style.color,
        fontSize,
        videoScale,
      );
    }
  }
}

/** Render a single word/line of dynamic text at a given position (export). */
function renderDynamicSingleWord(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: SubtitleStyle,
  fillColor: string,
  fontSize: number,
  videoScale: number,
  effect?: "knockout",
  charAlphas?: number[],
) {
  const upperText = text.toUpperCase();
  const isKnockout = effect === "knockout";

  // Per-character rendering when charAlphas provided
  if (charAlphas && charAlphas.length > 0 && !isKnockout) {
    const savedAlpha = ctx.globalAlpha;
    const chars = upperText.split("");
    const charWidths = chars.map((c) => ctx.measureText(c).width);
    const totalCharWidth = charWidths.reduce((a, b) => a + b, 0);
    let charX = x - totalCharWidth / 2;

    for (let ci = 0; ci < chars.length; ci++) {
      const alpha = charAlphas[ci] ?? 1;
      ctx.globalAlpha = savedAlpha * alpha;
      const cx = charX + charWidths[ci] / 2;

      const strokeWidth = Math.max(2, fontSize * 0.03);
      ctx.save();
      ctx.strokeStyle = style.borderColor || "#000000";
      ctx.lineWidth = strokeWidth;
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.strokeText(chars[ci], cx, y);
      ctx.restore();

      let charFillStyle: string | CanvasGradient = fillColor;
      if (
        fillColor === style.color &&
        (style.color === "#CCCCCC" || style.color === "#C0C0C0")
      ) {
        const tw = ctx.measureText(upperText).width;
        const gradient = ctx.createLinearGradient(
          x - tw / 2,
          y - fontSize / 2,
          x + tw / 2,
          y + fontSize / 2,
        );
        gradient.addColorStop(0, "#FFFFFF");
        gradient.addColorStop(0.5, "#CCCCCC");
        gradient.addColorStop(1, "#999999");
        charFillStyle = gradient;
      }

      ctx.save();
      const shadowIntensity = Math.max(0.5, style.dropShadowIntensity);
      ctx.shadowColor = `rgba(0,0,0,${shadowIntensity})`;
      ctx.shadowBlur = Math.max(3, shadowIntensity * 6 * videoScale);
      ctx.shadowOffsetX = 2 * videoScale;
      ctx.shadowOffsetY = 2 * videoScale;
      ctx.fillStyle = charFillStyle;
      ctx.fillText(chars[ci], cx, y);
      ctx.restore();

      charX += charWidths[ci];
    }
    ctx.globalAlpha = savedAlpha;
    return;
  }

  if (!isKnockout) {
    const strokeWidth = Math.max(2, fontSize * 0.03);
    ctx.save();
    ctx.strokeStyle = style.borderColor || "#000000";
    ctx.lineWidth = strokeWidth;
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeText(upperText, x, y);
    ctx.restore();
  }

  if (isKnockout) {
    ctx.save();
    ctx.globalCompositeOperation = "difference";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(upperText, x, y);
    ctx.restore();
    return;
  }

  let fillStyle: string | CanvasGradient = fillColor;
  if (
    fillColor === style.color &&
    (style.color === "#CCCCCC" || style.color === "#C0C0C0")
  ) {
    const textWidth = ctx.measureText(upperText).width;
    const gradient = ctx.createLinearGradient(
      x - textWidth / 2,
      y - fontSize / 2,
      x + textWidth / 2,
      y + fontSize / 2,
    );
    gradient.addColorStop(0, "#FFFFFF");
    gradient.addColorStop(0.5, "#CCCCCC");
    gradient.addColorStop(1, "#999999");
    fillStyle = gradient;
  }

  ctx.save();
  const shadowIntensity = Math.max(0.5, style.dropShadowIntensity);
  ctx.shadowColor = `rgba(0,0,0,${shadowIntensity})`;
  ctx.shadowBlur = Math.max(3, shadowIntensity * 6 * videoScale);
  ctx.shadowOffsetX = 2 * videoScale;
  ctx.shadowOffsetY = 2 * videoScale;
  ctx.fillStyle = fillStyle;
  ctx.fillText(upperText, x, y);
  ctx.restore();
}
