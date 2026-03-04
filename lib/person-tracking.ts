export interface PositionKeyframe {
  time: number;
  centerX: number; // 0-1 normalized, 0.5 = center
}

export type PositionTimeline = PositionKeyframe[];

/**
 * Binary search + linear interpolation to get centerX at a given time.
 * Returns 0.5 (center) if timeline is empty.
 */
export function interpolateCenterX(
  timeline: PositionTimeline,
  time: number,
): number {
  if (timeline.length === 0) return 0.5;
  if (timeline.length === 1) return timeline[0].centerX;

  // Before first keyframe
  if (time <= timeline[0].time) return timeline[0].centerX;
  // After last keyframe
  if (time >= timeline[timeline.length - 1].time)
    return timeline[timeline.length - 1].centerX;

  // Binary search for the two surrounding keyframes
  let lo = 0;
  let hi = timeline.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (timeline[mid].time <= time) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const a = timeline[lo];
  const b = timeline[hi];
  const t = (time - a.time) / (b.time - a.time);
  return a.centerX + (b.centerX - a.centerX) * t;
}

/**
 * Single-step exponential moving average for real-time smoothing.
 */
export function smoothCenterX(
  prevSmoothed: number,
  raw: number,
  alpha: number = 0.15,
): number {
  return prevSmoothed + alpha * (raw - prevSmoothed);
}

/**
 * EMA forward pass on a full timeline. Returns a new smoothed timeline.
 */
export function smoothTimeline(
  timeline: PositionTimeline,
  alpha: number = 0.15,
): PositionTimeline {
  if (timeline.length === 0) return [];
  const result: PositionTimeline = [
    { time: timeline[0].time, centerX: timeline[0].centerX },
  ];
  for (let i = 1; i < timeline.length; i++) {
    result.push({
      time: timeline[i].time,
      centerX: smoothCenterX(result[i - 1].centerX, timeline[i].centerX, alpha),
    });
  }
  return result;
}

/**
 * Convert normalized centerX (0-1) to pixel crop X offset,
 * clamped to [0, srcW - cropW].
 */
export function computeCropX(
  centerX: number,
  srcW: number,
  cropW: number,
): number {
  const pixelCenter = centerX * srcW;
  const x = Math.round(pixelCenter - cropW / 2);
  return Math.max(0, Math.min(x, srcW - cropW));
}
