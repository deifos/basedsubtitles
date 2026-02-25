"use client";

import React, { useEffect, useState } from "react";
import { SubtitleStyle, FONT_FAMILIES } from "./subtitle-styling";
import {
  processTranscriptChunks,
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
  onWordSelect?: (timestamp: [number, number]) => void;
  selectedWordTimestamp?: [number, number] | null;
}

// Helper to determine if a color is light or dark
function isLightColor(color: string): boolean {
  // Handle hex colors
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  }
  // Default to assuming dark for other formats
  return false;
}

export function VideoCaption({
  transcript,
  currentTime,
  style,
  mode,
  ratio,
  onWordSelect,
  selectedWordTimestamp,
}: VideoCaptionProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentText, setCurrentText] = useState("");

  // processTranscriptChunks handles dynamic mode internally now
  const processedChunks: ProcessedChunk[] = processTranscriptChunks(transcript, mode, style.maxWordsPerLine);

  // Filter out disabled and subtitleHidden chunks for playback preview
  const enabledChunks = processedChunks.filter((chunk) => {
    if (mode === "phrase" && chunk.words) {
      // For phrase mode, check if any word in the phrase is disabled or hidden
      return !chunk.words.some(word => {
        const original = transcript.chunks.find(originalChunk =>
          originalChunk.timestamp[0] === word.timestamp[0] &&
          originalChunk.timestamp[1] === word.timestamp[1]
        );
        return original?.disabled || original?.subtitleHidden;
      });
    } else {
      // For word mode, check if the chunk itself is disabled or hidden
      const original = transcript.chunks.find(
        originalChunk =>
          originalChunk.timestamp[0] === chunk.timestamp[0] &&
          originalChunk.timestamp[1] === chunk.timestamp[1]
      );
      return !original?.disabled && !original?.subtitleHidden;
    }
  });
  
  const currentChunks = enabledChunks.filter(
    (chunk) =>
      currentTime >= chunk.timestamp[0] && currentTime <= chunk.timestamp[1]
  );

  // For phrase mode, find the current word within the phrase
  const getCurrentWordInPhrase = (chunk: ProcessedChunk): ProcessedWord | undefined => {
    if (mode !== "phrase" || !chunk.words) return undefined;
    return chunk.words.find(
      (word) =>
        currentTime >= word.timestamp[0] && currentTime <= word.timestamp[1]
    );
  };

  useEffect(() => {
    const text =
      currentChunks.length > 0
        ? currentChunks.map((chunk) => chunk.text).join(" ")
        : "";

    if (text !== currentText) {
      // Reset animation states
      setIsAnimating(false);

      // Set new text
      setCurrentText(text);

      // Animation removed - not supported by FFmpeg drawtext
      // Just show the text immediately
      setIsAnimating(true);
    }
  }, [currentChunks, currentText]);

  // Separate effect to ensure immediate style updates 
  useEffect(() => {
    // Force re-render when style changes by resetting animation state
    if (currentText) {
      setIsAnimating(false);
      setTimeout(() => {
        setIsAnimating(true);
      }, 10);
    }
  }, [style, currentText]);

  // Always render the container to reserve space and prevent layout jumps
  if (currentChunks.length === 0) {
    const position = style.position ?? "bottom";
    const isPortrait = ratio === "9:16";
    const widthClass = isPortrait ? "w-[85%]" : "w-[90%]";
    const posClasses = (() => {
      switch (position) {
        case "top":
          return isPortrait ? `top-[6%] ${widthClass}` : `top-[12%] ${widthClass}`;
        case "middle":
          return `top-1/2 -translate-y-1/2 ${widthClass}`;
        case "bottom":
        default:
          return isPortrait ? `bottom-[8%] ${widthClass}` : `bottom-[16%] ${widthClass}`;
      }
    })();

    return (
      <div
        className={cn(
          "absolute left-1/2 -translate-x-1/2 text-center pointer-events-none",
          "z-10",
          posClasses
        )}
        style={{
          fontFamily: style.fontFamily,
          fontSize: `clamp(12px, ${style.fontSize * 0.06}vw, ${style.fontSize}px)`,
          fontWeight: style.fontWeight,
        }}
      >
        <div
          className="inline-block px-3 py-2"
          style={{ opacity: 0 }}
        >
          <div className="flex flex-col gap-1">
            <span>&nbsp;</span>
          </div>
        </div>
      </div>
    );
  }

  const rawChunk = currentChunks[0]; // Take the first matching chunk

  // Progressive word reveal: show words one by one as they start being spoken
  let currentChunk = rawChunk;
  if (style.dynamicFollowWord && mode === "phrase" && rawChunk.words) {
    const visibleWords = rawChunk.words.filter(w => currentTime >= w.timestamp[0]);
    if (visibleWords.length === 0) return null;
    currentChunk = {
      ...rawChunk,
      text: visibleWords.map(w => w.text).join(" "),
      words: visibleWords,
    };
  }

  const text = currentChunk.text;
  const currentWordInPhrase = getCurrentWordInPhrase(currentChunk);

  const isMetallicColor = style.color === "#CCCCCC" || style.color === "#C0C0C0";
  const previewStrokeWidth = style.borderWidth > 0 ? Math.max(0.5, style.borderWidth) : 0;
  const previewStroke = previewStrokeWidth > 0 ? `${previewStrokeWidth}px ${style.borderColor}` : "none";
  const previewFilter = `drop-shadow(2px 2px ${Math.max(
    2,
    style.dropShadowIntensity * 4
  )}px rgba(0, 0, 0, ${style.dropShadowIntensity}))`;

  const baseTypographyStyles: React.CSSProperties = {
    color: style.color,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    WebkitTextStroke: previewStroke,
    filter: previewFilter,
  };

  const metallicTypographyStyles: React.CSSProperties = isMetallicColor
    ? {
        background: "linear-gradient(to bottom, #FFFFFF 0%, #CCCCCC 50%, #999999 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
      }
    : {};

  const renderPhraseWithHighlight = () => {
    // For word mode, just display the single word
    if (mode === "word") {
      return (
        <span style={{ ...baseTypographyStyles, ...metallicTypographyStyles }}>
          {text}
        </span>
      );
    }

    // For phrase mode without words array, display as plain text
    if (!currentChunk.words) {
      return (
        <span style={{ ...baseTypographyStyles, ...metallicTypographyStyles }}>
          {text}
        </span>
      );
    }

    // For phrase mode with word highlighting
    return (
      <span>
        {currentChunk.words.map((word: ProcessedWord, index: number) => {
          const isCurrentWord =
            currentWordInPhrase &&
            word.text === currentWordInPhrase.text &&
            word.timestamp[0] === currentWordInPhrase.timestamp[0];

          // Determine emphasis colors based on text color
          const wordColor = word.styleOverride?.color ?? style.color;
          const textIsLight = isLightColor(wordColor);
          const emphasisBgColor = textIsLight ? "rgba(0, 0, 0, 0.65)" : "rgba(255, 255, 255, 0.85)";
          const emphasisTextColor = textIsLight ? "#FFFFFF" : "#000000";
          const isActive = isCurrentWord && (style.wordEmphasisEnabled ?? true);

          const isSelected =
            selectedWordTimestamp &&
            word.timestamp[0] === selectedWordTimestamp[0] &&
            word.timestamp[1] === selectedWordTimestamp[1];

          // Build per-word override styles
          const overrideStyles: React.CSSProperties = {};
          if (word.styleOverride?.color) {
            overrideStyles.color = word.styleOverride.color;
          }
          if (word.styleOverride?.fontFamily) {
            overrideStyles.fontFamily = resolveCssFont(word.styleOverride.fontFamily);
          }
          if (word.styleOverride?.fontSize) {
            overrideStyles.fontSize = `${word.styleOverride.fontSize}em`;
          }

          const baseWordStyles: React.CSSProperties = {
            ...baseTypographyStyles,
            ...(isActive ? {} : metallicTypographyStyles),
            display: "inline-block",
            transition: "transform 0.18s ease, background-color 0.18s ease",
            padding: "0 0.15em",
            borderRadius: "0.35em",
            transform: "scale(1)",
            backgroundColor: "transparent",
            cursor: onWordSelect ? "pointer" : undefined,
            ...overrideStyles,
          };

          const activeWordStyles: React.CSSProperties = isActive
            ? {
                transform: "scale(1.18)",
                backgroundColor: emphasisBgColor,
                color: word.styleOverride?.color ?? emphasisTextColor,
                WebkitTextStroke: "none",
                background: "none",
                WebkitBackgroundClip: "initial",
                WebkitTextFillColor: "inherit",
              }
            : {};

          const selectedStyles: React.CSSProperties = isSelected
            ? {
                outline: "2px solid rgba(250, 204, 21, 0.8)",
                outlineOffset: "1px",
              }
            : {};

          return (
            <React.Fragment key={`${word.timestamp[0]}-${index}`}>
              <span
                style={{ ...baseWordStyles, ...activeWordStyles, ...selectedStyles }}
                onClick={
                  onWordSelect
                    ? (e) => {
                        e.stopPropagation();
                        onWordSelect(word.timestamp);
                      }
                    : undefined
                }
                className={onWordSelect ? "pointer-events-auto" : undefined}
              >
                {word.text}
              </span>
              {index < (currentChunk.words?.length || 0) - 1 && (
                <span style={{ display: "inline-block", width: "0.35em" }}> </span>
              )}
            </React.Fragment>
          );
        })}
      </span>
    );
  };

  // Better text wrapping logic
  const words = text.split(" ");
  const maxWordsPerLine = style.maxWordsPerLine ?? (ratio === "9:16" ? 4 : 6);
  const shouldSplitText = words.length > maxWordsPerLine;
  
  let line1 = text;
  let line2 = "";
  
  if (shouldSplitText) {
    // Try to split at natural break points
    const midpoint = Math.ceil(words.length / 2);
    let splitPoint = midpoint;
    
    // Look for natural break points (punctuation) near the middle
    for (let i = Math.max(2, midpoint - 2); i <= Math.min(words.length - 2, midpoint + 2); i++) {
      if (/[,;:.!?]$/.test(words[i])) {
        splitPoint = i + 1;
        break;
      }
    }
    
    line1 = words.slice(0, splitPoint).join(" ");
    line2 = words.slice(splitPoint).join(" ");
  }

  // Calculate responsive font size based on video container
  // On mobile, the video is smaller so we need to scale the font proportionally
  const responsiveFontSize = `clamp(12px, ${style.fontSize * 0.06}vw, ${style.fontSize}px)`;

  // Compute position classes and styles based on style.position
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
        return `top-1/2 -translate-y-1/2 ${widthClass}`;
      case "bottom":
      default:
        return isPortrait
          ? `bottom-[8%] ${widthClass}`
          : `bottom-[16%] ${widthClass}`;
    }
  })();

  // Animation states - more subtle with shake
  return (
    <div
      className={cn(
        "absolute left-1/2 -translate-x-1/2 text-center",
        "z-10",
        onWordSelect ? "pointer-events-auto" : "pointer-events-none",
        positionClasses
      )}
      style={{
        fontFamily: style.fontFamily,
        fontSize: responsiveFontSize,
        fontWeight: style.fontWeight,
      }}
    >
      <div
        className="inline-block px-3 py-2"
        style={{
          backgroundColor: style.backgroundColor,
          borderRadius: style.backgroundColor && style.backgroundColor !== "transparent" ? "0.5rem" : undefined,
          transform: "scale(1) translateY(0)",
          opacity: isAnimating ? 1 : 0,
          transition: "opacity 0.15s ease-in",
        }}
      >
        <div className="flex flex-col gap-1">
          {mode === "phrase" && shouldSplitText ? (
            // For phrase mode with split text, we need to handle highlighting per line
            <>
              <span style={{ ...baseTypographyStyles, ...metallicTypographyStyles }}>
                {line1}
              </span>
              {line2 && (
                <span style={{ ...baseTypographyStyles, ...metallicTypographyStyles }}>
                  {line2}
                </span>
              )}
            </>
          ) : (
            // Single line or word mode - use highlighting
            renderPhraseWithHighlight()
          )}
        </div>
      </div>

      {/* Add CSS animations for word highlighting */}
      <style jsx>{`
        @keyframes wordBounce {
{{ ... }}
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        
{{ ... }}
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
