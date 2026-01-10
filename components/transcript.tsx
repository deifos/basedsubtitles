"use client";

import { useMemo } from "react";

interface TranscriptChunk {
  text: string;
  timestamp: [number, number];
}

interface TranscriptProps {
  transcript: {
    text: string;
    chunks: TranscriptChunk[];
  };
  currentTime: number;
  setCurrentTime: (time: number) => void;
  className?: string;
}

const Chunk = ({
  chunk,
  currentTime,
  onClick,
}: {
  chunk: TranscriptChunk;
  currentTime: number;
  onClick: () => void;
}) => {
  const { text, timestamp } = chunk;
  const [start, end] = timestamp;
  const isActive = start <= currentTime && currentTime < end;

  return (
    <span>
      {text.startsWith(" ") ? " " : ""}
      <span
        onClick={onClick}
        className="text-md text-muted-foreground cursor-pointer hover:text-primary"
        title={`${start.toFixed(2)}s → ${end.toFixed(2)}s`}
        style={{
          textDecoration: isActive ? "underline" : "none",
          fontWeight: isActive ? "bold" : "normal",
        }}
      >
        {text.trim()}
      </span>
    </span>
  );
};

export function Transcript({
  transcript,
  currentTime,
  setCurrentTime,
  className = "",
}: TranscriptProps) {
  const jsonTranscript = useMemo(() => {
    return JSON.stringify(transcript, null, 2).replace(
      /( {4}"timestamp": )\[\s+(\S+)\s+(\S+)\s+\]/gm,
      "$1[$2 $3]"
    );
  }, [transcript]);

  const handleDownload = () => {
    const blob = new Blob([jsonTranscript], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transcript.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className={className}>
        {transcript.chunks.map((chunk, i) => (
          <Chunk
            key={i}
            chunk={chunk}
            currentTime={currentTime}
            onClick={() => setCurrentTime(chunk.timestamp[0])}
          />
        ))}
      </div>

      <div className="flex justify-center border-t pt-4">
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
            />
          </svg>
          Download transcript
        </button>
      </div>
    </div>
  );
}
