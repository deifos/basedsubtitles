export interface AutoZoomTransform {
  scale: number;
  x: number;
  y: number;
}

const MIN_CUT_INTERVAL_SECONDS = 5;
const MAX_CUT_INTERVAL_SECONDS = 7;
const FALLBACK_CUT_INTERVAL_SECONDS = 6;
const FAR_SCALE = 1.02;
const CLOSE_SCALE = 1.28;
const FACE_CENTERING_STRENGTH = 0.9;
const WORD_ANCHOR_WINDOW_SECONDS = 1.35;

export function createAutoZoomCutSchedule(
  wordStartTimes: number[],
  duration: number,
): number[] {
  if (!Number.isFinite(duration) || duration <= MIN_CUT_INTERVAL_SECONDS) {
    return [0];
  }

  const sortedStarts = wordStartTimes
    .filter((time) => Number.isFinite(time) && time > 0 && time < duration)
    .sort((a, b) => a - b);
  const schedule = [0];
  let wordIndex = 0;
  let target = nextCutTarget(0, 1, sortedStarts, duration);

  while (target < duration) {
    while (
      wordIndex < sortedStarts.length &&
      sortedStarts[wordIndex] < target - WORD_ANCHOR_WINDOW_SECONDS
    ) {
      wordIndex += 1;
    }

    const anchoredTime =
      wordIndex < sortedStarts.length &&
      sortedStarts[wordIndex] <= target + WORD_ANCHOR_WINDOW_SECONDS
        ? sortedStarts[wordIndex]
        : target;
    const previousTime = schedule[schedule.length - 1];

    if (anchoredTime - previousTime >= MIN_CUT_INTERVAL_SECONDS * 0.75) {
      schedule.push(anchoredTime);
    }

    target = nextCutTarget(
      Math.max(target, schedule[schedule.length - 1]),
      schedule.length,
      sortedStarts,
      duration,
    );
  }

  return schedule;
}

export function getAutoZoomTransform(
  time: number,
  duration: number,
  faceX: number = 0.5,
  cutSchedule?: readonly number[],
): AutoZoomTransform {
  if (!Number.isFinite(time) || !Number.isFinite(duration) || duration <= 0) {
    return { scale: 1, x: 0, y: 0 };
  }

  const clampedTime = Math.max(0, Math.min(time, duration));
  const cutIndex = getAutoZoomCutIndex(clampedTime, cutSchedule);
  const scale = getScaleForCut(cutIndex);
  const normalizedFaceX = Number.isFinite(faceX)
    ? Math.max(0.08, Math.min(0.92, faceX))
    : 0.5;

  return {
    scale,
    x: (0.5 - normalizedFaceX) * scale * FACE_CENTERING_STRENGTH,
    y: 0,
  };
}

export function getAutoZoomCssTransform(
  time: number,
  duration: number,
  faceX: number = 0.5,
  cutSchedule?: readonly number[],
): string {
  const transform = getAutoZoomTransform(time, duration, faceX, cutSchedule);
  return `translate(${transform.x * 100}%, ${transform.y * 100}%) scale(${transform.scale})`;
}

export function drawImageWithAutoZoom(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  image: CanvasImageSource,
  sourceX: number,
  sourceY: number,
  sourceWidth: number,
  sourceHeight: number,
  destX: number,
  destY: number,
  destWidth: number,
  destHeight: number,
  time: number,
  duration: number,
  faceX: number = 0.5,
  cutSchedule?: readonly number[],
) {
  const transform = getAutoZoomTransform(time, duration, faceX, cutSchedule);
  const cropWidth = sourceWidth / transform.scale;
  const cropHeight = sourceHeight / transform.scale;
  const normalizedFaceX = Number.isFinite(faceX)
    ? Math.max(0.08, Math.min(0.92, faceX))
    : 0.5;
  const cropCenterX = sourceX + sourceWidth * normalizedFaceX;
  const cropCenterY = sourceY + sourceHeight / 2;
  const cropX = Math.max(
    sourceX,
    Math.min(sourceX + sourceWidth - cropWidth, cropCenterX - cropWidth / 2),
  );
  const cropY = Math.max(
    sourceY,
    Math.min(sourceY + sourceHeight - cropHeight, cropCenterY - cropHeight / 2),
  );

  ctx.drawImage(
    image,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    destX,
    destY,
    destWidth,
    destHeight,
  );
}

function getScaleForCut(index: number) {
  return index % 2 === 0 ? FAR_SCALE : CLOSE_SCALE;
}

export function getAutoZoomCutIndex(
  time: number,
  cutSchedule?: readonly number[],
) {
  if (!cutSchedule?.length) {
    return Math.floor(time / FALLBACK_CUT_INTERVAL_SECONDS);
  }

  let cutIndex = 0;
  for (let i = 1; i < cutSchedule.length; i += 1) {
    if (cutSchedule[i] > time) break;
    cutIndex = i;
  }

  return cutIndex;
}

function nextCutTarget(
  previousTime: number,
  cutNumber: number,
  wordStartTimes: readonly number[],
  duration: number,
) {
  const interval =
    MIN_CUT_INTERVAL_SECONDS +
    seededRandom(cutNumber, wordStartTimes, duration) *
      (MAX_CUT_INTERVAL_SECONDS - MIN_CUT_INTERVAL_SECONDS);

  return previousTime + interval;
}

function seededRandom(
  cutNumber: number,
  wordStartTimes: readonly number[],
  duration: number,
) {
  const firstWord = wordStartTimes[0] ?? 0;
  const lastWord = wordStartTimes[wordStartTimes.length - 1] ?? duration;
  const seed =
    cutNumber * 12.9898 +
    duration * 0.071 +
    firstWord * 0.37 +
    lastWord * 0.19 +
    wordStartTimes.length * 0.013;
  const value = Math.sin(seed) * 43758.5453;

  return value - Math.floor(value);
}
