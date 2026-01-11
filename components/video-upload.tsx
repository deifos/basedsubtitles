"use client";

import { useCallback, useState, forwardRef, useEffect, memo, useRef } from "react";
import { cn } from "@/lib/utils";
import { VideoCaption } from "./video-caption";
import { SubtitleStyle } from "./subtitle-styling";
import { UploadIcon } from "lucide-react";

interface VideoUploadProps {
  onVideoSelect: (file: File) => void;
  onTimeUpdate?: (time: number) => void;
  onAspectRatioDetected?: (ratio: "16:9" | "9:16") => void;
  className?: string;
  transcript?: {
    text: string;
    chunks: Array<{
      text: string;
      timestamp: [number, number];
      disabled?: boolean;
    }>;
  } | null;
  currentTime?: number;
  subtitleStyle: SubtitleStyle;
  mode: "word" | "phrase";
  ratio: "16:9" | "9:16";
  zoomPortrait: boolean;
  initialFile?: File | null;
}

const VideoUploadComponent = forwardRef<HTMLVideoElement, VideoUploadProps>(
  (
    {
      onVideoSelect,
      onTimeUpdate,
      onAspectRatioDetected,
      className,
      transcript,
      currentTime = 0,
      subtitleStyle,
      mode,
      ratio,
      zoomPortrait,
      initialFile,
    },
    ref
  ) => {
    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isSkipping, setIsSkipping] = useState(false);
    const processedFileRef = useRef<File | null>(null);

    // Reset video source when ref.current.src is empty
    useEffect(() => {
      if (ref && typeof ref !== "function" && ref.current) {
        // Check if the video element has no source
        if (!ref.current.src || ref.current.src === window.location.href) {
          setVideoSrc(null);
        }
      }
    }, [ref]);

    // Reset state when component is mounted
    useEffect(() => {
      setVideoSrc(null);
      setError(null);
    }, []);

    const handleFile = useCallback(
      async (file: File) => {
        try {
          if (!file.type.startsWith("video/")) {
            throw new Error("Please select a video file");
          }

          // Create video element to check duration
          const video = document.createElement("video");
          video.preload = "metadata";

          await new Promise((resolve, reject) => {
            video.onloadedmetadata = resolve;
            video.onerror = reject;
            video.src = URL.createObjectURL(file);
          });

          if (video.duration > 300) {
            URL.revokeObjectURL(video.src);
            throw new Error("Video must be less than 5 minutes");
          }

          // Detect aspect ratio from video dimensions
          const detectedRatio: "16:9" | "9:16" = video.videoHeight > video.videoWidth ? "9:16" : "16:9";
          
          setVideoSrc(video.src);
          setError(null);
          onVideoSelect(file);
          
          // Notify parent of detected aspect ratio
          if (onAspectRatioDetected) {
            onAspectRatioDetected(detectedRatio);
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Error loading video");
          setVideoSrc(null);
        }
      },
      [onVideoSelect, onAspectRatioDetected]
    );

    const handleDrop = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();

        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      },
      [handleFile]
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);

        // Reset the input value to allow selecting the same file again
        e.target.value = "";
      },
      [handleFile]
    );

    useEffect(() => {
      if (!initialFile) {
        return;
      }

      if (processedFileRef.current === initialFile) {
        return;
      }

      processedFileRef.current = initialFile;
      void handleFile(initialFile);
    }, [initialFile, handleFile]);

    // Function to get disabled time ranges
    const getDisabledRanges = useCallback(() => {
      if (!transcript) return [];
      
      const disabledRanges: Array<[number, number]> = [];
      
      transcript.chunks.forEach(chunk => {
        if (chunk.disabled) {
          disabledRanges.push(chunk.timestamp);
        }
      });
      
      // Sort ranges by start time and merge overlapping ranges
      disabledRanges.sort((a, b) => a[0] - b[0]);
      const mergedRanges: Array<[number, number]> = [];
      
      for (const range of disabledRanges) {
        if (mergedRanges.length === 0 || mergedRanges[mergedRanges.length - 1][1] < range[0]) {
          mergedRanges.push(range);
        } else {
          // Merge overlapping ranges
          mergedRanges[mergedRanges.length - 1][1] = Math.max(
            mergedRanges[mergedRanges.length - 1][1],
            range[1]
          );
        }
      }
      
      return mergedRanges;
    }, [transcript]);

    // Function to handle time updates and skip disabled segments
    const handleTimeUpdate = useCallback(
      (e: React.SyntheticEvent<HTMLVideoElement>) => {
        const video = e.currentTarget;
        const currentTime = video.currentTime;
        
        // Call the original onTimeUpdate
        onTimeUpdate?.(currentTime);
        
        // Skip disabled segments
        if (!isSkipping && transcript) {
          const disabledRanges = getDisabledRanges();
          
          for (const [start, end] of disabledRanges) {
            // If current time is within a disabled range, skip to the end
            if (currentTime >= start && currentTime < end) {
              setIsSkipping(true);
              video.currentTime = end + 0.1; // Add small buffer to avoid edge cases
              
              // Reset skipping flag after a short delay
              setTimeout(() => {
                setIsSkipping(false);
              }, 100);
              break;
            }
          }
        }
      },
      [onTimeUpdate, transcript, isSkipping, getDisabledRanges]
    );

    return (
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg transition-colors overflow-hidden",
          videoSrc ? "" : "min-h-[300px]",
          className
        )}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={handleDrop}
      >
        {videoSrc ? (
          <div className="relative flex items-center justify-center w-full">
            <div 
              className={cn(
                "relative mx-auto flex justify-center",
                ratio === "16:9" ? "w-full" : "w-auto"
              )}
              style={{
                aspectRatio: ratio === "16:9" ? "16/9" : "9/16"
              }}
            >
              <video
                ref={ref}
                src={videoSrc}
                controls
                className={cn(
                  ratio === "16:9"
                    ? "object-cover w-full max-w-4xl max-h-[500px]"
                    : ratio === "9:16" && zoomPortrait
                      ? "object-cover h-[500px] max-h-[500px]"
                      : "object-contain h-[500px] max-h-[500px]"
                )}
                style={{
                  aspectRatio: ratio === "16:9" ? "16/9" : "9/16"
                }}
                onTimeUpdate={handleTimeUpdate}
              />
              {isSkipping && (
                <div className="absolute top-4 right-4 bg-black bg-opacity-75 text-white px-3 py-1 rounded-md text-sm font-medium">
                  ⏭️ Skipping disabled segment
                </div>
              )}
              {transcript && (
                <VideoCaption
                  transcript={transcript}
                  currentTime={currentTime}
                  style={subtitleStyle}
                  mode={mode}
                  ratio={ratio}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <input
              type="file"
              accept="video/*"
              onChange={handleChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <p className="mb-2">
              Drag and drop a video file here, or click to select{" "}
              <UploadIcon className="mx-auto mt-8" />
            </p>
            <p className="text-xs text-muted-foreground">
              Supports MP4 and WebM formats, max 5 minutes
            </p>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive text-center mt-2">{error}</p>
        )}
      </div>
    );
  }
);

VideoUploadComponent.displayName = "VideoUpload";

// Memoized export for better performance
export const VideoUpload = memo(VideoUploadComponent);
