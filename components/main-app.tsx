"use client";

import type { JSX } from "react";
import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { SiteFooter } from "@/components/site-footer";
import { BuyMeCoffee } from "@/components/buy-me-coffee";
import { VideoUpload } from "@/components/video-upload";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  Download,
  Video,
  ZoomIn,
  ZoomOut,
  ScanFace,
  Loader2,
  CheckCircle2,
  RefreshCw,
  RectangleHorizontal,
  RectangleVertical,
} from "lucide-react";
import { TranscriptSidebar } from "@/components/transcript-sidebar";
import {
  FONT_FAMILIES,
  SubtitleStyling,
  SubtitleStyle,
} from "@/components/subtitle-styling";
import { WordStylePopover } from "@/components/word-style-popover";
import { Button } from "@/components/ui/button";
import {
  processTranscriptChunks,
  binarySearchActiveChunk,
  formatTime,
  type WordStyleOverride,
} from "@/lib/transcript-utils";
import { ProcessingOverlay } from "@/components/processing-overlay";
import {
  useTranscription,
  STATUS_MESSAGES,
  type TranscriptionResult,
  type ModelSize,
} from "@/hooks/useTranscription";
import { useVideoDownloadMediaBunny } from "@/hooks/useVideoDownloadMediaBunny";
import { useBackgroundRemoval } from "@/hooks/useBackgroundRemoval";
import { useFaceTracking } from "@/hooks/useFaceTracking";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type LanguageCode } from "@/components/language-selector";
import { LanguageSelectionModal } from "@/components/language-selection-modal";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Settings, FileText, Eraser, Maximize2 } from "lucide-react";
import { APP_VERSION } from "@/lib/changelog";
import { toast } from "sonner";

interface MainAppProps {
  initialFile?: File | null;
  onReturnToLanding?: () => void;
}

// Default subtitle style - Gold preset
const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontFamily: FONT_FAMILIES.playfairDisplay.value,
  fontSize: 18,
  fontWeight: "600",
  color: "#FFFFFF",
  backgroundColor: "transparent",
  borderWidth: 1,
  borderColor: "#1A1A1A",
  dropShadowIntensity: 0.55,
  wordEmphasisEnabled: false,
  wordEmphasisColorEnabled: true,
  wordEmphasisColor: "#F2D21B",
  position: "bottom",
  maxWordsPerLine: 3,
  backgroundRemovalEnabled: false,
  backgroundType: "solid",
  solidBackgroundColor: "#000000",
  dynamicEnabled: false,
  dynamicFontSize: 80,
  dynamicYPosition: 35,
  dynamicFrontFontSize: 40,
  dynamicFrontYPosition: 75,
  dynamicFollowWord: false,
  textFadeIn: false,
  brandingWatermark: true,
  splitSubtitleMode: "none",
  verticalOffset: -10,
};

