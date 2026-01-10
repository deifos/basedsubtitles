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
import { Edit, Ban, Undo2, Plus } from "lucide-react";

interface TranscriptChunk {
  text: string;
  timestamp: [number, number];
  disabled?: boolean;
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
}

export function TranscriptSidebar({
  transcript,
  currentTime,
  setCurrentTime,
  onTranscriptUpdate,
  className = "",
  mode,
}: TranscriptSidebarProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const activeChunkRef = useRef<HTMLDivElement>(null);
  const [currentActiveElement, setCurrentActiveElement] = useState<HTMLDivElement | null>(null);

  // State for adding new subtitles
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newSubtitleText, setNewSubtitleText] = useState("");
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");

  // Process transcript chunks based on the current mode
  const displayChunks: ProcessedChunk[] = useMemo(() => {
    const processed = processTranscriptChunks(transcript, mode);

    return processed.map((chunk, index) => {
      if (mode === "phrase" && chunk.words) {
        const everyWordDisabled = chunk.words.every((word) =>
          transcript.chunks.some(
            (originalChunk) =>
              originalChunk.timestamp[0] === word.timestamp[0] &&
              originalChunk.timestamp[1] === word.timestamp[1] &&
              originalChunk.disabled
          )
        );

        return {
          ...chunk,
          disabled: everyWordDisabled,
        };
      }

      return {
        ...chunk,
        disabled: transcript.chunks[index]?.disabled ?? false,
      };
    });
  }, [transcript, mode]);

  // Add effect to scroll to active chunk when currentTime changes
  useEffect(() => {
    // Add a small delay to ensure the DOM has updated with the new active state
    const timeoutId = setTimeout(() => {
      if (currentActiveElement && transcriptContainerRef.current) {
        const container = transcriptContainerRef.current;
        const activeElement = currentActiveElement;
        
        
        // Use scrollTop and clientHeight to determine the actual visible scroll area
        const scrollTop = container.scrollTop;
        const clientHeight = container.clientHeight;
        const scrollBottom = scrollTop + clientHeight;
        
        // Get element position within the scrollable content
        const elementOffsetTop = activeElement.offsetTop;
        const elementOffsetBottom = elementOffsetTop + activeElement.offsetHeight;
        
        // Calculate if element is visible within the scrollable viewport
        const isElementAboveViewport = elementOffsetTop < scrollTop;
        const isElementBelowViewport = elementOffsetBottom > scrollBottom;
        
        
        if (isElementAboveViewport || isElementBelowViewport) {
          // Calculate the scroll position to center the element in the container
          const newScrollTop = elementOffsetTop - clientHeight / 2 + activeElement.offsetHeight / 2;
          
          // Smooth scroll within the container only
          container.scrollTo({
            top: Math.max(0, newScrollTop),
            behavior: "smooth"
          });
        }
      }
    }, 100); // Increased delay to ensure DOM updates

    return () => clearTimeout(timeoutId);
  }, [currentTime, currentActiveElement]);

  const jsonTranscript = useMemo(() => {
    return JSON.stringify(transcript, null, 2).replace(
      /( {4}"timestamp": )\[\s+(\S+)\s+(\S+)\s+\]/gm,
      "$1[$2 $3]"
    );
  }, [transcript]);

  const handleDownloadJson = () => {
    const blob = new Blob([jsonTranscript], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transcript.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSrt = () => {
    const srtContent = transcriptToSrt(transcript, mode);
    const blob = new Blob([srtContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subtitles.srt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadVtt = () => {
    const vttContent = transcriptToVtt(transcript, mode);
    const blob = new Blob([vttContent], { type: "text/vtt" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subtitles.vtt";
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
      // For phrase mode, we need to update the original word chunks that make up this phrase
      const phraseToEdit = displayChunks[editingIndex];
      if (phraseToEdit.words && phraseToEdit.words.length > 0) {
        // Split the edited text into words
        const newWords = editText.trim().split(/\s+/);
        const originalWords = phraseToEdit.words;

        // Update each original chunk with the corresponding new word
        // If there are more new words than original, concatenate extras to the last original word
        // If there are fewer new words, the remaining original words keep their text
        originalWords.forEach((originalWord, wordIndex) => {
          const originalChunkIndex = transcript.chunks.findIndex(
            (chunk) =>
              chunk.timestamp[0] === originalWord.timestamp[0] &&
              chunk.timestamp[1] === originalWord.timestamp[1]
          );

          if (originalChunkIndex !== -1) {
            let newText = "";

            if (wordIndex === originalWords.length - 1) {
              // This is the last original word - concatenate all remaining new words
              newText = newWords.slice(wordIndex).join(" ");
            } else if (wordIndex < newWords.length) {
              // Not the last original word, take the corresponding new word if it exists
              newText = newWords[wordIndex];
            }

            updatedChunks[originalChunkIndex] = {
              ...updatedChunks[originalChunkIndex],
              text: newText || updatedChunks[originalChunkIndex].text,
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

  const toggleChunkDisabled = (index: number) => {
    if (mode === "phrase") {
      // For phrase mode, we need to toggle the disabled state of all word chunks
      // that make up this phrase
      const phraseToToggle = displayChunks[index];
      if (phraseToToggle.words) {
        const isCurrentlyDisabled = phraseToToggle.words.some((word: ProcessedWord) =>
          transcript.chunks.find(
            (chunk) =>
              chunk.timestamp[0] === word.timestamp[0] &&
              chunk.timestamp[1] === word.timestamp[1]
          )?.disabled
        );

        const updatedChunks = transcript.chunks.map((originalChunk) => {
          const isPartOfPhrase = phraseToToggle.words!.some((phraseWord) =>
            phraseWord.timestamp[0] === originalChunk.timestamp[0] &&
            phraseWord.timestamp[1] === originalChunk.timestamp[1]
          );
          
          if (isPartOfPhrase) {
            return { ...originalChunk, disabled: !isCurrentlyDisabled };
          }
          return originalChunk;
        });

        const updatedTranscript = {
          text: updatedChunks.filter(chunk => !chunk.disabled).map((chunk) => chunk.text).join(" "),
          chunks: updatedChunks,
        };

        if (onTranscriptUpdate) {
          onTranscriptUpdate(updatedTranscript);
        }
      }
    } else {
      // For word mode, direct toggle
      const updatedChunks = transcript.chunks.map((chunk, i) =>
        i === index ? { ...chunk, disabled: !chunk.disabled } : chunk
      );
      
      const updatedTranscript = {
        text: updatedChunks.filter(chunk => !chunk.disabled).map((chunk) => chunk.text).join(" "),
        chunks: updatedChunks,
      };

      if (onTranscriptUpdate) {
        onTranscriptUpdate(updatedTranscript);
      }
    }
  };

  // Helper to parse time input (supports "21" or "0:21" or "00:21" formats)
  const parseTimeInput = (input: string): number | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Check if it's just a number (seconds)
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      return parseFloat(trimmed);
    }

    // Check for MM:SS or M:SS format
    const mmssMatch = trimmed.match(/^(\d+):(\d+(?:\.\d+)?)$/);
    if (mmssMatch) {
      const minutes = parseInt(mmssMatch[1], 10);
      const seconds = parseFloat(mmssMatch[2]);
      return minutes * 60 + seconds;
    }

    // Check for HH:MM:SS format
    const hhmmssMatch = trimmed.match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);
    if (hhmmssMatch) {
      const hours = parseInt(hhmmssMatch[1], 10);
      const minutes = parseInt(hhmmssMatch[2], 10);
      const seconds = parseFloat(hhmmssMatch[3]);
      return hours * 3600 + minutes * 60 + seconds;
    }

    return null;
  };

  const startAddingNew = () => {
    // Default to current video time
    const startSeconds = currentTime;
    const endSeconds = currentTime + 1; // Default 1 second duration

    // Format as M:SS
    const formatTimeInput = (seconds: number): string => {
      const mins = Math.floor(seconds / 60);
      const secs = (seconds % 60).toFixed(2);
      return `${mins}:${parseFloat(secs) < 10 ? '0' : ''}${secs}`;
    };

    setNewStartTime(formatTimeInput(startSeconds));
    setNewEndTime(formatTimeInput(endSeconds));
    setNewSubtitleText("");
    setIsAddingNew(true);
  };

  const cancelAddNew = () => {
    setIsAddingNew(false);
    setNewSubtitleText("");
    setNewStartTime("");
    setNewEndTime("");
  };

  const saveNewSubtitle = () => {
    const startSeconds = parseTimeInput(newStartTime);
    const endSeconds = parseTimeInput(newEndTime);

    if (startSeconds === null || endSeconds === null) {
      alert("Please enter valid start and end times (e.g., '21' for 21 seconds or '0:21' for 0:21)");
      return;
    }

    if (startSeconds >= endSeconds) {
      alert("End time must be after start time");
      return;
    }

    if (!newSubtitleText.trim()) {
      alert("Please enter subtitle text");
      return;
    }

    // Create the new chunk
    const newChunk: TranscriptChunk = {
      text: newSubtitleText.trim(),
      timestamp: [startSeconds, endSeconds],
    };

    // Insert into the chunks array at the correct position (sorted by start time)
    const updatedChunks = [...transcript.chunks, newChunk].sort(
      (a, b) => a.timestamp[0] - b.timestamp[0]
    );

    const updatedTranscript = {
      text: updatedChunks.map((chunk) => chunk.text).join(" "),
      chunks: updatedChunks,
    };

    if (onTranscriptUpdate) {
      onTranscriptUpdate(updatedTranscript);
    }

    // Reset state
    cancelAddNew();
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Add Subtitle Button */}
      <div className="p-2 border-b">
        {!isAddingNew ? (
          <Button
            onClick={startAddingNew}
            className="w-full flex items-center justify-center gap-2"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
            Add Subtitle at {formatTime(currentTime)}
          </Button>
        ) : (
          <div className="space-y-3 p-2 bg-muted rounded-md">
            <div className="text-sm font-medium">Add New Subtitle</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Start Time</label>
                <input
                  type="text"
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                  placeholder="0:21"
                  className="w-full p-2 border rounded-md text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">End Time</label>
                <input
                  type="text"
                  value={newEndTime}
                  onChange={(e) => setNewEndTime(e.target.value)}
                  placeholder="0:22"
                  className="w-full p-2 border rounded-md text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Subtitle Text</label>
              <textarea
                value={newSubtitleText}
                onChange={(e) => setNewSubtitleText(e.target.value)}
                placeholder="Enter subtitle text..."
                className="w-full p-2 border rounded-md text-sm min-h-[60px]"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button onClick={cancelAddNew} variant="outline" size="sm">
                Cancel
              </Button>
              <Button onClick={saveNewSubtitle} size="sm">
                Add
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto max-h-96" ref={transcriptContainerRef}>
        <div className="space-y-2 p-2">
          {displayChunks.map((chunk, i) => {
            const [start, end] = chunk.timestamp;
            const isActive = start <= currentTime && currentTime <= end;
            const isEditing = editingIndex === i;

            // Check if this chunk is disabled
            const isDisabled = chunk.disabled ?? false;

            return (
              <div
                key={`${mode}-${i}-${start}`} // Include mode in key to force re-render when mode changes
                ref={isActive && !isDisabled ? (el) => {
                  if (el) {
                    setCurrentActiveElement(el);
                    activeChunkRef.current = el;
                  }
                } : null}
                className={`p-2 rounded ${
                  isEditing ? "bg-muted" : "hover:bg-muted cursor-pointer"
                } transition-colors ${
                  isActive && !isEditing
                    ? "bg-muted border-l-4 border-black"
                    : ""
                } ${
                  isDisabled ? "opacity-50 bg-gray-100 border-l-4 border-gray-400" : ""
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
                  <div className="flex justify-between items-start">
                    <p className={`${isActive ? "font-medium" : ""} ${isDisabled ? "line-through text-gray-500" : ""}`}>
                      {chunk.text}
                    </p>
                    <div className="flex gap-1">
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
                          toggleChunkDisabled(i);
                        }}
                        className={`p-1 ${
                          isDisabled
                            ? "text-emerald-600 hover:text-emerald-800"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                        title={isDisabled ? "Enable section" : "Disable section"}
                        size="icon"
                        variant="default"
                      >
                        {isDisabled ? (
                          <Undo2 className="h-3 w-3" />
                        ) : (
                          <Ban className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
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
