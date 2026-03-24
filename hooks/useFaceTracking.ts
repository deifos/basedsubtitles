import { useRef, useCallback, useState } from "react";
import {
  type PositionKeyframe,
  type PositionTimeline,
  smoothCenterX,
  smoothTimeline,
} from "@/lib/person-tracking";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm";

export interface UseFaceTrackingReturn {
  isLoading: boolean;
  startTracking: (videoElement: HTMLVideoElement) => void;
  stopTracking: () => void;
  getCenterX: () => number;
  buildExportTimeline: (
    videoElement: HTMLVideoElement,
    onProgress?: (percent: number) => void,
  ) => Promise<PositionTimeline>;
}

type FaceDetector = import("@mediapipe/tasks-vision").FaceDetector;

export function useFaceTracking(): UseFaceTrackingReturn {
  const [isLoading, setIsLoading] = useState(false);
  const detectorRef = useRef<FaceDetector | null>(null);
  const initPromiseRef = useRef<Promise<FaceDetector> | null>(null);
  const rafRef = useRef<number>(0);
  const smoothedCenterXRef = useRef<number>(0.5);
  const lastTimeRef = useRef<number>(-1);
  const timelineRef = useRef<PositionKeyframe[]>([]);
  const trackingActiveRef = useRef(false);
  const trackedSrcRef = useRef<string>("");

  const ensureDetector = useCallback(async (): Promise<FaceDetector> => {
    if (detectorRef.current) return detectorRef.current;
    if (initPromiseRef.current) return initPromiseRef.current;

    setIsLoading(true);
    initPromiseRef.current = (async () => {
      const { FaceDetector, FilesetResolver } =
        await import("@mediapipe/tasks-vision");
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
      // Suppress TFLite WASM INFO log ("Created TensorFlow Lite XNNPACK delegate for CPU")
      // that emscripten routes through console.error
      const origError = console.error;
      console.error = (...args: unknown[]) => {
        if (
          typeof args[0] === "string" &&
          args[0].includes("Created TensorFlow Lite XNNPACK delegate")
        )
          return;
        origError.apply(console, args);
      };
      const detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: "VIDEO",
        minDetectionConfidence: 0.5,
      });
      console.error = origError;
      detectorRef.current = detector;
      setIsLoading(false);
      return detector;
    })();

    initPromiseRef.current.catch(() => {
      initPromiseRef.current = null;
      setIsLoading(false);
    });

    return initPromiseRef.current;
  }, []);

  const suppressedRef = useRef(false);

  const extractCenterX = useCallback(
    (detector: FaceDetector, video: HTMLVideoElement, timestamp: number) => {
      let result;
      try {
        // The first detectForVideo call triggers a TFLite INFO log via console.error.
        // Suppress it once so it doesn't trip the Next.js dev error overlay.
        if (!suppressedRef.current) {
          suppressedRef.current = true;
          const origError = console.error;
          console.error = (...args: unknown[]) => {
            if (
              typeof args[0] === "string" &&
              args[0].includes("Created TensorFlow Lite XNNPACK delegate")
            )
              return;
            origError.apply(console, args);
          };
          result = detector.detectForVideo(video, timestamp);
          console.error = origError;
        } else {
          result = detector.detectForVideo(video, timestamp);
        }
      } catch {
        return null;
      }

      if (!result.detections || result.detections.length === 0) return null;

      // Pick the largest face (closest to camera)
      let best = result.detections[0];
      let bestArea = 0;
      for (const det of result.detections) {
        const bb = det.boundingBox;
        if (!bb) continue;
        const area = bb.width * bb.height;
        if (area > bestArea) {
          bestArea = area;
          best = det;
        }
      }

      const bb = best.boundingBox;
      if (!bb) return null;

      // Normalize centerX to 0-1
      return (bb.originX + bb.width / 2) / video.videoWidth;
    },
    [],
  );

  const startTracking = useCallback(
    (videoElement: HTMLVideoElement) => {
      if (trackingActiveRef.current) return;
      trackingActiveRef.current = true;
      // Only reset timeline when the video source changes (not on ratio/setting changes)
      if (videoElement.src !== trackedSrcRef.current) {
        trackedSrcRef.current = videoElement.src;
        smoothedCenterXRef.current = 0.5;
        lastTimeRef.current = -1;
        timelineRef.current = [];
      }

      ensureDetector().then((detector) => {
        if (!trackingActiveRef.current) return;

        const render = () => {
          if (!trackingActiveRef.current) return;

          const time = videoElement.currentTime;
          // Skip if video doesn't have frame data yet or time hasn't changed
          if (
            videoElement.readyState >= 2 &&
            time !== lastTimeRef.current &&
            !videoElement.paused
          ) {
            lastTimeRef.current = time;
            // MediaPipe needs a monotonically increasing timestamp in ms
            const tsMs = performance.now();
            const rawCx = extractCenterX(detector, videoElement, tsMs);

            if (rawCx !== null) {
              smoothedCenterXRef.current = smoothCenterX(
                smoothedCenterXRef.current,
                rawCx,
              );
              timelineRef.current.push({
                time,
                centerX: smoothedCenterXRef.current,
              });
            }
            // On no face: hold last position (smoothedCenterXRef stays)
          }

          rafRef.current = requestAnimationFrame(render);
        };

        rafRef.current = requestAnimationFrame(render);
      });
    },
    [ensureDetector, extractCenterX],
  );

  const stopTracking = useCallback(() => {
    trackingActiveRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const getCenterX = useCallback((): number => {
    return smoothedCenterXRef.current;
  }, []);

  const buildExportTimeline = useCallback(
    async (
      videoElement: HTMLVideoElement,
      onProgress?: (percent: number) => void,
    ): Promise<PositionTimeline> => {
      const duration = videoElement.duration;

      // Use preview timeline only if it covers at least 90% of the video.
      // Partial data (e.g. user watched first 5s of a 30s video) would cause
      // the export crop to lock at the last tracked position for the rest.
      const preview = timelineRef.current;
      if (
        preview.length > 0 &&
        preview[preview.length - 1].time >= duration * 0.9
      ) {
        return preview;
      }

      // Scan the video at 2fps — face positions change slowly and the
      // timeline is interpolated/smoothed, so 2fps is plenty while being
      // 2.5× faster than the previous 5fps scan.
      const detector = await ensureDetector();
      const step = 1 / 2; // 2fps
      const totalSteps = Math.ceil(duration / step);
      const timeline: PositionTimeline = [];

      // Save and pause
      const wasPlaying = !videoElement.paused;
      if (wasPlaying) videoElement.pause();
      const savedTime = videoElement.currentTime;

      let stepIndex = 0;
      for (let t = 0; t < duration; t += step) {
        // Report progress
        if (onProgress && stepIndex % 4 === 0) {
          onProgress(Math.min(100, (stepIndex / totalSteps) * 100));
        }
        stepIndex++;

        // Add the seeked listener BEFORE setting currentTime so we never miss
        // the event. Skip the seek entirely if already at the target time.
        if (Math.abs(videoElement.currentTime - t) >= 0.01) {
          await new Promise<void>((resolve) => {
            const onSeeked = () => {
              videoElement.removeEventListener("seeked", onSeeked);
              resolve();
            };
            videoElement.addEventListener("seeked", onSeeked);
            videoElement.currentTime = t;
          });
        }

        const tsMs = performance.now();
        const rawCx = extractCenterX(detector, videoElement, tsMs);
        if (rawCx !== null) {
          timeline.push({ time: t, centerX: rawCx });
        } else if (timeline.length > 0) {
          // Hold last known position
          timeline.push({
            time: t,
            centerX: timeline[timeline.length - 1].centerX,
          });
        } else {
          timeline.push({ time: t, centerX: 0.5 });
        }
      }

      // Restore
      videoElement.currentTime = savedTime;
      if (wasPlaying) videoElement.play();

      return smoothTimeline(timeline);
    },
    [ensureDetector, extractCenterX],
  );

  return {
    isLoading,
    startTracking,
    stopTracking,
    getCenterX,
    buildExportTimeline,
  };
}
