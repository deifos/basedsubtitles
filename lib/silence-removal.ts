import type { WordStyleOverride } from "@/lib/transcript-utils";

export type SilenceRemovalLevel =
  | "off"
  | "aggressive"
  | "default"
  | "conservative";

export interface TimeRange {
  startTime: number;
  endTime: number;
}

export interface SilenceRemovalPlan {
  removedRanges: TimeRange[];
  keptRanges: Array<
    TimeRange & { outputStartTime: number; outputEndTime: number }
  >;
  outputDuration: number;
}

export interface SilenceAdjustableChunk {
  text: string;
  timestamp: [number, number];
  disabled?: boolean;
  subtitleHidden?: boolean;
  dynamicPosition?: "behind" | "front";
  styleOverride?: WordStyleOverride;
}

const SAMPLE_RATE = 16000;
const SILENCE_RMS_THRESHOLD = 0.01;
const WINDOW_SIZE_MS = 50;
const SPEECH_EDGE_GUARD_SEC = 0.12;
const MIN_TRIMMED_SILENCE_SEC = 0.1;

export const SILENCE_REMOVAL_LEVELS: Record<
  Exclude<SilenceRemovalLevel, "off">,
  { label: string; minDuration: number }
> = {
  aggressive: { label: "0.3s+ (Aggressive)", minDuration: 0.3 },
  default: { label: "0.5s+ (Default)", minDuration: 0.5 },
  conservative: { label: "1.0s+ (Conservative)", minDuration: 1 },
};

export function detectSilenceRanges(
  audioData: Float32Array,
  minDuration: number,
  threshold: number = SILENCE_RMS_THRESHOLD,
  sampleRate: number = SAMPLE_RATE,
): TimeRange[] {
  const windowSize = Math.max(
    1,
    Math.floor((WINDOW_SIZE_MS / 1000) * sampleRate),
  );
  const ranges: TimeRange[] = [];
  let silenceStart: number | null = null;

  for (let i = 0; i < audioData.length; i += windowSize) {
    const end = Math.min(i + windowSize, audioData.length);
    const len = end - i;
    let sumSq = 0;

    for (let j = i; j < end; j += 1) {
      sumSq += audioData[j] * audioData[j];
    }

    const rms = Math.sqrt(sumSq / len);
    const time = i / sampleRate;

    if (rms < threshold) {
      silenceStart ??= time;
    } else if (silenceStart !== null) {
      if (time - silenceStart >= minDuration) {
        const protectedRange = protectSpeechEdges({
          startTime: silenceStart,
          endTime: time,
        });
        if (protectedRange) ranges.push(protectedRange);
      }
      silenceStart = null;
    }
  }

  if (silenceStart !== null) {
    const endTime = audioData.length / sampleRate;
    if (endTime - silenceStart >= minDuration) {
      const protectedRange = protectSpeechEdges({
        startTime: silenceStart,
        endTime,
      });
      if (protectedRange) ranges.push(protectedRange);
    }
  }

  return mergeRanges(ranges);
}

export function createSilenceRemovalPlan(
  duration: number,
  removedRanges: TimeRange[],
): SilenceRemovalPlan {
  const normalizedRanges = normalizeRanges(removedRanges, duration);
  const keptRanges: SilenceRemovalPlan["keptRanges"] = [];
  let sourceCursor = 0;
  let outputCursor = 0;

  for (const range of normalizedRanges) {
    if (range.startTime > sourceCursor) {
      const outputStartTime = outputCursor;
      const outputEndTime = outputCursor + range.startTime - sourceCursor;
      keptRanges.push({
        startTime: sourceCursor,
        endTime: range.startTime,
        outputStartTime,
        outputEndTime,
      });
      outputCursor = outputEndTime;
    }
    sourceCursor = Math.max(sourceCursor, range.endTime);
  }

  if (sourceCursor < duration) {
    keptRanges.push({
      startTime: sourceCursor,
      endTime: duration,
      outputStartTime: outputCursor,
      outputEndTime: outputCursor + duration - sourceCursor,
    });
    outputCursor += duration - sourceCursor;
  }

  return {
    removedRanges: normalizedRanges,
    keptRanges,
    outputDuration: Math.max(0, outputCursor),
  };
}

