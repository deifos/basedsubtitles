"use client";

import React, { useRef } from "react";
import { SubtitleStyle, FONT_FAMILIES } from "./subtitle-styling";
import {
  processTranscriptChunks,
  binarySearchActiveChunk,
  type ProcessedChunk,
  type ProcessedWord,
  type WordStyleOverride,
} from "@/lib/utils";
import { cn } from "@/lib/utils";

const fontOptions = Object.values(FONT_FAMILIES);

/** Resolve a fontFamily value to its cssFont for rendering */
function resolveCssFont(fontFamily: string): string {
  const match = fontOptions.find((f) => f.value === fontFamily);
  return match?.cssFont ?? fontFamily;
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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface PhraseWordListProps {
  words: ProcessedWord[];
  currentWordInPhrase: ProcessedWord | undefined;
  currentTime: number;
  style: SubtitleStyle;
  baseTypographyStyles: React.CSSProperties;
  metallicTypographyStyles: React.CSSProperties;
}

function PhraseWordList({
  words,
  currentWordInPhrase,
  currentTime,
  style,
  baseTypographyStyles,
  metallicTypographyStyles,
}: PhraseWordListProps) {
  return (
    <span>
      {words.map((word: ProcessedWord, wordIdx: number) => {
        const isCurrentWord =
          currentWordInPhrase &&
          word.text === currentWordInPhrase.text &&
          word.timestamp[0] === currentWordInPhrase.timestamp[0];

        const wordColor = word.styleOverride?.color ?? style.color;
        const textIsLight = isLightColor(wordColor);
        const emphasisBgColor = textIsLight
          ? "rgba(0, 0, 0, 0.65)"
          : "rgba(255, 255, 255, 0.85)";
        const emphasisTextColor = textIsLight ? "#FFFFFF" : "#000000";
        const isActive = isCurrentWord && (style.wordEmphasisEnabled ?? false);

        const isKnockout = word.styleOverride?.effect === "knockout";
        const overrideStyles: React.CSSProperties = {};
        if (isKnockout) {
          overrideStyles.mixBlendMode = "difference";
          overrideStyles.color = "#FFFFFF";
          overrideStyles.WebkitTextFillColor = "#FFFFFF";
          overrideStyles.WebkitTextStroke = "none";
          overrideStyles.filter = "none";
          overrideStyles.transform = "none";
        } else if (word.styleOverride?.color) {
          overrideStyles.color = word.styleOverride.color;
        }
        if (word.styleOverride?.fontFamily) {
          overrideStyles.fontFamily = resolveCssFont(
            word.styleOverride.fontFamily,
          );
        }
        if (word.styleOverride?.fontSize) {
          overrideStyles.fontSize = `${word.styleOverride.fontSize}em`;
        }

        // Display on Spoken: dim unspoken words (always in phrase mode here)
        const wordOpacity = style.dynamicFollowWord
          ? currentTime >= word.timestamp[0]
            ? 1
            : 0.2
          : 1;

        const baseWordStyles: React.CSSProperties = {
          ...baseTypographyStyles,
          ...(isActive ? {} : metallicTypographyStyles),
          display: "inline-block",
          transition: isKnockout
            ? "none"
            : "transform 0.18s ease, background-color 0.18s ease",
          padding: "0 0.15em",
          borderRadius: "0.35em",
          transform: isKnockout ? "none" : "scale(1)",
          backgroundColor: "transparent",
          opacity: wordOpacity,
          ...overrideStyles,
        };

        const activeWordStyles: React.CSSProperties = isActive
          ? isKnockout
            ? {
                mixBlendMode: "difference" as const,
                color: "#FFFFFF",
                WebkitTextFillColor: "#FFFFFF",
                WebkitTextStroke: "none",
                filter: "none",
              }
            : {
                transform: "scale(1.18)",
                backgroundColor: emphasisBgColor,
                color: word.styleOverride?.color ?? emphasisTextColor,
                WebkitTextStroke: "none",
                WebkitBackgroundClip: "initial",
                WebkitTextFillColor: "inherit",
              }
          : {};

        const hasEmojiOverlay = !!word.styleOverride?.emojiOverlay;
        const positionStyles: React.CSSProperties = hasEmojiOverlay
          ? { position: "relative" }
          : {};
        const eScale = word.styleOverride?.emojiScale ?? 1;

        return (
          <React.Fragment
            key={`${wordIdx}-${word.timestamp[0]}-${word.timestamp[1]}`}
          >
            <span
              style={{
                ...baseWordStyles,
                ...activeWordStyles,
                ...positionStyles,
              }}
            >
              {hasEmojiOverlay && (
                <span
                  style={{
                    position: "absolute",
                    top: `${-1.4 * eScale}em`,
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontSize: `${1.4 * eScale}em`,
                    lineHeight: 1,
                    pointerEvents: "none",
                  }}
                >
                  {word.styleOverride!.emojiOverlay}
                </span>
              )}
              {word.styleOverride?.emoji ? (
                <span style={{ fontSize: `${1.2 * eScale}em`, lineHeight: 1 }}>
                  {word.styleOverride.emoji}
                </span>
              ) : (
                word.text
              )}
            </span>
            {wordIdx < words.length - 1 && (
              <span style={{ display: "inline-block", width: "0.35em" }}>
                {" "}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </span>
  );
}

interface SplitWordsProps {
  wordTexts: string[];
  startIdx: number;
  chunkWords: ProcessedWord[] | undefined;
  currentTime: number;
  dynamicFollowWord: boolean;
  mode: "word" | "phrase";
  baseTypographyStyles: React.CSSProperties;
  metallicTypographyStyles: React.CSSProperties;
}

function SplitWords({
  wordTexts,
  startIdx,
  chunkWords,
  currentTime,
  dynamicFollowWord,
  mode,
  baseTypographyStyles,
  metallicTypographyStyles,
}: SplitWordsProps) {
  if (!dynamicFollowWord || mode !== "phrase" || !chunkWords) {
    return (
      <span style={{ ...baseTypographyStyles, ...metallicTypographyStyles }}>
        {wordTexts.join(" ")}
      </span>
    );
  }
  return (
    <>
      {wordTexts.map((w, i) => {
        const wordData = chunkWords[startIdx + i];
        const opacity =
          wordData && currentTime >= wordData.timestamp[0] ? 1 : 0.2;
        return (
          <React.Fragment key={`${startIdx + i}-${w}`}>
            <span
              style={{
                ...baseTypographyStyles,
                ...metallicTypographyStyles,
                opacity,
              }}
            >
              {w}
            </span>
            {i < wordTexts.length - 1 && " "}
          </React.Fragment>
        );
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface VideoCaptionProps {
  transcript: {
    text: string;
    chunks: Array<{
      text: string;
      timestamp: [number, number];
      disabled?: boolean;
      subtitleHidden?: boolean;
      styleOverride?: WordStyleOverride;
      words?: Array<{
        text: string;
        timestamp: [number, number];
      }>;
    }>;
  };
  currentTime: number;
  style: SubtitleStyle;
  mode: "word" | "phrase";
  ratio: "16:9" | "9:16";
  getFaceX?: () => number;
}

export function VideoCaption({
  transcript,
  currentTime,
  style,
  mode,
  ratio,
  getFaceX,
}: VideoCaptionProps) {
  const splitMode = style.splitSubtitleMode ?? "none";
  // Frozen face X for left-right split: captured once per phrase, not per frame
  const frozenFaceX = useRef<number>(0.5);
  // Tracks the last phrase text we saw — used to detect phrase transitions
  const prevPhraseTextRef = useRef("");

  const processedChunks: ProcessedChunk[] = processTranscriptChunks(
    transcript,
    mode,
    style.maxWordsPerLine,
  );

  const enabledChunks = processedChunks.filter((chunk) => {
    if (chunk.words) {
      return !chunk.words.some((w) => w.disabled || w.subtitleHidden);
    }
    return !chunk.disabled && !chunk.subtitleHidden;
  });

  const activeChunk = binarySearchActiveChunk(enabledChunks, currentTime);
  const currentChunks = activeChunk ? [activeChunk] : [];

  // Derive text and visibility from currentChunks — no state or effects needed
  const currentText =
    currentChunks.length > 0 ? currentChunks.map((c) => c.text).join(" ") : "";
  const isAnimating = currentText !== "";

  // Freeze face X position when the phrase changes (safe to do during render — ref mutation)
  if (currentText !== prevPhraseTextRef.current) {
    prevPhraseTextRef.current = currentText;
    if (splitMode === "left-right" && currentText !== "") {
      frozenFaceX.current = getFaceX?.() ?? 0.5;
    }
  }

  const getCurrentWordInPhrase = (
    chunk: ProcessedChunk,
  ): ProcessedWord | undefined => {
    if (mode !== "phrase" || !chunk.words) return undefined;
    return chunk.words.find(
      (word) =>
        currentTime >= word.timestamp[0] && currentTime <= word.timestamp[1],
    );
  };

  // For split mode with no active text, absolute elements don't need a placeholder
  if (currentChunks.length === 0 && splitMode !== "none") {
    return null;
  }

  // Render a zero-opacity placeholder to reserve layout space when no subtitle is active
  if (currentChunks.length === 0) {
    const position = style.position ?? "bottom";
    const isPortrait = ratio === "9:16";
    const widthClass = isPortrait ? "w-[85%]" : "w-[90%]";
    const posClasses = (() => {
      switch (position) {
        case "top":
          return isPortrait
            ? `top-[6%] ${widthClass}`
            : `top-[12%] ${widthClass}`;
        case "middle":
          return `top-1/2 -translate-y-1/2 ${widthClass}`;
        case "bottom":
        default:
          return isPortrait
            ? `bottom-[8%] ${widthClass}`
            : `bottom-[16%] ${widthClass}`;
      }
    })();

    return (
      <div
        className={cn(
          "absolute left-1/2 -translate-x-1/2 text-center pointer-events-none",
          "z-10",
          posClasses,
        )}
        style={{
          fontFamily: style.fontFamily,
          fontSize: `clamp(12px, ${style.fontSize * 0.06}vw, ${style.fontSize}px)`,
          fontWeight: style.fontWeight,
        }}
      >
        <div className="inline-block px-3 py-2" style={{ opacity: 0 }}>
          <div className="flex flex-col gap-1">
            <span>&nbsp;</span>
          </div>
        </div>
      </div>
    );
  }

  const currentChunk = currentChunks[0];
  const text = currentChunk.text;
  const currentWordInPhrase = getCurrentWordInPhrase(currentChunk);

  // Knockout words require containers without stacking contexts so
  // mix-blend-mode: difference can reach the video behind them
  const hasKnockout =
    mode === "phrase" &&
    currentChunk.words?.some(
      (w: ProcessedWord) => w.styleOverride?.effect === "knockout",
    );

  const isMetallicColor =
    style.color === "#CCCCCC" || style.color === "#C0C0C0";
  const previewStrokeWidth =
    style.borderWidth > 0 ? Math.max(0.5, style.borderWidth) : 0;
  const previewStroke =
    previewStrokeWidth > 0
      ? `${previewStrokeWidth}px ${style.borderColor}`
      : "none";
  const previewFilter = `drop-shadow(2px 2px ${Math.max(
    2,
    style.dropShadowIntensity * 4,
  )}px rgba(0, 0, 0, ${style.dropShadowIntensity}))`;

  const baseTypographyStyles: React.CSSProperties = {
    color: style.color,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    WebkitTextStroke: previewStroke,
    paintOrder: "stroke fill",
    filter: previewFilter,
  };

  const metallicTypographyStyles: React.CSSProperties = isMetallicColor
    ? {
        background:
          "linear-gradient(to bottom, #FFFFFF 0%, #CCCCCC 50%, #999999 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
      }
    : {};

  const renderPhraseWithHighlight = () => {
    if (mode === "word") {
      const wordChunk = transcript.chunks.find(
        (c) =>
          c.timestamp[0] === currentChunk.timestamp[0] &&
          c.timestamp[1] === currentChunk.timestamp[1],
      );
      const wordOverride = wordChunk?.styleOverride;
      const emojiScale = wordOverride?.emojiScale ?? 1;

      if (wordOverride?.emoji) {
        return (
          <span
            style={{
              ...baseTypographyStyles,
              ...metallicTypographyStyles,
              position: "relative",
              display: "inline-block",
            }}
          >
            {wordOverride.emojiOverlay && (
              <span
                style={{
                  position: "absolute",
                  top: `${-1.4 * emojiScale}em`,
                  left: "50%",
                  transform: "translateX(-50%)",
                  fontSize: `${1.4 * emojiScale}em`,
                  lineHeight: 1,
                  pointerEvents: "none",
                }}
              >
                {wordOverride.emojiOverlay}
              </span>
            )}
            <span style={{ fontSize: `${1.2 * emojiScale}em`, lineHeight: 1 }}>
              {wordOverride.emoji}
            </span>
          </span>
        );
      }

      if (wordOverride?.emojiOverlay) {
        return (
          <span
            style={{
              ...baseTypographyStyles,
              ...metallicTypographyStyles,
              position: "relative",
              display: "inline-block",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: `${-1.4 * emojiScale}em`,
                left: "50%",
                transform: "translateX(-50%)",
                fontSize: `${1.4 * emojiScale}em`,
                lineHeight: 1,
                pointerEvents: "none",
              }}
            >
              {wordOverride.emojiOverlay}
            </span>
            {text}
          </span>
        );
      }

      return (
        <span style={{ ...baseTypographyStyles, ...metallicTypographyStyles }}>
          {text}
        </span>
      );
    }

    if (!currentChunk.words) {
      return (
        <span style={{ ...baseTypographyStyles, ...metallicTypographyStyles }}>
          {text}
        </span>
      );
    }

    return (
      <PhraseWordList
        words={currentChunk.words}
        currentWordInPhrase={currentWordInPhrase}
        currentTime={currentTime}
        style={style}
        baseTypographyStyles={baseTypographyStyles}
        metallicTypographyStyles={metallicTypographyStyles}
      />
    );
  };

  const words = text.split(" ");
  const maxWordsPerLine = style.maxWordsPerLine ?? (ratio === "9:16" ? 4 : 6);
  const shouldSplitText = words.length > maxWordsPerLine;

  let line1 = text;
  let line2 = "";

  if (shouldSplitText) {
    const midpoint = Math.ceil(words.length / 2);
    let splitPoint = midpoint;
    for (
      let i = Math.max(2, midpoint - 2);
      i <= Math.min(words.length - 2, midpoint + 2);
      i++
    ) {
      if (/[,;:.!?]$/.test(words[i])) {
        splitPoint = i + 1;
        break;
      }
    }
    line1 = words.slice(0, splitPoint).join(" ");
    line2 = words.slice(splitPoint).join(" ");
  }

  const responsiveFontSize = `clamp(12px, ${style.fontSize * 0.06}vw, ${style.fontSize}px)`;

  const verticalOffset = style.verticalOffset ?? 0;
  const position = style.position ?? "bottom";
  const positionClasses = (() => {
    const isPortrait = ratio === "9:16";
    const widthClass = isPortrait ? "w-[85%]" : "w-[90%]";
    switch (position) {
      case "top":
        return isPortrait
          ? `top-[6%] ${widthClass}`
          : `top-[12%] ${widthClass}`;
      case "middle":
        return hasKnockout
          ? `inset-y-0 my-auto h-fit ${widthClass}`
          : `top-1/2 -translate-y-1/2 ${widthClass}`;
      case "bottom":
      default:
        return isPortrait
          ? `bottom-[8%] ${widthClass}`
          : `bottom-[16%] ${widthClass}`;
    }
  })();

  // Split subtitle mode: two blocks placed around the person's face
  if (splitMode !== "none") {
    const splitWords = text.split(" ");
    if (splitWords.length >= 2) {
      const mid = Math.ceil(splitWords.length / 2);
      let splitPoint = mid;
      for (
        let i = Math.max(1, mid - 2);
        i <= Math.min(splitWords.length - 1, mid + 2);
        i++
      ) {
        if (/[,;:.!?]$/.test(splitWords[i - 1])) {
          splitPoint = i;
          break;
        }
      }

      const splitLine2 = splitWords.slice(splitPoint).join(" ");
      if (splitLine2) {
        const isPortrait = ratio === "9:16";
        const blockStyle: React.CSSProperties = {
          fontFamily: style.fontFamily,
          fontSize: responsiveFontSize,
          fontWeight: style.fontWeight,
        };
        const innerStyle: React.CSSProperties = {
          backgroundColor: style.backgroundColor,
          borderRadius:
            style.backgroundColor && style.backgroundColor !== "transparent"
              ? "0.5rem"
              : undefined,
          opacity: isAnimating ? 1 : 0,
        };
        const sharedSplitWordsProps = {
          chunkWords: currentChunk.words,
          currentTime,
          dynamicFollowWord: style.dynamicFollowWord ?? false,
          mode,
          baseTypographyStyles,
          metallicTypographyStyles,
        };

        if (splitMode === "above-below") {
          const topClass = isPortrait ? "top-[6%]" : "top-[12%]";
          const bottomClass = isPortrait ? "bottom-[8%]" : "bottom-[16%]";
          const widthClass = isPortrait ? "w-[85%]" : "w-[90%]";
          return (
            <>
              <div
                className={`absolute left-1/2 -translate-x-1/2 text-center pointer-events-none z-10 ${topClass} ${widthClass}`}
                style={blockStyle}
              >
                <div style={{ transform: `translateY(${-verticalOffset}px)` }}>
                  <div className="inline-block px-3 py-2" style={innerStyle}>
                    <SplitWords
                      wordTexts={splitWords.slice(0, splitPoint)}
                      startIdx={0}
                      {...sharedSplitWordsProps}
                    />
                  </div>
                </div>
              </div>
              <div
                className={`absolute left-1/2 -translate-x-1/2 text-center pointer-events-none z-10 ${bottomClass} ${widthClass}`}
                style={blockStyle}
              >
                <div style={{ transform: `translateY(${verticalOffset}px)` }}>
                  <div className="inline-block px-3 py-2" style={innerStyle}>
                    <SplitWords
                      wordTexts={splitWords.slice(splitPoint)}
                      startIdx={splitPoint}
                      {...sharedSplitWordsProps}
                    />
                  </div>
                </div>
              </div>
            </>
          );
        }

        if (splitMode === "left-right") {
          const facePercent = frozenFaceX.current * 100;
          const gap = 7;
          return (
            <>
              {/* Left block — right-aligned, ends before the face */}
              <div
                className="absolute text-right pointer-events-none z-10"
                style={{
                  ...blockStyle,
                  right: `${100 - facePercent + gap}%`,
                  top: "38%",
                  transform: "translateY(-50%)",
                  maxWidth: `${Math.max(10, facePercent - gap * 2)}%`,
                }}
              >
                <div className="inline-block px-3 py-2" style={innerStyle}>
                  <SplitWords
                    wordTexts={splitWords.slice(0, splitPoint)}
                    startIdx={0}
                    {...sharedSplitWordsProps}
                  />
                </div>
              </div>
              {/* Right block — left-aligned, starts after the face */}
              <div
                className="absolute text-left pointer-events-none z-10"
                style={{
                  ...blockStyle,
                  left: `${facePercent + gap}%`,
                  top: "38%",
                  transform: "translateY(-50%)",
                  maxWidth: `${Math.max(10, 100 - facePercent - gap * 2)}%`,
                }}
              >
                <div className="inline-block px-3 py-2" style={innerStyle}>
                  <SplitWords
                    wordTexts={splitWords.slice(splitPoint)}
                    startIdx={splitPoint}
                    {...sharedSplitWordsProps}
                  />
                </div>
              </div>
            </>
          );
        }
      }
    }
  }

  return (
    <div
      className={cn(
        "absolute text-center",
        hasKnockout ? "inset-x-0 mx-auto" : "left-1/2 -translate-x-1/2 z-10",
        "pointer-events-none",
        positionClasses,
      )}
      style={{
        fontFamily: style.fontFamily,
        fontSize: responsiveFontSize,
        fontWeight: style.fontWeight,
      }}
    >
      {/* Inner wrapper applies Y offset without disturbing Tailwind's translateX centering */}
      <div style={{ transform: `translateY(${verticalOffset}px)` }}>
        <div
          className="inline-block px-3 py-2"
          style={{
            backgroundColor: style.backgroundColor,
            borderRadius:
              style.backgroundColor && style.backgroundColor !== "transparent"
                ? "0.5rem"
                : undefined,
            ...(hasKnockout ? {} : { transform: "scale(1) translateY(0)" }),
            opacity: isAnimating ? 1 : 0,
          }}
        >
          <div className="flex flex-col gap-1">
            {mode === "phrase" &&
            shouldSplitText &&
            !style.dynamicFollowWord ? (
              <>
                <span
                  style={{
                    ...baseTypographyStyles,
                    ...metallicTypographyStyles,
                  }}
                >
                  {line1}
                </span>
                {line2 && (
                  <span
                    style={{
                      ...baseTypographyStyles,
                      ...metallicTypographyStyles,
                    }}
                  >
                    {line2}
                  </span>
                )}
              </>
            ) : (
              renderPhraseWithHighlight()
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
