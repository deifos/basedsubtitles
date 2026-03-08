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
} from "mediabunny";
import { SubtitleStyle } from "@/components/subtitle-styling";
import { processTranscriptChunks } from "@/lib/utils";
import { estimateFaceFromMask, type FaceBounds } from "@/lib/render-subtitle";
import type { MaskData } from "@/hooks/useBackgroundRemoval";
import {
  type PositionTimeline,
  interpolateCenterX,
  computeCropX,
} from "@/lib/person-tracking";
import {
  type TranscriptChunk,
  isPhraseChunk,
  drawBrandingWatermark,
  renderSubtitle,
  renderDynamicBehindInExport,
  renderDynamicFrontInExport,
} from "@/lib/export-renderer";

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
      const cropY = 0;
      let cropW = srcW;
      const cropH = srcH;
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

      // Build face tracking timeline for dynamic crop or left-right split during export
      const needsFaceTimeline =
        needsCrop ||
        (subtitleStyle.splitSubtitleMode === "left-right" && !needsCrop);
      let faceTimeline: PositionTimeline | null = null;
      if (needsFaceTimeline && buildExportTimeline) {
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
          audioContext =
            new // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window.AudioContext || (window as any).webkitAudioContext)();
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
        } catch {
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

      // Lookahead constant to compensate for EMA smoothing lag in face tracking export
      const FACE_TRACK_LOOKAHEAD = 0.15; // seconds

      // Pre-compute a fixed face X position for each subtitle phrase.
      // Left-right split text stays at the face position from phrase start — it doesn't
      // move mid-phrase, which avoids distracting text drift and is easier to read.
      const phraseFaceXMap = new Map<number, number>();
      if (
        subtitleStyle.splitSubtitleMode === "left-right" &&
        faceTimeline &&
        !needsCrop
      ) {
        for (const chunk of enabledChunks) {
          const startTime = chunk.timestamp[0];
          phraseFaceXMap.set(
            startTime,
            interpolateCenterX(faceTimeline, startTime + FACE_TRACK_LOOKAHEAD),
          );
        }
      }

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

        // Compute per-frame crop X (face tracking or static center).
        // Look ahead slightly to compensate for EMA smoothing lag — during
        // preview the crop and detection run in the same rAF tick so the
        // lag is imperceptible, but in export it manifests as a visible delay.
        const frameCropX = faceTimeline
          ? computeCropX(
              interpolateCenterX(faceTimeline, time + FACE_TRACK_LOOKAHEAD),
              srcW,
              cropW,
            )
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
          } catch {
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

        // Face X for left-right split: frozen per-phrase, not interpolated per-frame.
        // This keeps text stationary for the phrase duration so it's easy to read.
        const frameFaceX = currentChunk
          ? (phraseFaceXMap.get(currentChunk.timestamp[0]) ?? 0.5)
          : 0.5;

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
                frameFaceX,
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
              frameFaceX,
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
              frameFaceX,
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
        } catch {
          // Cleanup error - safe to ignore
        }
      }

      // Finalize export
      try {
        videoSource.close();
      } catch {
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
      } catch {
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
