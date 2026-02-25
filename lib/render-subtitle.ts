import { SubtitleStyle } from "@/components/subtitle-styling";
import { processTranscriptChunks, type WordStyleOverride } from "@/lib/utils";

interface TranscriptData {
  text: string;
  chunks: Array<{
    text: string;
    timestamp: [number, number];
    disabled?: boolean;
    subtitleHidden?: boolean;
    dynamicPosition?: "behind" | "front";
    styleOverride?: WordStyleOverride;
  }>;
}

interface WordTiming {
  text: string;
  timestamp: [number, number];
  dynamicPosition?: "behind" | "front";
  styleOverride?: WordStyleOverride;
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
  "var(--font-plus-jakarta-sans)": "Plus Jakarta Sans",
  "var(--font-outfit)": "Outfit",
  "var(--font-lilita-one)": "Lilita One",
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
  mode: "word" | "phrase",
  canvasWidth: number,
  canvasHeight: number
) {
  const processedChunks = processTranscriptChunks(transcript, mode, style.maxWordsPerLine);

  // Filter enabled chunks (exclude disabled and subtitleHidden)
  const enabledChunks = processedChunks.filter((chunk) => {
    if (mode === "phrase" && chunk.words) {
      return !chunk.words.some((word) => {
        const original = transcript.chunks.find(
          (c) =>
            c.timestamp[0] === word.timestamp[0] &&
            c.timestamp[1] === word.timestamp[1]
        );
        return original?.disabled || original?.subtitleHidden;
      });
    }
    const original = transcript.chunks.find(
      (c) =>
        c.timestamp[0] === chunk.timestamp[0] &&
        c.timestamp[1] === chunk.timestamp[1]
    );
    return !original?.disabled && !original?.subtitleHidden;
  });

  const currentChunk = enabledChunks.find(
    (chunk) =>
      currentTime >= chunk.timestamp[0] && currentTime <= chunk.timestamp[1]
  );

  if (!currentChunk) return;

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
  // Face/head is approximately the top 30% of the visible person
  // The chin sits at roughly 30% down from the top of the person bounding box
  const chinMaskY = minY + personHeight * 0.30;
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
  const processedChunks = processTranscriptChunks(transcript, "phrase", style.maxWordsPerLine, true);

  const enabledChunks = processedChunks.filter((chunk) => {
    if (chunk.words) {
      return !chunk.words.some((word) => {
        const original = transcript.chunks.find(
          (c) =>
            c.timestamp[0] === word.timestamp[0] &&
            c.timestamp[1] === word.timestamp[1]
        );
        return original?.disabled || original?.subtitleHidden;
      });
    }
    return true;
  });

  const currentChunk = enabledChunks.find(
    (chunk) =>
      currentTime >= chunk.timestamp[0] && currentTime <= chunk.timestamp[1]
  );

  if (!currentChunk || !currentChunk.words) return;

  // Filter only "behind" words, with progressive reveal if enabled
  let behindWords = currentChunk.words.filter(
    (w) => w.dynamicPosition === "behind"
  );
  if (style.dynamicFollowWord) {
    behindWords = behindWords.filter(w => currentTime >= w.timestamp[0]);
  }
  if (behindWords.length === 0) return;

  const behindText = behindWords.map((w) => w.text).join(" ");
  renderDynamicTextBlock(ctx, behindText, style, canvasWidth, canvasHeight, {
    fontSize: style.dynamicFontSize ?? 80,
    yPosition: style.dynamicYPosition ?? 35,
  }, behindWords, currentTime, currentChunk.timestamp[1]);
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
  const processedChunks = processTranscriptChunks(transcript, "phrase", style.maxWordsPerLine, true);

  const enabledChunks = processedChunks.filter((chunk) => {
    if (chunk.words) {
      return !chunk.words.some((word) => {
        const original = transcript.chunks.find(
          (c) =>
            c.timestamp[0] === word.timestamp[0] &&
            c.timestamp[1] === word.timestamp[1]
        );
        return original?.disabled || original?.subtitleHidden;
      });
    }
    return true;
  });

  const currentChunk = enabledChunks.find(
    (chunk) =>
      currentTime >= chunk.timestamp[0] && currentTime <= chunk.timestamp[1]
  );

  if (!currentChunk || !currentChunk.words) return;

  // Filter only "front" words, with progressive reveal if enabled
  let frontWords = currentChunk.words.filter(
    (w) => w.dynamicPosition === "front"
  );
  if (style.dynamicFollowWord) {
    frontWords = frontWords.filter(w => currentTime >= w.timestamp[0]);
  }
  if (frontWords.length === 0) return;

  const frontText = frontWords.map((w) => w.text).join(" ");

  // Calculate Y position: below face if detected, otherwise fallback
  const fallbackY = style.dynamicFrontYPosition ?? 75;
  let yPosition = fallbackY;
  if (faceBounds) {
    // Place text below the chin with a 10% margin
    const chinPercent = (faceBounds.chinY / canvasHeight) * 100;
    const faceBasedY = Math.min(90, chinPercent + 10);
    // Use whichever is lower (further down) — never place above the fallback
    yPosition = Math.max(fallbackY, faceBasedY);
  }

  renderDynamicTextBlock(ctx, frontText, style, canvasWidth, canvasHeight, {
    fontSize: style.dynamicFrontFontSize ?? 40,
    yPosition,
  }, frontWords, currentTime, currentChunk.timestamp[1]);
}