export function sourceTimeToOutputTime(
  sourceTime: number,
  plan: SilenceRemovalPlan,
): number {
  const clamped = Math.max(0, sourceTime);
  let removedBefore = 0;

  for (const range of plan.removedRanges) {
    if (clamped >= range.endTime) {
      removedBefore += range.endTime - range.startTime;
    } else if (clamped > range.startTime) {
      removedBefore += clamped - range.startTime;
      break;
    } else {
      break;
    }
  }

  return Math.max(0, clamped - removedBefore);
}

export function outputTimeToSourceTime(
  outputTime: number,
  plan: SilenceRemovalPlan,
): number {
  if (plan.keptRanges.length === 0) return 0;

  const clamped = Math.max(0, Math.min(outputTime, plan.outputDuration));
  for (const range of plan.keptRanges) {
    if (clamped <= range.outputEndTime) {
      return Math.min(
        range.endTime,
        range.startTime + Math.max(0, clamped - range.outputStartTime),
      );
    }
  }

  return plan.keptRanges[plan.keptRanges.length - 1].endTime;
}

export function isSourceTimeRemoved(
  sourceTime: number,
  removedRanges: TimeRange[],
): boolean {
  return removedRanges.some(
    (range) => sourceTime >= range.startTime && sourceTime < range.endTime,
  );
}

export function adjustTranscriptChunksForSilenceRemoval<
  T extends SilenceAdjustableChunk,
>(chunks: T[], plan: SilenceRemovalPlan): T[] {
  if (plan.removedRanges.length === 0) return chunks;

  return chunks
    .map((chunk) => {
      const [sourceStart, sourceEnd] = chunk.timestamp;
      const sourceMid = (sourceStart + sourceEnd) / 2;
      if (isSourceTimeRemoved(sourceMid, plan.removedRanges)) {
        return null;
      }

      const start = sourceTimeToOutputTime(sourceStart, plan);
      const end = sourceTimeToOutputTime(sourceEnd, plan);
      if (end <= start) return null;

      return {
        ...chunk,
        timestamp: [start, end] as [number, number],
      };
    })
    .filter((chunk): chunk is T => chunk !== null);
}

function protectSpeechEdges(region: TimeRange): TimeRange | null {
  const duration = region.endTime - region.startTime;
  if (duration <= 0) return null;

  const maxGuard = Math.max(0, (duration - MIN_TRIMMED_SILENCE_SEC) / 2);
  const guard = Math.min(SPEECH_EDGE_GUARD_SEC, maxGuard);
  const startTime = region.startTime + guard;
  const endTime = region.endTime - guard;

  return endTime - startTime >= MIN_TRIMMED_SILENCE_SEC
    ? { startTime, endTime }
    : null;
}

function normalizeRanges(ranges: TimeRange[], duration: number): TimeRange[] {
  return mergeRanges(
    ranges
      .map((range) => ({
        startTime: Math.max(0, Math.min(duration, range.startTime)),
        endTime: Math.max(0, Math.min(duration, range.endTime)),
      }))
      .filter((range) => range.endTime - range.startTime >= 0.05),
  );
}

function mergeRanges(ranges: TimeRange[]): TimeRange[] {
  if (ranges.length === 0) return [];

  const sorted = [...ranges].sort((a, b) => a.startTime - b.startTime);
  const merged: TimeRange[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const previous = merged[merged.length - 1];
    if (current.startTime <= previous.endTime + 0.001) {
      previous.endTime = Math.max(previous.endTime, current.endTime);
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}
