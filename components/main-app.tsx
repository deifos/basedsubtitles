"use client";

import type { JSX } from "react";
import { useRef, useState, useCallback } from "react";
import { SiteFooter } from "@/components/site-footer";
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
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProcessingOverlay } from "@/components/processing-overlay";
import { useTranscription, STATUS_MESSAGES } from "@/hooks/useTranscription";
import { useVideoDownloadMediaBunny } from "@/hooks/useVideoDownloadMediaBunny";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface MainAppProps {
  initialFile?: File | null;
  onReturnToLanding?: () => void;
}

// Default subtitle style
const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontFamily: "Arial, sans-serif",
  fontSize: 20,
  fontWeight: "900",
  color: "#CCCCCC", // Silver metallic color
  backgroundColor: "transparent", // No background
  borderWidth: 2,
  borderColor: "#000000", // Black border
  dropShadowIntensity: 0.9, // Default shadow intensity
  wordEmphasisEnabled: true,
};

export function MainApp({ initialFile = null, onReturnToLanding }: MainAppProps): JSX.Element {
  const [currentTime, setCurrentTime] = useState(0);
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>(
    DEFAULT_SUBTITLE_STYLE
  );
  const [uploadKey, setUploadKey] = useState(0);
  const [mode, setMode] = useState<"word" | "phrase">("word");
  const [ratio, setRatio] = useState<"16:9" | "9:16">("16:9");
  const [zoomPortrait, setZoomPortrait] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const {
    status,
    error,
    result,
    progress,
    setResult,
    handleVideoSelect,
    resetTranscription,
    cancelTranscription,
  } = useTranscription();

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
  });

  // Memoized handlers for better performance
  const handleResetVideo = useCallback(() => {
    // Reset transcription state
    resetTranscription();

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
  }, [resetTranscription]);

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleModeChange = useCallback((value: string) => {
    setMode(value as "word" | "phrase");
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

  // Determine if we should show the loading overlay
  const isProcessing =
    status !== "idle" && (status !== "ready" || (progress > 0 && progress < 100));
  const statusMessage = STATUS_MESSAGES[status] ?? "Processing video...";

  return (
    <main className="flex min-h-screen flex-col relative">
      {/* Header */}
      <header className="w-full py-6 border-b border-border/20">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Based Subtitles</h1>
          <p className="text-muted-foreground text-lg">100% local powered by transformers.js</p>
        </div>
      </header>

      {/* App Section */}
      <section className="flex-1 flex items-center justify-center w-full py-8">
        <div className="mx-auto px-4 md:px-6 w-full">
          <div className="w-full mx-auto space-y-4 p-6 md:p-8 rounded-xl border border-border/50">
            {/* Single Row - 3 Columns Layout */}
            <div className="grid grid-cols-3 items-center gap-4">
              {/* Column 1: Upload Text */}
              <div className="justify-self-start">
                <p className="text-muted-foreground">
                  Upload a video (MP4 or WebM) to generate subtitles
                </p>
              </div>

              {/* Column 2: Controls (Center) */}
              <div className="justify-self-center">
                {result && (
                  <div className="flex flex-col gap-3 items-center">
                    {/* Tab Controls */}
                    <div className="flex flex-col gap-2 items-center">
                      <Tabs
                        value={mode}
                        onValueChange={handleModeChange}
                      >
                        <TabsList className="grid w-[280px] sm:w-[320px] grid-cols-2">
                          <TabsTrigger value="word">Word by Word</TabsTrigger>
                          <TabsTrigger value="phrase">Phrases</TabsTrigger>
                        </TabsList>
                      </Tabs>
                      
                      <Tabs
                        value={ratio}
                        onValueChange={handleRatioChange}
                      >
                        <TabsList className="grid w-[280px] sm:w-[320px] grid-cols-2">
                          <TabsTrigger value="16:9">Landscape (16:9)</TabsTrigger>
                          <TabsTrigger value="9:16">Portrait (9:16)</TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                    
                    {/* Portrait Zoom Control - Below the tabs */}
                    {ratio === "9:16" && (
                      <Button
                        variant={zoomPortrait ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleZoomPortraitChange(!zoomPortrait)}
                        className="flex items-center gap-2"
                      >
                        {zoomPortrait ? <ZoomOut className="h-4 w-4" /> : <ZoomIn className="h-4 w-4" />}
                        {zoomPortrait ? "Fit to Container" : "Crop/Zoom"}
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Column 3: Upload Button */}
              <div className="justify-self-end">
                {result && (
                  <Button
                    onClick={handleResetVideo}
                    className="flex items-center gap-2 px-4 py-2"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Another Video
                  </Button>
                )}
              </div>
            </div>

            {!result && (
              <Alert className="">
                <Video className="h-4 w-4 text-primary" />
                <AlertDescription>
                  Supported formats: MP4 and WebM. Maximum video length: 5
                  minutes.
                </AlertDescription>
              </Alert>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col lg:flex-row gap-6">
              {/* Subtitle Styling Column - Only show when we have a result */}
              {result && (
                <div className="w-full lg:w-96 h-[620px]">
                  <ScrollArea className="rounded-base h-[620px] w-full text-mtext border-2 border-border bg-main p-2 shadow-shadow">
                    <div className="p-2">
                      <SubtitleStyling
                        style={subtitleStyle}
                        onChange={setSubtitleStyle}
                      />
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Video Column */}
              <div className="flex-1 flex flex-col">
                {/* Video Upload Component */}
                <VideoUpload
                  key={uploadKey}
                  className="w-full"
                  onVideoSelect={handleVideoSelect}
                  ref={videoRef}
                  onTimeUpdate={handleTimeUpdate}
                  transcript={result}
                  currentTime={currentTime}
                  subtitleStyle={subtitleStyle}
                  mode={mode}
                  ratio={ratio}
                  zoomPortrait={zoomPortrait}
                  initialFile={initialFile}
                />

                {result && (
                  <div className="mt-4 flex flex-col items-center gap-3">
                    <Button
                      onClick={downloadVideo}
                      className="flex items-center gap-2"
                      disabled={isDownloadProcessing}
                    >
                      <Download className="w-4 h-4" />
                      {isDownloadProcessing ? 'Processing...' : 'Download Video with Subtitles'}
                    </Button>

                    {isDownloadProcessing && (
                      <div className="w-full max-w-md space-y-3">
                        <div className="flex justify-between text-sm text-muted-foreground">
                          <span>{downloadStatus}</span>
                          <span>{Math.round(downloadProgress)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(0, Math.min(100, downloadProgress))}%` }}
                          ></div>
                        </div>
                        <Button variant="default" size="sm" className="w-full" onClick={cancelDownload}>
                          Stop download
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Transcript Column */}
              {result && (
                <div className="w-full lg:w-96 h-[620px]">
                  <ScrollArea className="rounded-base h-[620px] w-full text-mtext border-2 border-border bg-main p-4 shadow-shadow">
                    <div className="mb-4 pb-2 border-b border-border">
                      <h4 className="text-lg font-semibold">
                        Edit Transcript
                      </h4>
                      <p className="text-sm text-muted-foreground">
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
                        setResult(updatedTranscript);
                      }}
                      mode={mode}
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

      <SiteFooter />
    </main>
  );
}