import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format seconds into a readable time format (MM:SS)
 */
export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

/**
 * Format seconds into SRT timestamp format (HH:MM:SS,MS)
 */
export function formatSrtTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")},${ms
    .toString()
    .padStart(3, "0")}`;
}

/**
 * Format seconds into WebVTT timestamp format (HH:MM:SS.MS)
 */
export function formatVttTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms
    .toString()
    .padStart(3, "0")}`;
}

export interface ProcessedWord {
  text: string;
  timestamp: [number, number];
  disabled?: boolean;
}

export interface ProcessedChunk {
  text: string;
  timestamp: [number, number];
  disabled?: boolean;
  words?: ProcessedWord[];
}

interface SourceTranscript {
  chunks: Array<{
    text: string;
    timestamp: [number, number];
    disabled?: boolean;
  }>;
}

/**
 * Process transcript chunks according to the mode (word/phrase)
 */
export function processTranscriptChunks(
  transcript: SourceTranscript,
  mode: "word" | "phrase" = "word"
): ProcessedChunk[] {
  if (mode === "word") {
    return transcript.chunks.map((chunk) => ({
      text: chunk.text,
      timestamp: chunk.timestamp,
      disabled: chunk.disabled,
    }));
  }

  const processedChunks: ProcessedChunk[] = [];

  type PhraseAccumulator = {
    texts: string[];
    words: ProcessedWord[];
    start: number;
    end: number;
    disabled: boolean;
  } | null;

  let currentGroup: PhraseAccumulator = null;

  const MAX_PHRASE_WORDS = 6;
  const MAX_PHRASE_DURATION = 3.0;
  const MAX_GAP = 0.5;

  const flushGroup = () => {
    if (!currentGroup) {
      return;
    }

    processedChunks.push({
      text: currentGroup.texts.join(" "),
      timestamp: [currentGroup.start, currentGroup.end],
      disabled: currentGroup.disabled,
      words: currentGroup.words,
    });

    currentGroup = null;
  };

  transcript.chunks.forEach((chunk, index) => {
    const [start, end] = chunk.timestamp;
    const trimmedText = chunk.text.trim();

    if (!trimmedText) {
      return;
    }

    const chunkDisabled = Boolean(chunk.disabled);
    const wordData: ProcessedWord = {
      text: trimmedText,
      timestamp: [start, end],
      disabled: chunk.disabled,
    };

    if (!currentGroup) {
      currentGroup = {
        texts: [trimmedText],
        words: [wordData],
        start,
        end,
        disabled: chunkDisabled,
      };
      return;
    }

    const timeSinceLastWord = start - currentGroup.end;
    const wouldExceedWordLimit = currentGroup.texts.length >= MAX_PHRASE_WORDS;
    const wouldExceedDuration = end - currentGroup.start > MAX_PHRASE_DURATION;
    const crossesDisabledBoundary = chunkDisabled !== currentGroup.disabled;
    const endsWithPunctuation = /[.!?]$/.test(
      currentGroup.texts[currentGroup.texts.length - 1]
    );
    const endsWithCommaLike = /[,;:]$/.test(
      currentGroup.texts[currentGroup.texts.length - 1]
    );

    const shouldEndPhrase =
      crossesDisabledBoundary ||
      timeSinceLastWord > MAX_GAP ||
      wouldExceedWordLimit ||
      wouldExceedDuration ||
      endsWithPunctuation ||
      (endsWithCommaLike && currentGroup.texts.length >= 3);

    if (shouldEndPhrase) {
      flushGroup();
      currentGroup = {
        texts: [trimmedText],
        words: [wordData],
        start,
        end,
        disabled: chunkDisabled,
      };
    } else {
      currentGroup.texts.push(trimmedText);
      currentGroup.words.push(wordData);
      currentGroup.end = end;
    }

    if (index === transcript.chunks.length - 1) {
      flushGroup();
    }
  });

  flushGroup();

  return processedChunks;
}

/**
 * Convert transcript data to SRT format
 */
export function transcriptToSrt(
  transcript: {
    chunks: Array<{
      text: string;
      timestamp: [number, number];
    }>;
  },
  mode: "word" | "phrase" = "word"
): string {
  const processedChunks = processTranscriptChunks(transcript, mode);
  return processedChunks
    .map((chunk, index) => {
      const [start, end] = chunk.timestamp;
      return `${index + 1}\n${formatSrtTime(start)} --> ${formatSrtTime(
        end
      )}\n${chunk.text}\n`;
    })
    .join("\n");
}

/**
 * Convert transcript data to WebVTT format
 */
export function transcriptToVtt(
  transcript: {
    chunks: Array<{
      text: string;
      timestamp: [number, number];
    }>;
  },
  mode: "word" | "phrase" = "word"
): string {
  const header = "WEBVTT\n\n";
  const processedChunks = processTranscriptChunks(transcript, mode);
  const cues = processedChunks
    .map((chunk, index) => {
      const [start, end] = chunk.timestamp;
      return `${index + 1}\n${formatVttTime(start)} --> ${formatVttTime(
        end
      )}\n${chunk.text}\n`;
    })
    .join("\n");

  return header + cues;
}
