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
} from "lucide-react";
import { TranscriptSidebar } from "@/components/transcript-sidebar";
import {
  SubtitleStyling,
  SubtitleStyle,
} from "@/components/subtitle-styling";
import { WordStylePopover } from "@/components/word-style-popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { processTranscriptChunks, type WordStyleOverride } from "@/lib/utils";
import { ProcessingOverlay } from "@/components/processing-overlay";
import { useTranscription, STATUS_MESSAGES, type TranscriptionResult, type ModelSize } from "@/hooks/useTranscription";
import { useVideoDownloadMediaBunny } from "@/hooks/useVideoDownloadMediaBunny";
import { useBackgroundRemoval } from "@/hooks/useBackgroundRemoval";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type LanguageCode } from "@/components/language-selector";
import { LanguageSelectionModal } from "@/components/language-selection-modal";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Settings, FileText, Eraser } from "lucide-react";
import { toast } from "sonner";

interface MainAppProps {
  initialFile?: File | null;
  onReturnToLanding?: () => void;
}

// Default subtitle style - Gold preset
const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontFamily: "var(--font-bangers), 'Bangers', cursive",
  fontSize: 16,
  fontWeight: "600",
  color: "#F4D35E",
  backgroundColor: "#1F1300",
  borderWidth: 0,
  borderColor: "#000000",
  dropShadowIntensity: 0.4,
  wordEmphasisEnabled: false,
  position: "bottom",
  maxWordsPerLine: 6,
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
};