export function MainApp({
  initialFile = null,
  onReturnToLanding,
}: MainAppProps): JSX.Element {
  const [currentTime, setCurrentTime] = useState(0);
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(
    DEFAULT_SUBTITLE_STYLE,
  );
  const [uploadKey, setUploadKey] = useState(0);
  const [mode, setMode] = useState<"word" | "phrase">("phrase");
  const [ratio, setRatio] = useState<"16:9" | "9:16">("16:9");
  const [zoomPortrait, setZoomPortrait] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [modelSize, setModelSize] = useState<ModelSize>("base");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [mobileTab, setMobileTab] = useState<"styling" | "edit">("styling");
  const [showAboutSheet, setShowAboutSheet] = useState(false);
  const [showExpandedSheet, setShowExpandedSheet] = useState(false);
  const [showBgConfirm, setShowBgConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [selectedWordTimestamp, setSelectedWordTimestamp] = useState<
    [number, number] | null
  >(null);
  const previousResultRef = useRef<TranscriptionResult | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastChunkKeyRef = useRef<string | null>(null);

  const {
    status,
    error,
    result,
    progress,
    device,
    setResult,
    handleVideoSelect: handleVideoSelectBase,
    startTranscription,
    resetTranscription,
    cancelTranscription,
    setStatus: setTranscriptionStatus,
  } = useTranscription();

  const {
    isModelLoading: isBgModelLoading,
    isProcessing: isBgProcessing,
    progress: bgProgress,
    isReady: bgRemovalReady,
    processVideo: processBgRemoval,
    getMaskAtTime,
    reset: resetBgRemoval,
    processFrame: bgProcessFrame,
  } = useBackgroundRemoval();

  const { startTracking, stopTracking, getCenterX, buildExportTimeline } =
    useFaceTracking();

  // User toggle for face tracking + whether it's actively running
  const [faceTrackingEnabled, setFaceTrackingEnabled] = useState(true);
  const [isFaceTrackingActive, setIsFaceTrackingActive] = useState(false);
  const [isVideoLandscape, setIsVideoLandscape] = useState(false);

  // Start/stop face tracking: runs when split subtitle is active OR manual toggle is on
  const splitActive = subtitleStyle.splitSubtitleMode !== "none";
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl || !videoEl.src || videoEl.src === window.location.href) {
      return;
    }

    const shouldTrack = faceTrackingEnabled || splitActive;

    const tryStart = () => {
      if (!videoEl.videoWidth) return; // metadata not loaded yet
      const isLandscape = videoEl.videoWidth > videoEl.videoHeight;
      setIsVideoLandscape(isLandscape);
      if (shouldTrack) {
        startTracking(videoEl);
        setIsFaceTrackingActive(true);
      } else {
        stopTracking();
        setIsFaceTrackingActive(false);
      }
    };

    // If metadata is already loaded, start immediately
    if (videoEl.readyState >= 1) {
      tryStart();
    } else {
      videoEl.addEventListener("loadedmetadata", tryStart, { once: true });
    }

    return () => {
      videoEl.removeEventListener("loadedmetadata", tryStart);
      stopTracking();
      setIsFaceTrackingActive(false);
    };
  }, [ratio, faceTrackingEnabled, splitActive, startTracking, stopTracking]);

  const handleVideoSelect = useCallback(
    (file: File) => {
      setUploadedFile(file);
      handleVideoSelectBase(file);
      // Show language selection modal after video loads
      setShowLanguageModal(true);
    },
    [handleVideoSelectBase],
  );

  const handleAspectRatioDetected = useCallback(
    (detectedRatio: "16:9" | "9:16") => {
      setRatio(detectedRatio);
      // Reset zoom when aspect ratio changes
      if (detectedRatio === "16:9") {
        setZoomPortrait(false);
      }
    },
    [],
  );

  const handleLanguageConfirm = useCallback(
    (selectedLanguage: LanguageCode, selectedModelSize: ModelSize) => {
      setLanguage(selectedLanguage);
      setModelSize(selectedModelSize);
      setResult(null);
      setShowLanguageModal(false);
      previousResultRef.current = null;
      // Set status synchronously so the processing overlay appears in the same
      // render batch as the modal close — no idle gap.
      setTranscriptionStatus("processing");
      if (uploadedFile) {
        startTranscription(uploadedFile, selectedLanguage, selectedModelSize);
      }
    },
    [uploadedFile, startTranscription, setResult, setTranscriptionStatus],
  );

  const handleChangeLanguage = useCallback(() => {
    previousResultRef.current = result;
    setShowLanguageModal(true);
  }, [result]);

  const [exportQuality, setExportQuality] = useState<"medium" | "high">(
    "medium",
  );

  const {
    downloadVideo,
    cancelDownload,
    exportDiagnostics,
    isProcessing: isDownloadProcessing,
    progress: downloadProgress,
    status: downloadStatus,
  } = useVideoDownloadMediaBunny({
    video: videoRef.current,
    transcriptChunks: result?.chunks || [],
    subtitleStyle,
    mode,
    ratio,
    format: "mp4",
    quality: exportQuality,
    fps: 30,
    bgRemovalReady,
    processFrame: bgProcessFrame,
    getMaskAtTime,
    buildExportTimeline: faceTrackingEnabled ? buildExportTimeline : undefined,
  });

  const handleRemoveBackground = useCallback(async () => {
    if (!videoRef.current) return;
    const dur = videoRef.current.duration || 0;
    if (dur > 60) {
      setShowBgConfirm(true);
      return;
    }
    startBgRemoval();
  }, []);

  const startBgRemoval = useCallback(async () => {
    if (!videoRef.current) return;
    setSubtitleStyle((prev) => ({
      ...prev,
      backgroundRemovalEnabled: true,
      dynamicEnabled: true,
    }));
    try {
      await processBgRemoval(videoRef.current);
    } catch {
      toast.error(
        "Background removal failed. This feature requires WebGPU or WASM support, which may not be available on your device.",
      );
    }
  }, [processBgRemoval]);

  const handleCancelBgRemoval = useCallback(() => {
    resetBgRemoval();
    setSubtitleStyle((prev) => ({
      ...prev,
      backgroundRemovalEnabled: false,
      dynamicEnabled: false,
    }));
  }, [resetBgRemoval]);

  // Memoized handlers for better performance
  const handleResetVideo = useCallback(() => {
    // Reset transcription state
    resetTranscription();

    // Reset face tracking
    stopTracking();
    setIsFaceTrackingActive(false);
    setIsVideoLandscape(false);

    // Reset background removal
    resetBgRemoval();
    setSubtitleStyle((prev) => ({
      ...prev,
      backgroundRemovalEnabled: false,
    }));

    // Clear uploaded file
    setUploadedFile(null);

    // Reset current time
    setCurrentTime(0);

    // Increment key to force VideoUpload component to remount
    setUploadKey((prev) => prev + 1);

    // Reset video element
    if (videoRef.current) {
      // First pause the video to prevent any issues
      videoRef.current.pause();
      // Clear the source
      videoRef.current.removeAttribute("src");
      // Force the browser to release any object URLs
      videoRef.current.load();
    }

    onReturnToLanding?.();
  }, [resetTranscription, resetBgRemoval, stopTracking, onReturnToLanding]);

  const handleModalClose = useCallback(() => {
    if (previousResultRef.current && !result) {
      // User cancelled "Change Language" — restore previous result
      setResult(previousResultRef.current);
      setShowLanguageModal(false);
      previousResultRef.current = null;
    } else if (!result) {
      // No transcription yet — go back to landing page
      setShowLanguageModal(false);
      previousResultRef.current = null;
      handleResetVideo();
    } else {
      setShowLanguageModal(false);
      previousResultRef.current = null;
    }
  }, [result, setResult, handleResetVideo]);

  const handleModeChange = useCallback((value: "word" | "phrase") => {
    setMode(value);
  }, []);

  const handleRatioChange = useCallback((value: string) => {
    const newRatio = value as "16:9" | "9:16";
    setRatio(newRatio);
    if (newRatio === "16:9") {
      setZoomPortrait(false);
    }
  }, []);

  const handleZoomPortraitChange = useCallback((zoom: boolean) => {
    setZoomPortrait(zoom);
  }, []);

  const handleWordSelect = useCallback((timestamp: [number, number]) => {
    setSelectedWordTimestamp((prev) =>
      prev && prev[0] === timestamp[0] && prev[1] === timestamp[1]
        ? null // deselect if clicking the same word
        : timestamp,
    );
  }, []);

  const handleWordStyleChange = useCallback(
    (override: WordStyleOverride) => {
      if (!result || !selectedWordTimestamp) return;
      setResult((prev) => {
        if (!prev) return prev;
        const updatedChunks = prev.chunks.map((chunk) => {
          if (
            chunk.timestamp[0] === selectedWordTimestamp[0] &&
            chunk.timestamp[1] === selectedWordTimestamp[1]
          ) {
            return {
              ...chunk,
              styleOverride:
                Object.keys(override).length > 0 ? override : undefined,
            };
          }
          return chunk;
        });
        return { ...prev, chunks: updatedChunks };
      });
    },
    [result, selectedWordTimestamp, setResult],
  );

  const handleWordStyleReset = useCallback(() => {
    handleWordStyleChange({});
  }, [handleWordStyleChange]);

  const handleWordStyleClose = useCallback(() => {
    setSelectedWordTimestamp(null);
  }, []);

  // Get the selected word's text and current override
  const selectedWordInfo = useMemo(() => {
    if (!result || !selectedWordTimestamp) return null;
    const chunk = result.chunks.find(
      (c) =>
        c.timestamp[0] === selectedWordTimestamp[0] &&
        c.timestamp[1] === selectedWordTimestamp[1],
    );
    if (!chunk) return null;
    return { text: chunk.text, override: chunk.styleOverride ?? {} };
  }, [result, selectedWordTimestamp]);

  // Get current phrase words for the word chip bar
  // Pre-compute phrase chunks once per transcript/mode change (not per frame)
  const processedPhraseChunks = useMemo(() => {
    if (!result || mode !== "phrase") return [];
    return processTranscriptChunks(
      result,
      "phrase",
      subtitleStyle.maxWordsPerLine,
      subtitleStyle.dynamicEnabled,
    );
  }, [
    result,
    mode,
    subtitleStyle.maxWordsPerLine,
    subtitleStyle.dynamicEnabled,
  ]);

  const handleTimeUpdate = useCallback(
    (time: number) => {
      // Only call setCurrentTime when the active phrase chunk changes.
      // This prevents main-app (and all its children) from re-rendering every
      // 250ms during playback. VideoCaption uses localTime inside VideoUpload
      // and doesn't need main-app re-renders for subtitle display.
      if (processedPhraseChunks.length > 0) {
        const newChunk = binarySearchActiveChunk(processedPhraseChunks, time);
        const newKey = newChunk
          ? `${newChunk.timestamp[0]}-${newChunk.timestamp[1]}`
          : null;
        if (newKey !== lastChunkKeyRef.current) {
          lastChunkKeyRef.current = newKey;
          setCurrentTime(time);
        }
      } else {
        // Word mode or no transcript: update normally (sidebar highlighting)
        setCurrentTime(time);
      }
    },
    [processedPhraseChunks],
  );

  // Binary-search for the active chunk on each time update
  const currentPhraseWords = useMemo(() => {
    if (!processedPhraseChunks.length) return [];
    const activeChunk = binarySearchActiveChunk(
      processedPhraseChunks,
      currentTime,
    );
    if (!activeChunk?.words) return [];
    return activeChunk.words.filter((w) => !w.disabled && !w.subtitleHidden);
  }, [processedPhraseChunks, currentTime]);

  const isProcessing = status !== "idle" && status !== "ready";
  // Full blocking overlay during model load / audio extraction / first chunk.
  // Once partial chunks arrive (result != null) switch to the slim header banner.
  const isBlockingOverlay = isProcessing && result === null;
  const isTranscribingBanner = isProcessing && result !== null;
  const statusMessage = STATUS_MESSAGES[status] ?? "Processing video...";
  const latestTranscribedTime = result?.chunks?.at(-1)?.timestamp?.[1] ?? null;
  const isLongVideo = (result?.chunks?.at(-1)?.timestamp?.[1] ?? 0) > 30 * 60;

  return (
    <main className="flex flex-col relative bg-background h-dvh overflow-hidden lg:h-auto lg:min-h-screen lg:overflow-auto">
      {/* Header */}
      <header className="w-full border-b-2 border-black/10 bg-background">
        <div className="container mx-auto px-4 md:px-6 py-2 lg:py-3 flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 lg:gap-3">
            <Button
              variant="default"
              size="icon-sm"
              className="bg-foreground text-sm font-bold tracking-tight text-primary-foreground lg:cursor-default"
              onClick={() => setShowAboutSheet(true)}
            >
              BS
            </Button>
            <div className="text-left">
              <h1
                className="text-sm lg:text-lg font-bold text-foreground leading-tight"
                style={{ fontFamily: "var(--font-outfit), sans-serif" }}
              >
                Based Subtitles
              </h1>
              <p
                className="text-xs text-muted-foreground hidden lg:block"
                style={{ fontFamily: "var(--font-outfit), sans-serif" }}
              >
                100% local &middot; powered by transformers.js
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 items-center">
            {uploadedFile && !result && (
              <Button
                onClick={() => setShowLanguageModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/80 shadow-sm"
                style={{ fontFamily: "var(--font-outfit), sans-serif" }}
              >
                <Video className="w-4 h-4" />
                Transcribe Video
              </Button>
            )}
            {isTranscribingBanner && (
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
                <span
                  className="text-sm text-muted-foreground font-medium"
                  style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                >
                  Transcribing
                  {latestTranscribedTime !== null
                    ? ` ${formatTime(latestTranscribedTime)}`
                    : ""}{" "}
                  · {Math.round(progress)}%{" "}
                  <span
                    className={
                      device === "webgpu"
                        ? "text-green-600"
                        : "text-muted-foreground"
                    }
                  >
                    ({device === "webgpu" ? "WebGPU" : "CPU"})
                  </span>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={cancelTranscription}
                  style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                >
                  Cancel
                </Button>
              </div>
            )}
            {result && status === "ready" && (
              <>
                {/* Mobile: compact upload button */}
                <Button
                  onClick={() => setShowResetConfirm(true)}
                  variant="outline"
                  size="sm"
                  className="lg:hidden flex items-center gap-1.5 text-xs"
                  style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                >
                  <Upload className="w-3.5 h-3.5" />
                  New
                </Button>
                {/* Desktop: full buttons */}
                <div className="hidden lg:flex gap-2">
                  <Button
                    onClick={handleChangeLanguage}
                    variant="outline"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border-border text-foreground text-sm font-semibold hover:bg-muted"
                    style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Regenerate Subs
                  </Button>
                  <Button
                    onClick={() => setShowResetConfirm(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/80 shadow-sm"
                    style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                  >
                    <Upload className="w-4 h-4" />
                    Upload New
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* App Section */}
      <section className="flex-1 min-h-0 flex flex-col lg:block lg:min-h-auto w-full py-0 lg:py-4">
        <div className="flex-1 min-h-0 flex flex-col lg:block mx-auto px-1 lg:px-4 md:px-6 w-full">
          <div className="flex-1 min-h-0 flex flex-col lg:block w-full mx-auto space-y-1 lg:space-y-4 p-1 lg:p-4 md:p-6 rounded-none lg:rounded-2xl border-0 lg:border lg:border-border bg-background lg:shadow-sm">
            {!result && (
              <>
                <div className="text-center">
                  <p
                    className="text-muted-foreground text-sm"
                    style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                  >
                    Upload a video (MP4 or WebM) to generate subtitles
                  </p>
                </div>
                <Alert>
                  <Video className="h-4 w-4 text-muted-foreground" />
                  <AlertDescription
                    style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                  >
                    Supported formats: MP4 and WebM. Maximum video length: 5
                    minutes.
                  </AlertDescription>
                </Alert>
              </>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Language selection modal */}
            <LanguageSelectionModal
              open={showLanguageModal}
              onClose={handleModalClose}
              onConfirm={handleLanguageConfirm}
              defaultLanguage={language}
              defaultModelSize={modelSize}
            />

            {/* Mobile inline tabs — Styling / Edit below download */}

            <div className="flex-1 min-h-0 flex flex-col lg:flex-row lg:items-start gap-0 lg:gap-6">
              {/* Subtitle Styling Column - Hidden on mobile, shown on desktop */}
              {result && (
                <div className="hidden lg:block w-full lg:w-96">
                  <div className="rounded-2xl h-[calc(100vh-11rem-20px)] overflow-y-auto w-full border border-border bg-background p-2 shadow-lg">
                    <div className="p-2 space-y-4">
                      <SubtitleStyling
                        style={subtitleStyle}
                        onChange={setSubtitleStyle}
                        mode={mode}
                        onModeChange={handleModeChange}
                        bgRemovalReady={bgRemovalReady}
                        ratio={ratio}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Video Column */}
              <div className="flex-1 min-h-0 flex flex-col">
                {/* Mobile: controls bar above video */}
                {result && (
                  <div
                    className="lg:hidden flex items-center justify-between gap-2 px-1 py-1.5"
                    style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                  >
                    <div className="flex items-center gap-1.5">
                      <Tabs value={ratio} onValueChange={handleRatioChange}>
                        <TabsList className="grid w-auto grid-cols-2 h-auto">
                          <TabsTrigger
                            value="16:9"
                            className="px-2 py-1"
                            title="Landscape (16:9)"
                          >
                            <RectangleHorizontal className="h-4 w-4" />
                          </TabsTrigger>
                          <TabsTrigger
                            value="9:16"
                            className="px-2 py-1"
                            title="Portrait (9:16)"
                          >
                            <RectangleVertical className="h-4 w-4" />
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                      {ratio === "9:16" && (
                        <Button
                          variant={zoomPortrait ? "default" : "outline"}
                          size="icon-xs"
                          onClick={() =>
                            handleZoomPortraitChange(!zoomPortrait)
                          }
                        >
                          {zoomPortrait ? (
                            <ZoomIn className="h-3.5 w-3.5" />
                          ) : (
                            <ZoomOut className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                      {ratio === "9:16" && isVideoLandscape && (
                        <Button
                          variant={faceTrackingEnabled ? "default" : "outline"}
                          size="icon-xs"
                          onClick={() => {
                            setFaceTrackingEnabled((prev) => {
                              if (prev)
                                setSubtitleStyle((s) => ({
                                  ...s,
                                  splitSubtitleMode: "none",
                                }));
                              return !prev;
                            });
                          }}
                        >
                          <ScanFace className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {!bgRemovalReady &&
                        !isBgModelLoading &&
                        !isBgProcessing && (
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={handleRemoveBackground}
                            className="text-[11px]"
                          >
                            <Eraser className="h-3 w-3" />
                            Remove BG
                          </Button>
                        )}
                      {(isBgModelLoading || isBgProcessing) && (
                        <Button
                          variant="destructive"
                          size="xs"
                          onClick={handleCancelBgRemoval}
                          className="text-[11px]"
                        >
                          <Loader2 className="h-3 w-3 animate-spin" />
                          {Math.round(bgProgress)}% · Cancel
                        </Button>
                      )}
                      {bgRemovalReady && (
                        <Button
                          variant={
                            subtitleStyle.backgroundRemovalEnabled
                              ? "default"
                              : "outline"
                          }
                          size="xs"
                          onClick={() =>
                            setSubtitleStyle((prev) => ({
                              ...prev,
                              backgroundRemovalEnabled:
                                !prev.backgroundRemovalEnabled,
                            }))
                          }
                          className="text-[11px]"
                        >
                          <Eraser className="h-3 w-3" />
                          {subtitleStyle.backgroundRemovalEnabled
                            ? "BG On"
                            : "BG Off"}
                        </Button>
                      )}
                      {status === "ready" && (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={handleChangeLanguage}
                          className="text-[11px]"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Resub
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                {/* Slim bg-removal progress bar — mobile */}
                {(isBgModelLoading || isBgProcessing) && (
                  <div className="lg:hidden w-full h-1 bg-muted overflow-hidden shrink-0">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{
                        width: `${Math.max(0, Math.min(100, bgProgress))}%`,
                      }}
                    />
                  </div>
                )}
                {/* Video Upload Component */}
                <div className="relative bg-black lg:bg-transparent rounded-lg lg:rounded-none overflow-hidden shrink-0">
                  <VideoUpload
                    key={uploadKey}
                    className="w-full"
                    onVideoSelect={handleVideoSelect}
                    onAspectRatioDetected={handleAspectRatioDetected}
                    ref={videoRef}
                    onTimeUpdate={handleTimeUpdate}
                    transcript={result}
                    currentTime={currentTime}
                    subtitleStyle={subtitleStyle}
                    mode={mode}
                    ratio={ratio}
                    zoomPortrait={zoomPortrait}
                    initialFile={initialFile}
                    bgRemovalReady={bgRemovalReady}
                    getMaskAtTime={getMaskAtTime}
                    getCenterX={getCenterX}
                    isFaceTrackingActive={isFaceTrackingActive}
                  />
                  {/* Desktop: full overlay popover on video */}
                  {selectedWordInfo && selectedWordTimestamp && (
                    <WordStylePopover
                      key={`desktop-${selectedWordTimestamp[0]}-${selectedWordTimestamp[1]}`}
                      wordText={selectedWordInfo.text}
                      override={selectedWordInfo.override}
                      onChange={handleWordStyleChange}
                      onReset={handleWordStyleReset}
                      onClose={handleWordStyleClose}
                      className="hidden lg:block absolute z-50 top-2 right-2"
                    />
                  )}
                  {/* Mobile: compact overlay popover on video */}
                  {selectedWordInfo && selectedWordTimestamp && (
                    <WordStylePopover
                      key={`mobile-${selectedWordTimestamp[0]}-${selectedWordTimestamp[1]}`}
                      wordText={selectedWordInfo.text}
                      override={selectedWordInfo.override}
                      onChange={handleWordStyleChange}
                      onReset={handleWordStyleReset}
                      onClose={handleWordStyleClose}
                      className="lg:hidden absolute z-50 top-2 left-2 right-2"
                      compact
                    />
                  )}
                </div>

                {/* Word chip bar for per-word editing in phrase mode */}
                {mode === "phrase" && (
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 px-2 min-h-[28px]">
                    {currentPhraseWords.length > 0 && (
                      <>
                        <span className="text-xs text-muted-foreground mr-1 font-medium">
                          Edit word:
                        </span>
                        {currentPhraseWords.map((word, i) => {
                          const isSelected =
                            selectedWordTimestamp &&
                            word.timestamp[0] === selectedWordTimestamp[0] &&
                            word.timestamp[1] === selectedWordTimestamp[1];
                          const hasOverride = result?.chunks.find(
                            (c) =>
                              c.timestamp[0] === word.timestamp[0] &&
                              c.timestamp[1] === word.timestamp[1],
                          )?.styleOverride;
                          return (
                            <Button
                              key={`${word.timestamp[0]}-${i}`}
                              size="xs"
                              variant={
                                isSelected
                                  ? "default"
                                  : hasOverride
                                    ? "outline"
                                    : "default"
                              }
                              onClick={() => handleWordSelect(word.timestamp)}
                              className={
                                isSelected
                                  ? "bg-amber-500 text-white border-amber-500 shadow-sm hover:bg-amber-600"
                                  : hasOverride
                                    ? "bg-amber-100 border-amber-400 text-amber-900 hover:bg-amber-200"
                                    : ""
                              }
                            >
                              {word.text}
                            </Button>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}

                {result && (
                  <div className="mt-2 lg:mt-3 flex flex-col items-center gap-2 lg:gap-3 shrink-0">
                    {/* Aspect Ratio + Zoom Controls — desktop only (mobile is overlaid on video) */}
                    <div className="hidden lg:flex items-center gap-3">
                      <Tabs value={ratio} onValueChange={handleRatioChange}>
                        <TabsList className="grid w-auto grid-cols-2">
                          <TabsTrigger
                            value="16:9"
                            className="gap-1.5 px-4"
                            title="Landscape (16:9)"
                          >
                            <RectangleHorizontal className="h-4 w-4" />
                            Landscape
                          </TabsTrigger>
                          <TabsTrigger
                            value="9:16"
                            className="gap-1.5 px-4"
                            title="Portrait (9:16)"
                          >
                            <RectangleVertical className="h-4 w-4" />
                            Portrait
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                      {ratio === "9:16" && (
                        <Button
                          variant={zoomPortrait ? "default" : "outline"}
                          size="sm"
                          onClick={() =>
                            handleZoomPortraitChange(!zoomPortrait)
                          }
                          className="flex items-center gap-2"
                        >
                          {zoomPortrait ? (
                            <ZoomIn className="h-4 w-4" />
                          ) : (
                            <ZoomOut className="h-4 w-4" />
                          )}
                          {zoomPortrait ? "Zoom" : "Fit"}
                        </Button>
                      )}
                    </div>
                    <div className="hidden lg:flex">
                      {ratio === "9:16" && isVideoLandscape && (
                        <Button
                          variant={faceTrackingEnabled ? "default" : "outline"}
                          size="sm"
                          onClick={() => {
                            setFaceTrackingEnabled((prev) => {
                              if (prev) {
                                setSubtitleStyle((s) => ({
                                  ...s,
                                  splitSubtitleMode: "none",
                                }));
                              }
                              return !prev;
                            });
                          }}
                          className="flex items-center gap-2"
                        >
                          <ScanFace className="h-4 w-4" />
                          {faceTrackingEnabled
                            ? "Person tracking on"
                            : "Person tracking off"}
                        </Button>
                      )}
                    </div>

                    {/* Background Removal — desktop only */}
                    <div className="hidden lg:flex flex-col items-center gap-3">
                      {!bgRemovalReady && (
                        <Button
                          onClick={handleRemoveBackground}
                          variant="outline"
                          size="sm"
                          disabled={isBgModelLoading || isBgProcessing}
                          className="flex items-center gap-2"
                        >
                          <Eraser className="h-4 w-4" />
                          {isBgModelLoading
                            ? "Loading model..."
                            : isBgProcessing
                              ? "Processing..."
                              : "Remove Background"}
                        </Button>
                      )}
                      {bgRemovalReady &&
                        subtitleStyle.backgroundRemovalEnabled && (
                          <Button
                            onClick={() => {
                              setSubtitleStyle((prev) => ({
                                ...prev,
                                backgroundRemovalEnabled: false,
                              }));
                            }}
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2"
                          >
                            <Eraser className="h-4 w-4" />
                            Disable Background Removal
                          </Button>
                        )}
                      {bgRemovalReady &&
                        !subtitleStyle.backgroundRemovalEnabled && (
                          <Button
                            onClick={() => {
                              setSubtitleStyle((prev) => ({
                                ...prev,
                                backgroundRemovalEnabled: true,
                              }));
                            }}
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2"
                          >
                            <Eraser className="h-4 w-4" />
                            Enable Background Removal
                          </Button>
                        )}
                    </div>
                    {(isBgModelLoading || isBgProcessing) && (
                      <div className="w-full max-w-md space-y-1">
                        <div
                          className="flex justify-between text-xs text-muted-foreground"
                          style={{
                            fontFamily: "var(--font-outfit), sans-serif",
                          }}
                        >
                          <span>
                            {isBgModelLoading
                              ? "Loading model..."
                              : "Processing frames..."}
                          </span>
                          <span>{Math.round(bgProgress)}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.max(0, Math.min(100, bgProgress))}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {isLongVideo && !isDownloadProcessing && (
                      <div
                        className="w-full max-w-md rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 space-y-1"
                        style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                      >
                        <p className="font-semibold">Long video detected</p>
                        <p className="text-amber-700 leading-snug">
                          Encoding in the browser can take a very long time for
                          videos over 30 minutes. Consider exporting subtitles
                          as <strong>SRT</strong> from the transcript panel and
                          using a desktop app (e.g. HandBrake, VLC) to burn them
                          in, or watch the video in any media player that
                          supports .srt files.
                        </p>
                      </div>
                    )}
                    <div
                      className="flex items-center gap-2 w-full max-w-md"
                      style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                    >
                      <Button
                        onClick={downloadVideo}
                        className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/80 shadow-sm"
                        disabled={isDownloadProcessing}
                      >
                        <Download className="w-4 h-4" />
                        {isDownloadProcessing
                          ? "Processing..."
                          : "Download Video"}
                      </Button>
                      <div className="flex shrink-0" data-slot="button-group">
                        {(["medium", "high"] as const).map((q) => (
                          <Button
                            key={q}
                            variant={
                              exportQuality === q ? "default" : "outline"
                            }
                            size="xs"
                            onClick={() => setExportQuality(q)}
                            disabled={isDownloadProcessing}
                            className="text-xs font-semibold"
                          >
                            {q === "medium" ? "MD" : "HQ"}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {isDownloadProcessing && (
                      <div className="w-full max-w-md space-y-2">
                        <div
                          className="flex justify-between text-xs text-muted-foreground"
                          style={{
                            fontFamily: "var(--font-outfit), sans-serif",
                          }}
                        >
                          <span>{downloadStatus}</span>
                          <span>{Math.round(downloadProgress)}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-sky-500 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.max(0, Math.min(100, downloadProgress))}%`,
                            }}
                          />
                        </div>
                        {/* FOR DEBUGGING PURPOSES ONLY */}
                        {/* {exportDiagnostics && (
                          <div
                            className="hidden lg:block rounded-lg border border-border bg-muted px-3 py-2 text-[11px] text-muted-foreground space-y-1"
                            style={{
                              fontFamily: "var(--font-outfit), sans-serif",
                            }}
                          >
                            <div className="font-semibold text-foreground">
                              Export diagnostics
                            </div>
                            <div>
                              Codec:{" "}
                              {exportDiagnostics.resolvedCodecString ??
                                exportDiagnostics.encoderCodec ??
                                exportDiagnostics.requestedCodec ??
                                "pending"}
                            </div>
                            <div>
                              MIME: {exportDiagnostics.mimeType ?? "pending"}
                            </div>
                            <div>
                              Source:{" "}
                              {exportDiagnostics.sourceCodec ?? "unknown"} /{" "}
                              {exportDiagnostics.sourceIsHevc
                                ? "HEVC"
                                : "non-HEVC"}{" "}
                              /{" "}
                              {exportDiagnostics.sourceCanDecode === undefined
                                ? "decode unknown"
                                : exportDiagnostics.sourceCanDecode
                                  ? "decodable"
                                  : "not decodable"}
                            </div>
                            <div>
                              Output: {exportDiagnostics.width}×
                              {exportDiagnostics.height} @{" "}
                              {exportDiagnostics.frameRate}fps
                            </div>
                            <div>
                              Bitrate: {String(exportDiagnostics.bitrate)}
                            </div>
                            <div>
                              Mode: {exportDiagnostics.format} /{" "}
                              {exportDiagnostics.quality} /{" "}
                              {exportDiagnostics.ratio} /{" "}
                              {exportDiagnostics.isMobile
                                ? "mobile"
                                : "desktop"}
                            </div>
                            {(exportDiagnostics.bitrateMode ??
                              exportDiagnostics.latencyMode) && (
                              <div>
                                Encoder:{" "}
                                {[
                                  exportDiagnostics.bitrateMode,
                                  exportDiagnostics.latencyMode,
                                ]
                                  .filter(Boolean)
                                  .join(" / ")}
                              </div>
                            )}
                          </div>
                        )} */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full rounded-lg border-border text-foreground font-semibold"
                          style={{
                            fontFamily: "var(--font-outfit), sans-serif",
                          }}
                          onClick={cancelDownload}
                        >
                          Stop download
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Mobile: inline Styling / Edit tabs — fills remaining viewport */}
                {result && (
                  <div className="lg:hidden flex-1 min-h-0 flex flex-col mt-2">
                    <div className="flex items-center gap-1 shrink-0 px-1">
                      <Tabs
                        value={mobileTab}
                        onValueChange={(v) =>
                          setMobileTab(v as "styling" | "edit")
                        }
                        className="flex-1"
                      >
                        <TabsList className="grid w-full grid-cols-2 h-9 bg-primary/10">
                          <TabsTrigger
                            value="styling"
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold text-sm"
                          >
                            <Settings className="h-3.5 w-3.5 mr-1.5" />
                            Styling
                          </TabsTrigger>
                          <TabsTrigger
                            value="edit"
                            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold text-sm"
                          >
                            <FileText className="h-3.5 w-3.5 mr-1.5" />
                            Edit
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                      <Button
                        variant="outline"
                        size="icon-xs"
                        onClick={() => setShowExpandedSheet(true)}
                        title="Expand"
                        className="shrink-0"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex-1 min-h-0 relative mt-1">
                      {/* Top shadow — visible when scrolled down */}
                      <div
                        className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-b from-black/10 to-transparent pointer-events-none z-10 opacity-0 transition-opacity"
                        id="mobile-scroll-top-shadow"
                      />
                      <div
                        className="h-full overflow-y-auto overscroll-contain"
                        onScroll={(e) => {
                          const el = e.currentTarget;
                          const topShadow = document.getElementById(
                            "mobile-scroll-top-shadow",
                          );
                          const bottomShadow = document.getElementById(
                            "mobile-scroll-bottom-shadow",
                          );
                          if (topShadow)
                            topShadow.style.opacity =
                              el.scrollTop > 4 ? "1" : "0";
                          if (bottomShadow)
                            bottomShadow.style.opacity =
                              el.scrollHeight - el.scrollTop - el.clientHeight >
                              4
                                ? "1"
                                : "0";
                        }}
                      >
                        {mobileTab === "styling" && (
                          <SubtitleStyling
                            style={subtitleStyle}
                            onChange={setSubtitleStyle}
                            mode={mode}
                            onModeChange={handleModeChange}
                            bgRemovalReady={bgRemovalReady}
                            ratio={ratio}
                          />
                        )}
                        {mobileTab === "edit" && (
                          <TranscriptSidebar
                            transcript={result}
                            currentTime={currentTime}
                            setCurrentTime={(time) => {
                              if (videoRef.current) {
                                videoRef.current.currentTime = time;
                                setCurrentTime(time);
                              }
                            }}
                            onTranscriptUpdate={(updatedTranscript) => {
                              setResult((prev) =>
                                prev
                                  ? { ...prev, ...updatedTranscript }
                                  : updatedTranscript,
                              );
                            }}
                            mode={mode}
                            maxWordsPerLine={subtitleStyle.maxWordsPerLine}
                            dynamicEnabled={subtitleStyle.dynamicEnabled}
                            videoFileName={uploadedFile?.name}
                          />
                        )}
                      </div>
                      {/* Bottom shadow — visible when more content below */}
                      <div
                        className="absolute bottom-0 left-0 right-0 h-3 bg-gradient-to-t from-black/10 to-transparent pointer-events-none z-10 transition-opacity"
                        id="mobile-scroll-bottom-shadow"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Transcript Sidebar - Hidden on mobile, shown on desktop */}
              {result && (
                <div className="hidden lg:flex lg:flex-col w-full lg:w-96 h-[calc(100vh-11rem-20px)]">
                  <div
                    className={`flex-1 min-h-0 flex flex-col w-full border border-border bg-background shadow-lg ${isTranscribingBanner || result?.generationTime ? "rounded-t-2xl" : "rounded-2xl"}`}
                  >
                    <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
                      <h4
                        className="text-base font-semibold text-foreground"
                        style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                      >
                        Edit Transcript
                      </h4>
                      <p
                        className="text-xs text-muted-foreground mt-0.5"
                        style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                      >
                        Click on any segment to edit the text
                      </p>
                    </div>
                    <TranscriptSidebar
                      className="flex-1 min-h-0"
                      transcript={result}
                      currentTime={currentTime}
                      setCurrentTime={(time) => {
                        if (videoRef.current) {
                          videoRef.current.currentTime = time;
                          setCurrentTime(time);
                        }
                      }}
                      onTranscriptUpdate={(updatedTranscript) => {
                        setResult((prev) =>
                          prev
                            ? { ...prev, ...updatedTranscript }
                            : updatedTranscript,
                        );
                      }}
                      mode={mode}
                      maxWordsPerLine={subtitleStyle.maxWordsPerLine}
                      dynamicEnabled={subtitleStyle.dynamicEnabled}
                      videoFileName={uploadedFile?.name}
                    />
                  </div>
                  {(isTranscribingBanner || result?.generationTime) && (
                    <div className="rounded-b-2xl border border-t-0 border-amber-200 bg-amber-50 shadow-lg px-4 py-3 flex flex-col gap-2 shrink-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isTranscribingBanner ? (
                            <Loader2 className="h-4 w-4 animate-spin text-amber-600 shrink-0" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                          )}
                          <span
                            className="text-sm text-amber-800 font-semibold"
                            style={{
                              fontFamily: "var(--font-outfit), sans-serif",
                            }}
                          >
                            {isTranscribingBanner ? (
                              <>
                                Transcribing
                                {latestTranscribedTime !== null
                                  ? ` ${formatTime(latestTranscribedTime)}`
                                  : ""}{" "}
                                · {Math.round(progress)}%
                              </>
                            ) : (
                              <>
                                Done in{" "}
                                {(() => {
                                  const s = Math.round(
                                    (result.generationTime ?? 0) / 1000,
                                  );
                                  const m = Math.floor(s / 60);
                                  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
                                })()}
                              </>
                            )}
                          </span>
                        </div>
                        <span
                          className={`text-xs font-medium ${device === "webgpu" ? "text-green-600" : "text-muted-foreground"}`}
                          style={{
                            fontFamily: "var(--font-outfit), sans-serif",
                          }}
                        >
                          {device === "webgpu" ? "WebGPU" : "CPU"}
                        </span>
                      </div>
                      {isTranscribingBanner && (
                        <div className="w-full bg-amber-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-amber-500 h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Expanded settings/edit sheet — mobile */}
      {result && (
        <Sheet open={showExpandedSheet} onOpenChange={setShowExpandedSheet}>
          <SheetContent
            side="bottom"
            className="lg:hidden max-h-[85dvh] rounded-t-2xl p-0 gap-0 overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b shrink-0">
              <Tabs
                value={mobileTab}
                onValueChange={(v) => setMobileTab(v as "styling" | "edit")}
                className="flex-1"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="styling">
                    <Settings className="h-3.5 w-3.5 mr-1.5" />
                    Styling
                  </TabsTrigger>
                  <TabsTrigger value="edit">
                    <FileText className="h-3.5 w-3.5 mr-1.5" />
                    Edit
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <SheetTitle className="sr-only">
              {mobileTab === "styling" ? "Subtitle Styling" : "Edit Transcript"}
            </SheetTitle>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4">
              {mobileTab === "styling" && (
                <SubtitleStyling
                  style={subtitleStyle}
                  onChange={setSubtitleStyle}
                  mode={mode}
                  onModeChange={handleModeChange}
                  bgRemovalReady={bgRemovalReady}
                  ratio={ratio}
                />
              )}
              {mobileTab === "edit" && (
                <TranscriptSidebar
                  transcript={result}
                  currentTime={currentTime}
                  setCurrentTime={(time) => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = time;
                      setCurrentTime(time);
                    }
                  }}
                  onTranscriptUpdate={(updatedTranscript) => {
                    setResult((prev) =>
                      prev
                        ? { ...prev, ...updatedTranscript }
                        : updatedTranscript,
                    );
                  }}
                  mode={mode}
                  maxWordsPerLine={subtitleStyle.maxWordsPerLine}
                  dynamicEnabled={subtitleStyle.dynamicEnabled}
                  videoFileName={uploadedFile?.name}
                />
              )}
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Confirm: background removal on long video */}
      <AlertDialog open={showBgConfirm} onOpenChange={setShowBgConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Long video</AlertDialogTitle>
            <AlertDialogDescription>
              This video is {Math.round((videoRef.current?.duration || 0) / 60)}{" "}
              minutes long. Background removal can take a while on longer
              videos. Do you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => startBgRemoval()}>
              Proceed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm: upload new / reset */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start over?</AlertDialogTitle>
            <AlertDialogDescription>
              Your current subtitles and styling will be lost. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleResetVideo}>
              Upload New
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* About Sheet — mobile */}
      <Sheet open={showAboutSheet} onOpenChange={setShowAboutSheet}>
        <SheetContent side="bottom" className="lg:hidden rounded-t-2xl">
          <SheetHeader className="pb-2">
            <SheetTitle
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              Based Subtitles
            </SheetTitle>
            <SheetDescription
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              100% local subtitle generation powered by transformers.js
            </SheetDescription>
          </SheetHeader>
          <div
            className="px-4 pb-6 space-y-3"
            style={{ fontFamily: "var(--font-outfit), sans-serif" }}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Built by
              </span>
              <a
                href="https://x.com/deifosv"
                className="text-xs font-bold uppercase tracking-widest text-foreground hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Vlad
              </a>
              <span className="text-muted-foreground/40">&middot;</span>
              <a
                href="/changelog"
                className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                v{APP_VERSION}
              </a>
              <span className="text-muted-foreground/40">&middot;</span>
              <a
                href="https://github.com/deifos/basedsubtitles"
                className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Powered by
              </span>
              <a
                href="https://huggingface.co/docs/transformers.js"
                className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
                target="_blank"
                rel="noopener noreferrer"
              >
                Transformers.js
              </a>
              <span className="text-muted-foreground/40">&middot;</span>
              <a
                href="https://github.com/Vanilagy/mediabunny"
                className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
                target="_blank"
                rel="noopener noreferrer"
              >
                MediaBunny
              </a>
            </div>
            <a
              href="https://getbasedapps.com"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 border-2 border-foreground bg-foreground text-background text-[10px] font-bold uppercase tracking-wider hover:bg-background hover:text-foreground transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              getbasedapps
            </a>
          </div>
        </SheetContent>
      </Sheet>

      {/* Processing Overlay — blocks UI during model load and audio extraction.
          Hidden once the first transcription chunk arrives (result != null). */}
      <ProcessingOverlay
        isVisible={isBlockingOverlay}
        statusMessage={statusMessage}
        progress={progress}
        canCancel={status !== "idle" && status !== "ready"}
        onCancel={cancelTranscription}
      />

      <div className="hidden lg:block">
        <SiteFooter />
      </div>
      <div className={result ? "hidden lg:block" : ""}>
        <BuyMeCoffee />
      </div>
    </main>
  );
}
