"use client";

import React, { useEffect, useState } from "react";
import { SubtitleStyle } from "./subtitle-styling";
import {
  processTranscriptChunks,
  type ProcessedChunk,
  type ProcessedWord,
} from "@/lib/utils";
import { cn } from "@/lib/utils";

interface VideoCaptionProps {
  transcript: {
    text: string;
    chunks: Array<{
      text: string;
      timestamp: [number, number];
      disabled?: boolean;
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
}: VideoCaptionProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentText, setCurrentText] = useState("");

  const processedChunks: ProcessedChunk[] = processTranscriptChunks(transcript, mode);
  
  // Filter out disabled chunks for playback preview
  const enabledChunks = processedChunks.filter((chunk) => {
    if (mode === "phrase" && chunk.words) {
      // For phrase mode, check if any word in the phrase is disabled
      return !chunk.words.some(word => 
        transcript.chunks.find(originalChunk => 
          originalChunk.timestamp[0] === word.timestamp[0] && 
          originalChunk.timestamp[1] === word.timestamp[1]
        )?.disabled
      );
    } else {
      // For word mode, check if the chunk itself is disabled
      const originalChunkIndex = transcript.chunks.findIndex(
        originalChunk => 
          originalChunk.timestamp[0] === chunk.timestamp[0] && 
          originalChunk.timestamp[1] === chunk.timestamp[1]
      );
      return !transcript.chunks[originalChunkIndex]?.disabled;
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

  if (currentChunks.length === 0) return null;

  const currentChunk = currentChunks[0]; // Take the first matching chunk
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
    if (mode !== "phrase" || !currentChunk.words) {
      return (
        <span style={{ ...baseTypographyStyles, ...metallicTypographyStyles }}>
          {text}
        </span>
      );
    }

    return (
      <span>
        {currentChunk.words.map((word: ProcessedWord, index: number) => {
          const isCurrentWord =
            currentWordInPhrase &&
            word.text === currentWordInPhrase.text &&
            word.timestamp[0] === currentWordInPhrase.timestamp[0];

          const baseWordStyles: React.CSSProperties = {
            ...baseTypographyStyles,
            ...metallicTypographyStyles,
            display: "inline-block",
            transition: "transform 0.18s ease, background-color 0.18s ease",
            padding: "0 0.15em",
            borderRadius: "0.35em",
            transform: "scale(1)",
            backgroundColor: "transparent",
          };

          // Determine emphasis colors based on text color
          const textIsLight = isLightColor(style.color);
          const emphasisBgColor = textIsLight ? "rgba(0, 0, 0, 0.65)" : "rgba(255, 255, 255, 0.85)";
          const emphasisTextColor = textIsLight ? "#FFFFFF" : "#000000";

          const activeWordStyles: React.CSSProperties =
            isCurrentWord && (style.wordEmphasisEnabled ?? true)
            ? {
                ...baseTypographyStyles,
                transform: "scale(1.18)",
                backgroundColor: emphasisBgColor,
                color: emphasisTextColor,
                WebkitTextStroke: "none", // Remove stroke for cleaner emphasis
                WebkitBackgroundClip: "initial",
                WebkitTextFillColor: "inherit",
              }
            : {};

          return (
            <React.Fragment key={`${word.timestamp[0]}-${index}`}>
              <span style={{ ...baseWordStyles, ...activeWordStyles }}>
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
  const maxWordsPerLine = ratio === "9:16" ? 4 : 6; // Shorter lines for portrait
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

  // Animation states - more subtle with shake
  return (
    <div
      className={cn(
        "absolute left-1/2 -translate-x-1/2 text-center pointer-events-none z-10",
        ratio === "16:9"
          ? "bottom-[16%] w-[90%]" // Landscape mode
          : "bottom-[8%] w-[85%]" // Portrait mode
      )}
      style={{
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
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
