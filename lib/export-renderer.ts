import { SubtitleStyle } from "@/components/subtitle-styling";
import { type WordStyleOverride, processTranscriptChunks } from "@/lib/utils";
import { resolveFontFamily } from "@/lib/font-config";
import { type FaceBounds } from "@/lib/render-subtitle";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WordTiming {
  text: string;
  timestamp: [number, number];
  dynamicPosition?: "behind" | "front";
  styleOverride?: WordStyleOverride;
}

export interface TranscriptChunk {
  text: string;
  timestamp: [number, number];
  disabled?: boolean;
  subtitleHidden?: boolean;
  dynamicPosition?: "behind" | "front";
  styleOverride?: WordStyleOverride;
  words?: WordTiming[];
}

export type ProcessedChunk = ReturnType<typeof processTranscriptChunks>[number];

// ─── Constants ────────────────────────────────────────────────────────────────

export const LETTER_SPACING_EM = 0.05;
export const HIGHLIGHT_SPACE_EM = 0.35;
export const WORD_PADDING_X_EM = 0.15;
export const WORD_PADDING_Y_EM = 0.08;
export const HIGHLIGHT_RADIUS_EM = 0.35;
export const WORD_EMPHASIS_SCALE = 1.18;
export const HIGHLIGHT_BG_ALPHA = 0.65;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isPhraseChunk(
  chunk: ProcessedChunk,
): chunk is ProcessedChunk & { words: WordTiming[] } {
  return Array.isArray((chunk as { words?: WordTiming[] }).words);
}

export function drawBrandingWatermark(
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

// ─── Text rendering ──────────────────────────────────────────────────────────

export function renderTextLine(
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
    // Double lineWidth so the outer visible half matches the user's value
    const strokeWidth = Math.max(0.5, style.borderWidth * baseScale * 2);
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

// ─── Phrase emphasis rendering ────────────────────────────────────────────────

export function drawWordText(
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
        // Double lineWidth so the outer visible half matches the user's value
        const scaledBorderWidth = Math.max(
          0.5,
          (style.borderWidth * baseScale * 2) / Math.max(scale, 0.001),
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

export function renderPhraseLineWithEmphasis(
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
    const isSpoken = currentTime >= word.timestamp[0];
    const wordAlpha = style.dynamicFollowWord && !isSpoken ? 0.2 : chunkFadeOut;

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

// ─── Split subtitle ───────────────────────────────────────────────────────────

// Split subtitle: render two halves around the person's head
export function renderSplitSubtitleOnCanvas(
  ctx: CanvasRenderingContext2D,
  text: string,
  style: SubtitleStyle,
  canvas: HTMLCanvasElement,
  splitMode: "above-below" | "left-right",
  faceX: number,
) {
  const isVerticalVideo = canvas.height > canvas.width;
  const videoScale = canvas.height / 500;
  const finalFontSize = Math.round(style.fontSize * videoScale);
  const fontFamily = resolveFontFamily(style.fontFamily);
  ctx.font = `${style.fontWeight} ${finalFontSize}px ${fontFamily}`;
  ctx.textBaseline = "middle";

  const words = text.split(" ");
  if (words.length < 2) {
    ctx.textAlign = "center";
    renderTextLine(
      ctx,
      text,
      canvas.width / 2,
      canvas.height * (isVerticalVideo ? 0.92 : 0.84),
      style,
      videoScale,
    );
    return;
  }

  const mid = Math.ceil(words.length / 2);
  let splitPoint = mid;
  for (
    let i = Math.max(1, mid - 2);
    i <= Math.min(words.length - 1, mid + 2);
    i++
  ) {
    if (/[,;:.!?]$/.test(words[i - 1])) {
      splitPoint = i;
      break;
    }
  }
  const line1 = words.slice(0, splitPoint).join(" ");
  const line2 = words.slice(splitPoint).join(" ");
  if (!line2) {
    ctx.textAlign = "center";
    renderTextLine(
      ctx,
      text,
      canvas.width / 2,
      canvas.height * (isVerticalVideo ? 0.92 : 0.84),
      style,
      videoScale,
    );
    return;
  }

  if (splitMode === "above-below") {
    const y1 = canvas.height * (isVerticalVideo ? 0.08 : 0.14);
    const y2 = canvas.height * (isVerticalVideo ? 0.92 : 0.86);
    ctx.textAlign = "center";
    renderTextLine(ctx, line1, canvas.width / 2, y1, style, videoScale);
    renderTextLine(ctx, line2, canvas.width / 2, y2, style, videoScale);
  } else {
    // left-right — position at eye level (~38% from top)
    const facePixelX = faceX * canvas.width;
    const gap = canvas.width * 0.07;
    const y = canvas.height * 0.38;
    ctx.textAlign = "right";
    renderTextLine(ctx, line1, facePixelX - gap, y, style, videoScale);
    ctx.textAlign = "left";
    renderTextLine(ctx, line2, facePixelX + gap, y, style, videoScale);
    ctx.textAlign = "center";
  }
}

// ─── Main subtitle renderer ───────────────────────────────────────────────────

// Subtitle rendering function
export function renderSubtitle(
  ctx: CanvasRenderingContext2D,
  chunk: TranscriptChunk,
  style: SubtitleStyle,
  canvas: HTMLCanvasElement,
  mode: "word" | "phrase",
  currentTime: number,
  faceX: number = 0.5,
) {
  // Split subtitle mode: render two blocks around the person
  const splitMode = style.splitSubtitleMode ?? "none";
  if (splitMode !== "none") {
    renderSplitSubtitleOnCanvas(
      ctx,
      chunk.text,
      style,
      canvas,
      splitMode,
      faceX,
    );
    return;
  }

  // Display on Spoken: full phrase shown dim from phrase start, each word lights up
  // when spoken. Keep full text/words so layout is always stable.
  const displayText = chunk.text;
  const chunkWords = chunk.words;

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
    (style.wordEmphasisEnabled ||
      style.textFadeIn ||
      style.dynamicFollowWord) &&
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

// ─── Dynamic mode rendering ───────────────────────────────────────────────────

/** Render a single word/line of dynamic text at a given position (export). */
export function renderDynamicSingleWord(
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

// Dynamic mode: large text with configurable size and position, word-wrapped
export function renderDynamicWord(
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

// Shared dynamic text renderer with configurable size and position
// When `wordTimings` is provided and any word has a styleOverride, renders word-by-word.
export function renderDynamicWordWithOptions(
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

// Render only "behind" words from a dynamic chunk
export function renderDynamicBehindInExport(
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
export function renderDynamicFrontInExport(
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
