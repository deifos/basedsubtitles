import { SubtitleStyle } from "@/components/subtitle-styling";
import { processTranscriptChunks } from "@/lib/utils";

interface TranscriptData {
  text: string;
  chunks: Array<{
    text: string;
    timestamp: [number, number];
    disabled?: boolean;
    dynamicPosition?: "behind" | "front";
  }>;
}

interface WordTiming {
  text: string;
  timestamp: [number, number];
  dynamicPosition?: "behind" | "front";
}

export interface FaceBounds {
  chinY: number; // Y coordinate of estimated chin in canvas pixels
}

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
};

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

/**
 * Render the current subtitle for a given time onto a canvas context.
 * Used by both the preview compositing (video-upload.tsx) and export (useVideoDownloadMediaBunny.ts).
 */
export function renderSubtitleToCanvas(
  ctx: CanvasRenderingContext2D,
  transcript: TranscriptData,
  currentTime: number,
  style: SubtitleStyle,
  mode: "word" | "phrase" | "dynamic",
  canvasWidth: number,
  canvasHeight: number
) {
  // processTranscriptChunks handles dynamic mode internally now
  const processedChunks = processTranscriptChunks(transcript, mode, style.maxWordsPerLine);

  // Filter enabled chunks
  const enabledChunks = processedChunks.filter((chunk) => {
    if ((mode === "phrase" || mode === "dynamic") && chunk.words) {
      return !chunk.words.some((word) =>
        transcript.chunks.find(
          (c) =>
            c.timestamp[0] === word.timestamp[0] &&
            c.timestamp[1] === word.timestamp[1]
        )?.disabled
      );
    }
    const original = transcript.chunks.find(
      (c) =>
        c.timestamp[0] === chunk.timestamp[0] &&
        c.timestamp[1] === chunk.timestamp[1]
    );
    return !original?.disabled;
  });

  const currentChunk = enabledChunks.find(
    (chunk) =>
      currentTime >= chunk.timestamp[0] && currentTime <= chunk.timestamp[1]
  );

  if (!currentChunk) return;

  if (mode === "dynamic") {
    // Legacy path: renders all dynamic text (behind+front) as one block
    // Used only for non-compositing fallback
    renderDynamicWordToCanvas(
      ctx,
      currentChunk.text,
      style,
      canvasWidth,
      canvasHeight
    );
    return;
  }

  renderChunkToCanvas(
    ctx,
    currentChunk,
    style,
    canvasWidth,
    canvasHeight,
    mode,
    currentTime
  );
}

/**
 * Estimate face position from a 256px person mask.
 * Returns estimated chin Y in canvas coordinates, or null if no person found.
 */
export function estimateFaceFromMask(
  maskData: Uint8Array,
  maskWidth: number,
  maskHeight: number,
  canvasWidth: number,
  canvasHeight: number
): FaceBounds | null {
  let minY = maskHeight;
  let maxY = 0;
  let found = false;

  for (let y = 0; y < maskHeight; y++) {
    for (let x = 0; x < maskWidth; x++) {
      if (maskData[y * maskWidth + x] > 128) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        found = true;
      }
    }
  }

  if (!found) return null;

  const personHeight = maxY - minY;
  // Face is approximately the top 20% of the person mask
  const chinMaskY = minY + personHeight * 0.2;
  // Scale from mask coordinates to canvas coordinates
  const chinY = (chinMaskY / maskHeight) * canvasHeight;

  return { chinY };
}

/**
 * Render "behind" words as large text for the dynamic behind layer.
 * Called BEFORE drawing the masked person foreground.
 */