/**
 * Shared renderer for dynamic text blocks (both behind and front layers).
 * When `wordTimings` is provided and any word has a styleOverride, renders word-by-word.
 */
function renderDynamicTextBlock(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: SubtitleStyle,
  canvasWidth: number,
  canvasHeight: number,
  options: { fontSize: number; yPosition: number },
  wordTimings?: WordTiming[],
  currentTime?: number,
  chunkEndTime?: number
) {
  const fontFamily = resolveFontFamily(style.fontFamily);
  const videoScale = canvasHeight / 500;
  const fontSize = Math.round(options.fontSize * videoScale);
  const maxWidth = canvasWidth * 0.85;
  const globalFont = `${style.fontWeight} ${fontSize}px ${fontFamily}`;

  ctx.font = globalFont;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const hasOverrides = wordTimings?.some((w) => w.styleOverride);

  // Word-wrap into lines (indices track which wordTimings belong to each line)
  const upperWords = text.toUpperCase().split(" ");
  const lines: string[] = [];
  const lineWordIndices: number[][] = []; // per-line array of wordTimings indices
  let currentLine = "";
  let currentIndices: number[] = [];

  for (let wi = 0; wi < upperWords.length; wi++) {
    const word = upperWords[wi];
    const testLine = currentLine ? `${currentLine} ${word}` : word;

    // Measure with per-word font if override exists
    if (hasOverrides && wordTimings?.[wi]?.styleOverride?.fontFamily) {
      ctx.font = buildWordFont(style, fontSize, wordTimings[wi].styleOverride);
    }
    const testWidth = ctx.measureText(testLine).width;
    if (hasOverrides) ctx.font = globalFont;

    if (testWidth > maxWidth && currentLine) {
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
  const x = canvasWidth / 2;
  const yCenter = canvasHeight * (options.yPosition / 100);
  const startY = yCenter - totalHeight / 2 + lineHeight / 2;

  const useTextFade = (style.textFadeIn ?? false) && wordTimings && currentTime != null;
  const fadeOutDuration = 0.25;
  const chunkFadeOut = (useTextFade && chunkEndTime != null)
    ? Math.min(1, Math.max(0, (chunkEndTime - currentTime!) / fadeOutDuration))
    : 1;

  // Need word-by-word rendering when we have overrides OR textFadeIn
  const needsWordByWord = (hasOverrides || useTextFade) && wordTimings;

  for (let i = 0; i < lines.length; i++) {
    const lineY = startY + i * lineHeight;
    const lineText = lines[i];

    if (needsWordByWord) {
      const indices = lineWordIndices[i];
      const lineWords = indices.map((idx) => ({
        text: upperWords[idx],
        override: wordTimings[idx]?.styleOverride,
        timing: wordTimings[idx],
      }));

      // Measure each word and compute total width for centering
      const spaceWidth = ctx.measureText(" ").width;
      const wordWidths = lineWords.map((w) => {
        if (w.override?.fontFamily || w.override?.fontSize) {
          ctx.font = buildWordFont(style, fontSize, w.override);
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

        // Set per-word font
        if (w.override?.fontFamily || w.override?.fontSize) {
          ctx.font = buildWordFont(style, fontSize, w.override);
        }

        // Compute per-character alphas for letter-by-letter fade
        let charAlphas: number[] | undefined;
        if (useTextFade && !isKnockout && w.timing) {
          const timeSinceWordStart = currentTime! - w.timing.timestamp[0];
          const wordDuration = w.timing.timestamp[1] - w.timing.timestamp[0];
          const revealDuration = Math.min(0.3, wordDuration * 0.6);
          const charCount = w.text.length;
          const letterStagger = charCount > 0 ? revealDuration / charCount : 0;
          charAlphas = [];
          for (let ci = 0; ci < charCount; ci++) {
            charAlphas.push(Math.min(1, Math.max(0, (timeSinceWordStart - ci * letterStagger) / 0.06)) * chunkFadeOut);
          }
        }

        ctx.save();
        if (!charAlphas) ctx.globalAlpha = chunkFadeOut;
        renderDynamicWord(ctx, w.text, wordX, lineY, style, wordColor, fontSize, videoScale, w.override?.effect, charAlphas);
        ctx.restore();

        // Restore font
        if (w.override?.fontFamily || w.override?.fontSize) {
          ctx.font = globalFont;
        }

        cursor += wWidth + spaceWidth;
      }
    } else {
      // Fast path: no overrides and no textFadeIn, render full line at once
      renderDynamicWord(ctx, lineText, x, lineY, style, style.color, fontSize, videoScale);
    }
  }
}

/** Render a single word/line of dynamic text at a given position. */
function renderDynamicWord(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: SubtitleStyle,
  fillColor: string,
  fontSize: number,
  videoScale: number,
  effect?: "knockout",
  charAlphas?: number[]
) {
  const upperText = text.toUpperCase();
  const isKnockout = effect === "knockout";

  // Per-character rendering when charAlphas provided
  if (charAlphas && charAlphas.length > 0 && !isKnockout) {
    const savedAlpha = ctx.globalAlpha;
    const chars = upperText.split("");
    const charWidths = chars.map(c => ctx.measureText(c).width);
    const totalCharWidth = charWidths.reduce((a, b) => a + b, 0);
    let charX = x - totalCharWidth / 2;

    for (let ci = 0; ci < chars.length; ci++) {
      const alpha = charAlphas[ci] ?? 1;
      ctx.globalAlpha = savedAlpha * alpha;
      const cx = charX + charWidths[ci] / 2;

      // Stroke
      const strokeWidth = Math.max(2, fontSize * 0.03);
      ctx.save();
      ctx.strokeStyle = style.borderColor || "#000000";
      ctx.lineWidth = strokeWidth;
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.strokeText(chars[ci], cx, y);
      ctx.restore();

      // Fill
      let charFillStyle: string | CanvasGradient = fillColor;
      if (fillColor === style.color && (style.color === "#CCCCCC" || style.color === "#C0C0C0")) {
        const tw = ctx.measureText(upperText).width;
        const gradient = ctx.createLinearGradient(x - tw / 2, y - fontSize / 2, x + tw / 2, y + fontSize / 2);
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

  // Stroke (skip for knockout)
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

  // Fill
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
      y + fontSize / 2
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


function renderChunkToCanvas(
  ctx: CanvasRenderingContext2D,
  chunk: { text: string; timestamp: [number, number]; words?: WordTiming[] },
  style: SubtitleStyle,
  canvasWidth: number,
  canvasHeight: number,
  mode: "word" | "phrase",
  currentTime: number
) {
  // Progressive word reveal: only show words spoken so far
  let displayText = chunk.text;
  let chunkWords = chunk.words;
  if (style.dynamicFollowWord && mode === "phrase" && chunk.words) {
    const visibleWords = chunk.words.filter(w => currentTime >= w.timestamp[0]);
    if (visibleWords.length === 0) return;
    displayText = visibleWords.map(w => w.text).join(" ");
    chunkWords = visibleWords;
  }

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

  const phraseWords = Array.isArray(chunkWords) ? chunkWords : undefined;
  const canEmphasize =
    (style.wordEmphasisEnabled || style.textFadeIn) &&
    mode === "phrase" &&
    phraseWords &&
    phraseWords.length > 0 &&
    Number.isFinite(currentTime);

  if (canEmphasize) {
    // Build line groups based on actual pixel width (accounts for per-word font overrides)
    const maxLineWidth = canvasWidth * (isVerticalVideo ? 0.85 : 0.90);
    const spaceWidth = 0.35 * finalFontSize;
    const lineWordGroups: typeof phraseWords[] = [];
    let currentLineWords: typeof phraseWords = [];
    let currentLineWidth = 0;

    for (let i = 0; i < phraseWords.length; i++) {
      const word = phraseWords[i];
      const wordText = word.text.toUpperCase();

      // Measure with per-word font if needed
      if (word.styleOverride?.fontFamily || word.styleOverride?.fontSize) {
        ctx.font = buildWordFont(style, finalFontSize, word.styleOverride);
      }
      const wordWidth = ctx.measureText(wordText).width;
      if (word.styleOverride?.fontFamily || word.styleOverride?.fontSize) {
        ctx.font = fontString;
      }

      const scale = (currentTime >= word.timestamp[0] && currentTime <= word.timestamp[1] && style.wordEmphasisEnabled) ? 1.18 : 1;
      const scaledWordWidth = wordWidth * scale;
      const widthIfAdded = currentLineWidth + (currentLineWords.length > 0 ? spaceWidth : 0) + scaledWordWidth;

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
    const emphTotalHeight = lineWordGroups.length * lineHeight + Math.max(0, lineWordGroups.length - 1) * lineGap;
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
        chunkEndTime
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
    const chunkFadeIn = Math.min(1, Math.max(0, timeSinceChunkStart / chunkFadeInDuration));
    const chunkFadeOut = Math.min(1, Math.max(0, timeToChunkEnd / chunkFadeOutDuration));
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

/** Build a font string, optionally applying per-word overrides. */
function buildWordFont(
  style: SubtitleStyle,
  finalFontSize: number,
  override?: WordStyleOverride
): string {
  const family = override?.fontFamily
    ? resolveFontFamily(override.fontFamily)
    : resolveFontFamily(style.fontFamily);
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
  chunkEndTime?: number
) {
  if (words.length === 0) return;

  const globalFont = `${style.fontWeight} ${finalFontSize}px ${resolveFontFamily(style.fontFamily)}`;
  const uppercaseWords = words.map((word) => word.text.toUpperCase());
  const spaceWidth = 0.35 * finalFontSize;
  const scales = words.map((word) =>
    currentTime >= word.timestamp[0] &&
    currentTime <= word.timestamp[1] &&
    style.wordEmphasisEnabled
      ? 1.18
      : 1
  );

  // Measure each word with its own font (per-word override support)
  const baseWidths = uppercaseWords.map((value, index) => {
    const word = words[index];
    if (word.styleOverride?.fontFamily || word.styleOverride?.fontSize) {
      ctx.font = buildWordFont(style, finalFontSize, word.styleOverride);
      const w = ctx.measureText(value).width;
      ctx.font = globalFont; // restore
      return w;
    }
    return ctx.measureText(value).width;
  });

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

  // Fade constants
  const fadeOutDuration = 0.25; // 250ms chunk fade-out
  const useTextFade = style.textFadeIn ?? false;

  words.forEach((word, index) => {
    const displayText = uppercaseWords[index];
    const scale = scales[index];
    const scaledWidth = scaledWidths[index];
    const baseWidth = baseWidths[index];
    const isActive = scale > 1;
    const wordCenterX = cursor + scaledWidth / 2;
    const isKnockout = word.styleOverride?.effect === "knockout";

    // Per-word fade
    const timeSinceWordStart = currentTime - word.timestamp[0];
    const chunkFadeOut = (useTextFade && chunkEndTime != null)
      ? Math.min(1, Math.max(0, (chunkEndTime - currentTime) / fadeOutDuration))
      : 1;
    const wordAlpha = chunkFadeOut;

    ctx.save();
    ctx.globalAlpha = wordAlpha;

    if (isActive) {
      const boxWidth = scaledWidth + highlightPaddingX * 2;
      const wordFontSize = word.styleOverride?.fontSize ? Math.round(finalFontSize * word.styleOverride.fontSize) : finalFontSize;
      const boxHeight = wordFontSize * scale + highlightPaddingY * 2;

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
    }

    const wordColor = word.styleOverride?.color;
    const fillColor = isActive ? emphasisTextColor : (wordColor ?? style.color);

    // Set per-word font if override exists
    if (word.styleOverride?.fontFamily || word.styleOverride?.fontSize) {
      ctx.font = buildWordFont(style, finalFontSize, word.styleOverride);
    }

    // Compute per-character alphas for letter-by-letter fade
    let charAlphas: number[] | undefined;
    if (useTextFade && !isKnockout) {
      const wordDuration = word.timestamp[1] - word.timestamp[0];
      const revealDuration = Math.min(0.3, wordDuration * 0.6);
      const charCount = displayText.length;
      const letterStagger = charCount > 0 ? revealDuration / charCount : 0;
      charAlphas = [];
      for (let ci = 0; ci < charCount; ci++) {
        charAlphas.push(Math.min(1, Math.max(0, (timeSinceWordStart - ci * letterStagger) / 0.06)));
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
      charAlphas
    );

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
  charAlphas?: number[]
) {
  const uppercase = text.toUpperCase();
  const isKnockout = effect === "knockout";

  // Per-character rendering when charAlphas provided
  if (charAlphas && charAlphas.length > 0 && !isKnockout) {
    // Measure each character's width to position them individually
    const savedAlpha = ctx.globalAlpha;
    const chars = uppercase.split("");
    const charWidths = chars.map(c => ctx.measureText(c).width);
    const totalCharWidth = charWidths.reduce((a, b) => a + b, 0);
    // Starting X so that text is centered at centerX (in scaled coords)
    let charX = -totalCharWidth / 2;

    for (let ci = 0; ci < chars.length; ci++) {
      const alpha = charAlphas[ci] ?? 1;
      ctx.globalAlpha = savedAlpha * alpha;

      const charCenterX = charX + charWidths[ci] / 2;

      // Stroke
      if (style.borderWidth > 0) {
        ctx.save();
        ctx.strokeStyle = style.borderColor;
        const scaledBorderWidth = Math.max(0.5, (style.borderWidth * baseScale) / Math.max(scale, 0.001));
        ctx.lineWidth = scaledBorderWidth;
        ctx.translate(centerX, centerY);
        ctx.scale(scale, scale);
        ctx.lineJoin = "round";
        ctx.miterLimit = 2;
        ctx.strokeText(chars[ci], charCenterX, 0);
        ctx.restore();
      }

      // Fill
      let charFillStyle: string | CanvasGradient = fillColor;
      if (fillColor === style.color && (style.color === "#CCCCCC" || style.color === "#C0C0C0")) {
        const scaledWidth = baseWidth * scale;
        const gradientHeight = 20 * baseScale;
        const gradient = ctx.createLinearGradient(
          centerX - scaledWidth / 2, centerY - gradientHeight,
          centerX + scaledWidth / 2, centerY + gradientHeight
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

  if (style.borderWidth > 0 && !isKnockout) {
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

  if (isKnockout) {
    // difference compositing: white fill on video = inverted video in text shape
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
