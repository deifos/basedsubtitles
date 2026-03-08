"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import {
  formatTime,
  transcriptToSrt,
  transcriptToVtt,
  processTranscriptChunks,
  type ProcessedChunk,
  type ProcessedWord,
} from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Edit, Ban, EyeOff, SkipForward, Filter } from "lucide-react";

interface TranscriptChunk {
  text: string;
  timestamp: [number, number];
  disabled?: boolean;
  subtitleHidden?: boolean;
  dynamicPosition?: "behind" | "front";
}

interface TranscriptSidebarProps {
  transcript: {
    text: string;
    chunks: TranscriptChunk[];
  };
  currentTime: number;
  setCurrentTime: (time: number) => void;
  onTranscriptUpdate?: (updatedTranscript: {
    text: string;
    chunks: TranscriptChunk[];
  }) => void;
  className?: string;
  mode: "word" | "phrase";
  maxWordsPerLine?: number;
  dynamicEnabled?: boolean;
  videoFileName?: string;
}

export function TranscriptSidebar({
  transcript,
  currentTime,
  setCurrentTime,
  onTranscriptUpdate,
  className = "",
  mode,
  maxWordsPerLine,
  dynamicEnabled = false,
  videoFileName,
}: TranscriptSidebarProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [hideSkipped, setHideSkipped] = useState(false);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const activeChunkRef = useRef<HTMLDivElement | null>(null);

  const fileBaseName = videoFileName
    ? videoFileName.replace(/\.[^/.]+$/, "")
    : "subtitles";

  // Process transcript chunks based on the current mode
  const displayChunks: ProcessedChunk[] = useMemo(() => {
    const processed = processTranscriptChunks(
      transcript,
      mode,
      maxWordsPerLine,
      dynamicEnabled,
    );

    return processed.map((chunk, index) => {
      if (mode === "phrase" && chunk.words) {
        // ProcessedWord already carries disabled/subtitleHidden from processTranscriptChunks
        // Use these directly instead of re-scanning transcript.chunks (was O(n²))
        const everyWordDisabled = chunk.words.every((word) => word.disabled);
        const everyWordHidden = chunk.words.every(
          (word) => word.subtitleHidden,
        );

        return {
          ...chunk,
          disabled: everyWordDisabled,
          subtitleHidden: everyWordHidden,
        };
      }

      return {
        ...chunk,
        disabled: transcript.chunks[index]?.disabled ?? false,
        subtitleHidden: transcript.chunks[index]?.subtitleHidden ?? false,
      };
    });
  }, [transcript, mode, maxWordsPerLine, dynamicEnabled]);

  // Scroll the active chunk into view when currentTime changes.
  // Uses instant scroll (not smooth) to avoid layout-thrashing animation during playback.
  useEffect(() => {
    const el = activeChunkRef.current;
    const container = transcriptContainerRef.current;
    if (!el || !container) return;

    const scrollTop = container.scrollTop;
    const clientHeight = container.clientHeight;
    const elTop = el.offsetTop;
    const elBottom = elTop + el.offsetHeight;

    if (elTop < scrollTop || elBottom > scrollTop + clientHeight) {
      container.scrollTo({
        top: Math.max(0, elTop - clientHeight / 2 + el.offsetHeight / 2),
        behavior: "instant",
      });
    }
  }, [currentTime]);

  const jsonTranscript = useMemo(() => {
    return JSON.stringify(transcript, null, 2).replace(
      /( {4}"timestamp": )\[\s+(\S+)\s+(\S+)\s+\]/gm,
      "$1[$2 $3]",
    );
  }, [transcript]);

  const handleDownloadJson = () => {
    const blob = new Blob([jsonTranscript], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileBaseName}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSrt = () => {
    const srtContent = transcriptToSrt(transcript, mode);
    const blob = new Blob([srtContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileBaseName}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadVtt = () => {
    const vttContent = transcriptToVtt(transcript, mode);
    const blob = new Blob([vttContent], { type: "text/vtt" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileBaseName}.vtt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditText(displayChunks[index].text);
  };

  const saveEdit = () => {
    if (editingIndex === null) return;

    const updatedChunks = [...transcript.chunks];

    if (mode === "word") {
      // For word mode, direct update - editingIndex maps directly to transcript.chunks
      updatedChunks[editingIndex] = {
        ...updatedChunks[editingIndex],
        text: editText,
      };
    } else if (mode === "phrase") {
      // For phrase/dynamic mode, we need to update the original word chunks that make up this phrase
      const phraseToEdit = displayChunks[editingIndex];
      if (phraseToEdit.words && phraseToEdit.words.length > 0) {
        // Split the edited text into words
        const newWords = editText.trim().split(/\s+/);
        const originalWords = phraseToEdit.words;

        // Update each original chunk with the corresponding new word
        // If there are more new words than original, concatenate extras to the last original word
        // If there are fewer new words, extra original words are cleared (empty text is skipped by processTranscriptChunks)
        originalWords.forEach((originalWord, wordIndex) => {
          const originalChunkIndex = transcript.chunks.findIndex(
            (chunk) =>
              chunk.timestamp[0] === originalWord.timestamp[0] &&
              chunk.timestamp[1] === originalWord.timestamp[1],
          );

          if (originalChunkIndex !== -1) {
            let newText: string;

            if (wordIndex === originalWords.length - 1) {
              // This is the last original word - concatenate all remaining new words
              newText = newWords.slice(wordIndex).join(" ");
            } else if (wordIndex < newWords.length) {
              // Not the last original word, take the corresponding new word
              newText = newWords[wordIndex];
            } else {
              // Fewer new words than original - clear this word
              newText = "";
            }

            updatedChunks[originalChunkIndex] = {
              ...updatedChunks[originalChunkIndex],
              text: newText,
            };
          }
        });
      }
    }

    const updatedTranscript = {
      text: updatedChunks.map((chunk) => chunk.text).join(" "),
      chunks: updatedChunks,
    };

    // Call the update function if provided
    if (onTranscriptUpdate) {
      onTranscriptUpdate(updatedTranscript);
    }

    // Reset editing state
    setEditingIndex(null);
    setEditText("");
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditText("");
  };

  // Cycle through 3 states: normal → hidden subs → skip segment → normal
  const cycleChunkState = (index: number) => {
    const chunk = displayChunks[index];
    const isHidden = chunk.subtitleHidden ?? false;
    const isDisabled = chunk.disabled ?? false;

    // Determine next state
    let nextHidden = false;
    let nextDisabled = false;
    if (!isHidden && !isDisabled) {
      // Normal → Hide subs
      nextHidden = true;
    } else if (isHidden && !isDisabled) {
      // Hide subs → Skip segment
      nextDisabled = true;
    }
    // Skip → Normal (both false)

    if (mode === "phrase") {
      const phraseToToggle = displayChunks[index];
      if (phraseToToggle.words) {
        const updatedChunks = transcript.chunks.map((originalChunk) => {
          const isPartOfPhrase = phraseToToggle.words!.some(
            (phraseWord) =>
              phraseWord.timestamp[0] === originalChunk.timestamp[0] &&
              phraseWord.timestamp[1] === originalChunk.timestamp[1],
          );

          if (isPartOfPhrase) {
            return {
              ...originalChunk,
              disabled: nextDisabled,
              subtitleHidden: nextHidden,
            };
          }
          return originalChunk;
        });

        const updatedTranscript = {
          text: updatedChunks
            .filter((c) => !c.disabled)
            .map((c) => c.text)
            .join(" "),
          chunks: updatedChunks,
        };

        if (onTranscriptUpdate) {
          onTranscriptUpdate(updatedTranscript);
        }
      }
    } else {
      const updatedChunks = transcript.chunks.map((c, i) =>
        i === index
          ? { ...c, disabled: nextDisabled, subtitleHidden: nextHidden }
          : c,
      );

      const updatedTranscript = {
        text: updatedChunks
          .filter((c) => !c.disabled)
          .map((c) => c.text)
          .join(" "),
        chunks: updatedChunks,
      };

      if (onTranscriptUpdate) {
        onTranscriptUpdate(updatedTranscript);
      }
    }
  };

  const toggleWordDynamicPosition = (wordTimestamp: [number, number]) => {
    if (!onTranscriptUpdate) return;

    const updatedChunks = transcript.chunks.map((chunk) => {
      if (
        chunk.timestamp[0] === wordTimestamp[0] &&
        chunk.timestamp[1] === wordTimestamp[1]
      ) {
        const currentPos = chunk.dynamicPosition || "front";
        return {
          ...chunk,
          dynamicPosition: (currentPos === "behind" ? "front" : "behind") as
            | "behind"
            | "front",
        };
      }
      return chunk;
    });

    onTranscriptUpdate({
      text: updatedChunks.map((c) => c.text).join(" "),
      chunks: updatedChunks,
    });
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-2 pt-2 pb-1">
        <span className="text-xs text-muted-foreground">
          {(() => {
            const skipped = displayChunks.filter((c) => c.disabled).length;
            const hidden = displayChunks.filter(
              (c) => !c.disabled && c.subtitleHidden,
            ).length;
            const parts = [];
            if (skipped > 0) parts.push(`${skipped} skipped`);
            if (hidden > 0) parts.push(`${hidden} hidden`);
            return parts.length > 0 ? <span>{parts.join(", ")}</span> : null;
          })()}
        </span>
        {displayChunks.some((c) => c.disabled || c.subtitleHidden) && (
          <button
            onClick={() => setHideSkipped((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors ${
              hideSkipped
                ? "bg-slate-900 text-white"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
            title={
              hideSkipped
                ? "Show all segments"
                : "Hide skipped and hidden segments"
            }
          >
            <Filter className="h-3 w-3" />
            {hideSkipped ? "Show all" : "Hide inactive"}
          </button>
        )}
      </div>

      <div
        className="flex-1 overflow-y-auto lg:max-h-96"
        ref={transcriptContainerRef}
      >
        <div className="space-y-2 p-2">
          {displayChunks.map((chunk, i) => {
            const [start, end] = chunk.timestamp;
            const isActive = start <= currentTime && currentTime <= end;
            const isEditing = editingIndex === i;

            const isDisabled = chunk.disabled ?? false;
            const isHidden = chunk.subtitleHidden ?? false;

            if (hideSkipped && (isDisabled || isHidden)) return null;

            return (
              <div
                key={`${mode}-${i}-${start}`}
                ref={
                  isActive && !isDisabled
                    ? (el) => {
                        activeChunkRef.current = el;
                      }
                    : null
                }
                className={`p-2 rounded ${
                  isEditing ? "bg-muted" : "hover:bg-muted cursor-pointer"
                } transition-colors ${
                  isActive && !isEditing
                    ? "bg-muted border-l-4 border-black"
                    : ""
                } ${
                  isDisabled
                    ? "opacity-50 bg-gray-100 border-l-4 border-red-400"
                    : ""
                } ${
                  isHidden && !isDisabled
                    ? "opacity-70 bg-yellow-50 border-l-4 border-yellow-400"
                    : ""
                }`}
                onClick={() => {
                  if (!isEditing) {
                    setCurrentTime(start);
                  }
                }}
              >
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{formatTime(start)}</span>
                  <span>{formatTime(end)}</span>
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full p-2 border rounded-md text-sm min-h-[60px]"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelEdit();
                        }}
                        variant="default"
                        size="sm"
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          saveEdit();
                        }}
                        size="sm"
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex justify-between items-start">
                      <p
                        className={`${isActive ? "font-medium" : ""} ${isDisabled ? "line-through text-gray-500" : ""} ${isHidden && !isDisabled ? "italic text-yellow-700" : ""}`}
                      >
                        {chunk.text}
                      </p>
                      <div className="flex gap-1 shrink-0 ml-1">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditing(i);
                          }}
                          className="p-1"
                          title="Edit text"
                          size="icon"
                          variant="default"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            cycleChunkState(i);
                          }}
                          className="p-1"
                          title={
                            isDisabled
                              ? "Skipped (click to enable)"
                              : isHidden
                                ? "Subs hidden (click to skip)"
                                : "Click to hide subs"
                          }
                          size="icon"
                          variant="default"
                        >
                          {isDisabled ? (
                            <SkipForward className="h-3 w-3 text-red-500" />
                          ) : isHidden ? (
                            <EyeOff className="h-3 w-3 text-yellow-600" />
                          ) : (
                            <Ban className="h-3 w-3 text-gray-500" />
                          )}
                        </Button>
                      </div>
                    </div>
                    {/* Word pills for dynamic behind/front toggling */}
                    {dynamicEnabled &&
                      chunk.words &&
                      chunk.words.length > 0 &&
                      !isDisabled && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {chunk.words.map(
                            (word: ProcessedWord, wordIdx: number) => {
                              const pos = word.dynamicPosition || "front";
                              const isBehind = pos === "behind";
                              return (
                                <button
                                  key={`${word.timestamp[0]}-${wordIdx}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleWordDynamicPosition(word.timestamp);
                                  }}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                                    isBehind
                                      ? "bg-purple-100 text-purple-800 hover:bg-purple-200 border border-purple-300"
                                      : "bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300"
                                  }`}
                                  title={
                                    isBehind
                                      ? "Behind person (click to move to front)"
                                      : "In front of person (click to move behind)"
                                  }
                                >
                                  <span
                                    className={`text-[10px] font-bold ${isBehind ? "text-purple-600" : "text-blue-500"}`}
                                  >
                                    {isBehind ? "B" : "F"}
                                  </span>
                                  {word.text}
                                </button>
                              );
                            },
                          )}
                        </div>
                      )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t p-4 space-y-2">
        <div className="text-sm font-medium mb-2">Export Subtitles</div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleDownloadJson}
            className="flex items-center justify-center gap-1 px-3 py-2 "
          >
            <Edit />
            JSON
          </Button>

          <Button
            onClick={handleDownloadSrt}
            className="flex items-center justify-center gap-1 px-3 py-2 "
          >
            <Edit />
            SRT
          </Button>

          <Button
            onClick={handleDownloadVtt}
            className="flex items-center justify-center gap-1 px-3 py-2  col-span-2"
          >
            <Edit />
            WebVTT
          </Button>
        </div>
      </div>
    </div>
  );
}