export function renderDynamicBehindText(
  ctx: CanvasRenderingContext2D,
  transcript: TranscriptData,
  currentTime: number,
  style: SubtitleStyle,
  canvasWidth: number,
  canvasHeight: number
) {
  const processedChunks = processTranscriptChunks(transcript, "dynamic", style.maxWordsPerLine);

  const enabledChunks = processedChunks.filter((chunk) => {
    if (chunk.words) {
      return !chunk.words.some((word) =>
        transcript.chunks.find(
          (c) =>
            c.timestamp[0] === word.timestamp[0] &&
            c.timestamp[1] === word.timestamp[1]
        )?.disabled
      );
    }
    return true;
  });

  const currentChunk = enabledChunks.find(
    (chunk) =>
      currentTime >= chunk.timestamp[0] && currentTime <= chunk.timestamp[1]
  );

  if (!currentChunk || !currentChunk.words) return;

  // Filter only "behind" words
  const behindWords = currentChunk.words.filter(
    (w) => w.dynamicPosition === "behind"
  );
  if (behindWords.length === 0) return;

  const behindText = behindWords.map((w) => w.text).join(" ");
  renderDynamicTextBlock(ctx, behindText, style, canvasWidth, canvasHeight, {
    fontSize: style.dynamicFontSize ?? 80,
    yPosition: style.dynamicYPosition ?? 35,
  });
}

/**
 * Render "front" words as smaller text for the dynamic front layer.
 * Called AFTER drawing the masked person foreground.
 */
export function renderDynamicFrontText(
  ctx: CanvasRenderingContext2D,
  transcript: TranscriptData,
  currentTime: number,
  style: SubtitleStyle,
  canvasWidth: number,
  canvasHeight: number,
  faceBounds?: FaceBounds | null
) {
  const processedChunks = processTranscriptChunks(transcript, "dynamic", style.maxWordsPerLine);

  const enabledChunks = processedChunks.filter((chunk) => {
    if (chunk.words) {
      return !chunk.words.some((word) =>
        transcript.chunks.find(
          (c) =>
            c.timestamp[0] === word.timestamp[0] &&
            c.timestamp[1] === word.timestamp[1]
        )?.disabled
      );
    }
    return true;
  });

  const currentChunk = enabledChunks.find(
    (chunk) =>
      currentTime >= chunk.timestamp[0] && currentTime <= chunk.timestamp[1]
  );

  if (!currentChunk || !currentChunk.words) return;

  // Filter only "front" words
  const frontWords = currentChunk.words.filter(
    (w) => w.dynamicPosition === "front"
  );
  if (frontWords.length === 0) return;

  const frontText = frontWords.map((w) => w.text).join(" ");

  // Calculate Y position: below face if detected, otherwise fallback
  let yPosition = style.dynamicFrontYPosition ?? 75;
  if (faceBounds) {
    // Convert chin Y to percentage of canvas height, then add 5% margin
    const chinPercent = (faceBounds.chinY / canvasHeight) * 100;
    yPosition = Math.min(95, chinPercent + 5);
  }

  renderDynamicTextBlock(ctx, frontText, style, canvasWidth, canvasHeight, {
    fontSize: style.dynamicFrontFontSize ?? 40,
    yPosition,
  });
}

/**
 * Shared renderer for dynamic text blocks (both behind and front layers).
 */
function renderDynamicTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: SubtitleStyle,
  canvasWidth: number,
  canvasHeight: number,
  options: { fontSize: number; yPosition: number }
) {
  const upperText = text.toUpperCase();
  const fontFamily = resolveFontFamily(style.fontFamily);
  const videoScale = canvasHeight / 500;

  const fontSize = Math.round(options.fontSize * videoScale);
  const maxWidth = canvasWidth * 0.85;

  ctx.font = `${style.fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Word-wrap
  const words = upperText.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  const lineHeight = fontSize * 1.1;
  const totalHeight = lines.length * lineHeight;
  const x = canvasWidth / 2;

  const yCenter = canvasHeight * (options.yPosition / 100);
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
        lineY + fontSize / 2
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

/**
 * Render dynamic subtitle - large text with configurable size and position.
 * Text wraps onto multiple lines when too wide. The person mask creates natural
 * behind/in-front depth as parts of the text overlap with the person.
 */
function renderDynamicWordToCanvas(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: SubtitleStyle,
  canvasWidth: number,
  canvasHeight: number
) {
  const upperText = text.toUpperCase();
  const fontFamily = resolveFontFamily(style.fontFamily);
  const videoScale = canvasHeight / 500;

  // Use configurable font size, scaled to canvas
  const fontSize = Math.round((style.dynamicFontSize ?? 80) * videoScale);
  const maxWidth = canvasWidth * 0.85;

  ctx.font = `${style.fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Word-wrap the text to fit within maxWidth
  const words = upperText.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  const lineHeight = fontSize * 1.1;
  const totalHeight = lines.length * lineHeight;
  const x = canvasWidth / 2;

  // Configurable vertical position (0=top, 100=bottom)
  const yPercent = style.dynamicYPosition ?? 35;
  const yCenter = canvasHeight * (yPercent / 100);
  const startY = yCenter - totalHeight / 2 + lineHeight / 2;

  // Render each line
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
        lineY + fontSize / 2
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

function renderChunkToCanvas(
  ctx: CanvasRenderingContext2D,
  chunk: { text: string; timestamp: [number, number]; words?: WordTiming[] },
  style: SubtitleStyle,
  canvasWidth: number,
  canvasHeight: number,
  mode: "word" | "phrase" | "dynamic",
  currentTime: number
) {
  const displayText = chunk.text;
  const isVerticalVideo = canvasHeight > canvasWidth;

  const previewHeight = 500;
  const videoScale = canvasHeight / previewHeight;
  const finalFontSize = Math.round(style.fontSize * videoScale);

  const fontFamily = resolveFontFamily(style.fontFamily);
  const fontString = `${style.fontWeight} ${finalFontSize}px ${fontFamily}`;
  ctx.font = fontString;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const x = canvasWidth / 2;

  // Text wrapping
  const wordsInText = displayText.split(" ");
  const maxWordsPerLine =
    style.maxWordsPerLine ?? (isVerticalVideo ? 4 : 6);
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

  const position = style.position ?? "bottom";
  let baseY: number;
  switch (position) {
    case "top":
      baseY =
        canvasHeight * (isVerticalVideo ? 0.06 : 0.12) + totalHeight / 2;
      break;
    case "middle":
      baseY = canvasHeight / 2;
      break;
    case "bottom":
    default:
      baseY =
        canvasHeight -
        canvasHeight * (isVerticalVideo ? 0.08 : 0.16);
      break;
  }

  const startY = baseY - totalHeight / 2 + lineHeight / 2;

  // Draw background
  if (style.backgroundColor && style.backgroundColor !== "transparent") {
    const borderRadius = 8 * videoScale;
    const paddingX = 12 * videoScale;
    const paddingY = 8 * videoScale;

    let maxWidth = 0;
    lines.forEach((line) => {
      const metrics = ctx.measureText(line.toUpperCase());
      maxWidth = Math.max(maxWidth, metrics.width);
    });

    const bgX = x - maxWidth / 2 - paddingX;
    const bgY = baseY - totalHeight / 2 - paddingY;
    const bgWidth = maxWidth + paddingX * 2;
    const bgHeight = totalHeight + paddingY * 2;

    ctx.fillStyle = style.backgroundColor;
    ctx.beginPath();
    ctx.roundRect(bgX, bgY, bgWidth, bgHeight, borderRadius);
    ctx.fill();
  }

  const phraseWords = Array.isArray(chunk.words) ? chunk.words : undefined;
  const canEmphasize =
    style.wordEmphasisEnabled &&
    mode === "phrase" &&
    phraseWords &&
    phraseWords.length > 0 &&
    Number.isFinite(currentTime);

  if (canEmphasize) {
    const lineWordGroups =
      splitPoint !== null && phraseWords
        ? [
            phraseWords.slice(0, splitPoint),
            phraseWords.slice(splitPoint),
          ].filter((group) => group.length > 0)
        : [phraseWords];

    lineWordGroups.forEach((wordGroup, index) => {
      const lineY = startY + index * (lineHeight + lineGap);
      renderPhraseLineWithEmphasis(
        ctx,
        wordGroup,
        x,
        lineY,
        style,
        videoScale,
        currentTime,
        finalFontSize
      );
    });
    return;
  }

  lines.forEach((line, index) => {
    const lineY = startY + index * (lineHeight + lineGap);
    renderTextLine(ctx, line, x, lineY, style, videoScale);
  });
}

function renderTextLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: SubtitleStyle,
  baseScale: number = 1
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
      y + gradientHeight
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
    ctx.shadowBlur = Math.max(
      2,
      style.dropShadowIntensity * 4 * baseScale
    );
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

function renderPhraseLineWithEmphasis(
  ctx: CanvasRenderingContext2D,
  words: WordTiming[],
  centerX: number,
  centerY: number,
  style: SubtitleStyle,
  baseScale: number,
  currentTime: number,
  finalFontSize: number
) {
  if (words.length === 0) return;

  const uppercaseWords = words.map((word) => word.text.toUpperCase());
  const spaceWidth = 0.35 * finalFontSize;
  const scales = words.map((word) =>
    currentTime >= word.timestamp[0] &&
    currentTime <= word.timestamp[1] &&
    style.wordEmphasisEnabled
      ? 1.18
      : 1
  );

  const baseWidths = uppercaseWords.map(
    (value) => ctx.measureText(value).width
  );
  const scaledWidths = baseWidths.map(
    (width, index) => width * scales[index]
  );
  const totalWidth =
    scaledWidths.reduce((total, width) => total + width, 0) +
    spaceWidth * Math.max(0, words.length - 1);
  let cursor = centerX - totalWidth / 2;

  const highlightPaddingX = finalFontSize * 0.15;
  const highlightPaddingY = finalFontSize * 0.08;
  const highlightRadius = finalFontSize * 0.35;

  const textIsLight = isLightColor(style.color);
  const emphasisBgColor = textIsLight
    ? "rgba(0, 0, 0, 0.65)"
    : "rgba(255, 255, 255, 0.85)";
  const emphasisTextColor = textIsLight ? "#FFFFFF" : "#000000";

  words.forEach((word, index) => {
    const displayText = uppercaseWords[index];
    const scale = scales[index];
    const scaledWidth = scaledWidths[index];
    const baseWidth = baseWidths[index];
    const isActive = scale > 1;
    const wordCenterX = cursor + scaledWidth / 2;

    if (isActive) {
      const boxWidth = scaledWidth + highlightPaddingX * 2;
      const boxHeight = finalFontSize * scale + highlightPaddingY * 2;

      ctx.save();
      ctx.fillStyle = emphasisBgColor;
      ctx.beginPath();
      ctx.roundRect(
        wordCenterX - boxWidth / 2,
        centerY - boxHeight / 2,
        boxWidth,
        boxHeight,
        highlightRadius
      );
      ctx.fill();
      ctx.restore();
    }

    const fillColor = isActive ? emphasisTextColor : style.color;

    drawWordText(
      ctx,
      displayText,
      wordCenterX,
      centerY,
      style,
      baseScale,
      scale,
      baseWidth,
      fillColor
    );

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
  fillColor: string
) {
  const uppercase = text.toUpperCase();

  if (style.borderWidth > 0) {
    ctx.save();
    ctx.strokeStyle = style.borderColor;
    const scaledBorderWidth = Math.max(
      0.5,
      (style.borderWidth * baseScale) / Math.max(scale, 0.001)
    );
    ctx.lineWidth = scaledBorderWidth;
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;
    ctx.strokeText(uppercase, 0, 0);
    ctx.restore();
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
      centerY + gradientHeight
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
    ctx.shadowBlur = Math.max(
      2,
      style.dropShadowIntensity * 5 * baseScale
    );
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