export function MainApp({ initialFile = null, onReturnToLanding }: MainAppProps): JSX.Element {
  const [currentTime, setCurrentTime] = useState(0);
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(
    DEFAULT_SUBTITLE_STYLE
  );
  const [uploadKey, setUploadKey] = useState(0);
  const [mode, setMode] = useState<"word" | "phrase">("phrase");
  const [ratio, setRatio] = useState<"16:9" | "9:16">("16:9");
  const [zoomPortrait, setZoomPortrait] = useState(false);
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [modelSize, setModelSize] = useState<ModelSize>("base");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showStylingDrawer, setShowStylingDrawer] = useState(false);
  const [showEditingDrawer, setShowEditingDrawer] = useState(false);
  const [selectedWordTimestamp, setSelectedWordTimestamp] = useState<[number, number] | null>(null);
  const previousResultRef = useRef<TranscriptionResult | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

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

  const handleVideoSelect = useCallback(
    (file: File) => {
      setUploadedFile(file);
      handleVideoSelectBase(file);
      // Show language selection modal after video loads
      setShowLanguageModal(true);
    },
    [handleVideoSelectBase]
  );

  const handleAspectRatioDetected = useCallback((detectedRatio: "16:9" | "9:16") => {
    setRatio(detectedRatio);
    // Reset zoom when aspect ratio changes
    if (detectedRatio === "16:9") {
      setZoomPortrait(false);
    }
  }, []);

  const handleLanguageConfirm = useCallback((selectedLanguage: LanguageCode, selectedModelSize: ModelSize) => {
    setLanguage(selectedLanguage);
    setModelSize(selectedModelSize);
    if (uploadedFile) {
      startTranscription(uploadedFile, selectedLanguage, selectedModelSize);
    }
    // Don't close modal here - let useEffect handle it when status changes
  }, [uploadedFile, startTranscription]);

  const handleChangeLanguage = useCallback(() => {
    // Store current result before clearing
    previousResultRef.current = result;
    // Clear current result and show language modal again
    setResult(null);
    setShowLanguageModal(true);
  }, [result, setResult]);

  // Auto-close modal when transcription actually starts (not during model loading)
  useEffect(() => {
    if (showLanguageModal && (status === 'processing' || status === 'extracting' || status === 'transcribing')) {
      setShowLanguageModal(false);
    }
  }, [status, showLanguageModal]);

  const {
    downloadVideo,
    cancelDownload,
    isProcessing: isDownloadProcessing,
    progress: downloadProgress,
    status: downloadStatus,
  } = useVideoDownloadMediaBunny({
    video: videoRef.current,
    transcriptChunks: result?.chunks || [],
    subtitleStyle,
    mode,
    format: 'mp4',
    quality: 'high',
    fps: 30,
    bgRemovalReady,
    processFrame: bgProcessFrame,
    getMaskAtTime,
  });

  const handleRemoveBackground = useCallback(async () => {
    if (!videoRef.current) return;
    setSubtitleStyle((prev) => ({ ...prev, backgroundRemovalEnabled: true, dynamicEnabled: true }));
    try {
      await processBgRemoval(videoRef.current);
    } catch {
      toast.error("Background removal failed. This feature requires WebGPU or WASM support, which may not be available on your device.");
    }
  }, [processBgRemoval]);

  // Memoized handlers for better performance
  const handleResetVideo = useCallback(() => {
    // Reset transcription state
    resetTranscription();

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
  }, [resetTranscription, resetBgRemoval, onReturnToLanding]);

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

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleModeChange = useCallback((value: "word" | "phrase") => {
    setMode(value);
  }, []);

  const handleRatioChange = useCallback((value: string) => {
    const newRatio = value as "16:9" | "9:16";
    setRatio(newRatio);
    // Reset zoom when switching to landscape
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
        : timestamp
    );
  }, []);

  const handleWordStyleChange = useCallback((override: WordStyleOverride) => {
    if (!result || !selectedWordTimestamp) return;
    setResult((prev) => {
      if (!prev) return prev;
      const updatedChunks = prev.chunks.map((chunk) => {
        if (
          chunk.timestamp[0] === selectedWordTimestamp[0] &&
          chunk.timestamp[1] === selectedWordTimestamp[1]
        ) {
          return { ...chunk, styleOverride: Object.keys(override).length > 0 ? override : undefined };
        }
        return chunk;
      });
      return { ...prev, chunks: updatedChunks };
    });
  }, [result, selectedWordTimestamp, setResult]);

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
        c.timestamp[1] === selectedWordTimestamp[1]
    );
    if (!chunk) return null;
    return { text: chunk.text, override: chunk.styleOverride ?? {} };
  }, [result, selectedWordTimestamp]);

  // Whether canvas compositing is active (word clicks on video don't work)
  const compositingActive = subtitleStyle.dynamicEnabled ||
    (bgRemovalReady && subtitleStyle.backgroundRemovalEnabled);

  // Get current phrase words for the word chip bar (shown when compositing is active)
  const currentPhraseWords = useMemo(() => {
    if (!result || mode !== "phrase" || !compositingActive) return [];
    const chunks = processTranscriptChunks(result, "phrase", subtitleStyle.maxWordsPerLine, subtitleStyle.dynamicEnabled);
    const activeChunk = chunks.find(
      (c) => currentTime >= c.timestamp[0] && currentTime <= c.timestamp[1]
    );
    if (!activeChunk?.words) return [];
    return activeChunk.words.filter(w => {
      const original = result.chunks.find(
        oc => oc.timestamp[0] === w.timestamp[0] && oc.timestamp[1] === w.timestamp[1]
      );
      return !original?.disabled && !original?.subtitleHidden;
    });
  }, [result, mode, compositingActive, subtitleStyle.maxWordsPerLine, subtitleStyle.dynamicEnabled, currentTime]);

  // Determine if we should show the loading overlay
  // Don't show overlay when status is 'ready' and we're just waiting for user to transcribe
  const isProcessing =
    status !== "idle" && status !== "ready" && progress < 100;
  const statusMessage = STATUS_MESSAGES[status] ?? "Processing video...";

  return (
    <main className="flex min-h-screen flex-col relative pb-16 lg:pb-0 bg-white">
      {/* Header */}
      <header className="w-full border-b-2 border-black/10 bg-white">
        <div className="container mx-auto px-4 md:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold tracking-tight text-white">
              BS
            </div>
            <div className="text-left">
              <h1
                className="text-lg font-bold text-slate-900 leading-tight"
                style={{ fontFamily: "var(--font-outfit), sans-serif" }}
              >
                Based Subtitles
              </h1>
              <p
                className="text-xs text-slate-400"
                style={{ fontFamily: "var(--font-outfit), sans-serif" }}
              >
                100% local &middot; powered by transformers.js
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {uploadedFile && !result && (
              <Button
                onClick={() => setShowLanguageModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 shadow-sm"
                style={{ fontFamily: "var(--font-outfit), sans-serif" }}
              >
                <Video className="w-4 h-4" />
                Transcribe Video
              </Button>
            )}
            {result && (
              <>
                <Button
                  onClick={handleChangeLanguage}
                  variant="outline"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
                  style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                >
                  <Video className="w-4 h-4" />
                  Change Language
                </Button>
                <Button
                  onClick={handleResetVideo}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 shadow-sm"
                  style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                >
                  <Upload className="w-4 h-4" />
                  Upload Another
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* App Section */}
      <section className="flex-1 flex items-center justify-center w-full py-4">
        <div className="mx-auto px-4 md:px-6 w-full">
          <div className="w-full mx-auto space-y-4 p-4 md:p-6 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            {!result && (
              <>
                <div className="text-center">
                  <p
                    className="text-slate-500 text-sm"
                    style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                  >
                    Upload a video (MP4 or WebM) to generate subtitles
                  </p>
                </div>
                <Alert>
                  <Video className="h-4 w-4 text-slate-600" />
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

            {/* Mobile Drawers */}
            {result && (
              <>
                <Sheet open={showStylingDrawer} onOpenChange={setShowStylingDrawer} modal={false}>
                  <SheetContent side="left" className="w-full sm:w-96 p-0 gap-0" overlay={false}>
                    <SheetHeader className="p-4 border-b shrink-0">
                      <SheetTitle>Subtitle Styling</SheetTitle>
                    </SheetHeader>
                    <div className="flex-1 min-h-0 overflow-hidden">
                      <ScrollArea className="h-full">
                        <div className="p-4 pb-20">
                          <SubtitleStyling
                            style={subtitleStyle}
                            onChange={setSubtitleStyle}
                            mode={mode}
                            onModeChange={handleModeChange}
                            bgRemovalReady={bgRemovalReady}
                          />
                        </div>
                      </ScrollArea>
                    </div>
                  </SheetContent>
                </Sheet>

                <Sheet open={showEditingDrawer} onOpenChange={setShowEditingDrawer} modal={false}>
                  <SheetContent side="right" className="w-full sm:w-96 p-0 gap-0" overlay={false}>
                    <SheetHeader className="p-4 border-b shrink-0">
                      <SheetTitle>Edit Transcript</SheetTitle>
                    </SheetHeader>
                    <div className="flex-1 min-h-0 overflow-hidden">
                      <ScrollArea className="h-full">
                        <div className="p-4 pb-20">
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
                              setResult((prev) => prev ? { ...prev, ...updatedTranscript } : updatedTranscript);
                            }}
                            mode={mode}
                            maxWordsPerLine={subtitleStyle.maxWordsPerLine}
                            dynamicEnabled={subtitleStyle.dynamicEnabled}
                          />
                        </div>
                      </ScrollArea>
                    </div>
                  </SheetContent>
                </Sheet>
              </>
            )}

            <div className="flex flex-col lg:flex-row gap-6">
              {/* Subtitle Styling Column - Hidden on mobile, shown on desktop */}
              {result && (
                <div className="hidden lg:block w-full lg:w-96 h-[560px]">
                  <ScrollArea className="rounded-2xl h-[560px] w-full border border-slate-200/80 bg-white p-2 shadow-lg shadow-slate-200/40">
                    <div className="p-2 space-y-4">
                      <SubtitleStyling
                        style={subtitleStyle}
                        onChange={setSubtitleStyle}
                        mode={mode}
                        onModeChange={handleModeChange}
                        bgRemovalReady={bgRemovalReady}
                      />
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Video Column */}
              <div className="flex-1 flex flex-col">
                {/* Video Upload Component */}
                <div className="relative">
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
                  onWordSelect={mode === "phrase" ? handleWordSelect : undefined}
                  selectedWordTimestamp={selectedWordTimestamp}
                />
                {selectedWordInfo && selectedWordTimestamp && (
                  <WordStylePopover
                    key={`${selectedWordTimestamp[0]}-${selectedWordTimestamp[1]}`}
                    wordText={selectedWordInfo.text}
                    override={selectedWordInfo.override}
                    onChange={handleWordStyleChange}
                    onReset={handleWordStyleReset}
                    onClose={handleWordStyleClose}
                  />
                )}
                </div>

                {/* Word chip bar for per-word editing when canvas compositing is active */}
                {compositingActive && mode === "phrase" && (
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5 px-2 min-h-[28px]">
                    {currentPhraseWords.length > 0 && (
                      <>
                        <span className="text-xs text-muted-foreground mr-1">Edit word:</span>
                        {currentPhraseWords.map((word, i) => {
                          const isSelected =
                            selectedWordTimestamp &&
                            word.timestamp[0] === selectedWordTimestamp[0] &&
                            word.timestamp[1] === selectedWordTimestamp[1];
                          const hasOverride = result?.chunks.find(
                            c => c.timestamp[0] === word.timestamp[0] && c.timestamp[1] === word.timestamp[1]
                          )?.styleOverride;
                          return (
                            <button
                              key={`${word.timestamp[0]}-${i}`}
                              onClick={() => handleWordSelect(word.timestamp)}
                              className={`px-2 py-0.5 text-xs rounded-md border transition-colors ${
                                isSelected
                                  ? "bg-amber-500 text-white border-amber-500"
                                  : hasOverride
                                    ? "bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200"
                                    : "bg-muted/50 border-border hover:bg-muted"
                              }`}
                            >
                              {word.text}
                            </button>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}

                {result && (
                  <div className="mt-3 flex flex-col items-center gap-3">
                    {/* Aspect Ratio + Zoom Controls */}
                    <div className="flex items-center gap-3">
                      <Tabs
                        value={ratio}
                        onValueChange={handleRatioChange}
                      >
                        <TabsList className="grid w-[260px] grid-cols-2">
                          <TabsTrigger value="16:9">Landscape (16:9)</TabsTrigger>
                          <TabsTrigger value="9:16">Portrait (9:16)</TabsTrigger>
                        </TabsList>
                      </Tabs>
                      {ratio === "9:16" && (
                        <Button
                          variant={zoomPortrait ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleZoomPortraitChange(!zoomPortrait)}
                          className="flex items-center gap-2"
                        >
                          {zoomPortrait ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
                          {zoomPortrait ? "Fit" : "Zoom"}
                        </Button>
                      )}
                    </div>

                    {/* Background Removal */}
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
                    {bgRemovalReady && subtitleStyle.backgroundRemovalEnabled && (
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
                    {bgRemovalReady && !subtitleStyle.backgroundRemovalEnabled && (
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
                    {(isBgModelLoading || isBgProcessing) && (
                      <div className="w-full max-w-md space-y-1">
                        <div className="flex justify-between text-xs text-slate-500" style={{ fontFamily: "var(--font-outfit), sans-serif" }}>
                          <span>{isBgModelLoading ? "Loading model..." : "Processing frames..."}</span>
                          <span>{Math.round(bgProgress)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(0, Math.min(100, bgProgress))}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {result.generationTime && (
                      <div
                        className="text-xs text-slate-400"
                        style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                      >
                        Generation time: {(result.generationTime / 1000).toFixed(2)}s ({device === "webgpu" ? "WebGPU" : "WASM"})
                      </div>
                    )}
                    <Button
                      onClick={downloadVideo}
                      className="flex items-center gap-2 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 shadow-sm"
                      style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                      disabled={isDownloadProcessing}
                    >
                      <Download className="w-4 h-4" />
                      {isDownloadProcessing ? 'Processing...' : 'Download Video with Subtitles'}
                    </Button>

                    {isDownloadProcessing && (
                      <div className="w-full max-w-md space-y-2">
                        <div className="flex justify-between text-xs text-slate-500" style={{ fontFamily: "var(--font-outfit), sans-serif" }}>
                          <span>{downloadStatus}</span>
                          <span>{Math.round(downloadProgress)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-sky-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(0, Math.min(100, downloadProgress))}%` }}
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full rounded-lg border-slate-200 text-slate-700 font-semibold"
                          style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                          onClick={cancelDownload}
                        >
                          Stop download
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Transcript Sidebar - Hidden on mobile, shown on desktop */}
              {result && (
                <div className="hidden lg:block w-full lg:w-96 h-[560px]">
                  <ScrollArea className="rounded-2xl h-[560px] w-full border border-slate-200/80 bg-white p-4 shadow-lg shadow-slate-200/40">
                    <div className="mb-4 pb-2 border-b border-slate-100">
                      <h4
                        className="text-base font-semibold text-slate-900"
                        style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                      >
                        Edit Transcript
                      </h4>
                      <p
                        className="text-xs text-slate-400 mt-0.5"
                        style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                      >
                        Click on any segment to edit the text
                      </p>
                    </div>
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
                        setResult((prev) => prev ? { ...prev, ...updatedTranscript } : updatedTranscript);
                      }}
                      mode={mode}
                      maxWordsPerLine={subtitleStyle.maxWordsPerLine}
                      dynamicEnabled={subtitleStyle.dynamicEnabled}
                    />
                  </ScrollArea>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Processing Overlay */}
      <ProcessingOverlay
        isVisible={isProcessing}
        statusMessage={statusMessage}
        progress={progress}
        canCancel={status !== "idle" && status !== "ready"}
        onCancel={cancelTranscription}
      />

      {/* Mobile Bottom Navigation - Only show when we have a result */}
      {result && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[100] bg-white border-t-2 border-black/10 shadow-lg">
          <div className="grid grid-cols-2 gap-0">
            <button
              onClick={() => {
                setShowEditingDrawer(false);
                setShowStylingDrawer((prev) => !prev);
              }}
              className={`flex flex-col items-center justify-center py-3 px-4 transition-colors active:bg-slate-100 ${showStylingDrawer ? "bg-slate-100" : "hover:bg-slate-50"}`}
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              <Settings className={`h-5 w-5 mb-1 ${showStylingDrawer ? "text-slate-900" : "text-slate-600"}`} />
              <span className={`text-xs font-semibold ${showStylingDrawer ? "text-slate-900" : "text-slate-700"}`}>Styling</span>
            </button>
            <button
              onClick={() => {
                setShowStylingDrawer(false);
                setShowEditingDrawer((prev) => !prev);
              }}
              className={`flex flex-col items-center justify-center py-3 px-4 transition-colors border-l border-slate-200 active:bg-slate-100 ${showEditingDrawer ? "bg-slate-100" : "hover:bg-slate-50"}`}
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              <FileText className={`h-5 w-5 mb-1 ${showEditingDrawer ? "text-slate-900" : "text-slate-600"}`} />
              <span className={`text-xs font-semibold ${showEditingDrawer ? "text-slate-900" : "text-slate-700"}`}>Edit</span>
            </button>
          </div>
        </div>
      )}

      <SiteFooter />
      <BuyMeCoffee />
    </main>
  );
}
