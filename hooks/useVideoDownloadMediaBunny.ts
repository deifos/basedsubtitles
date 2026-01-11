import { useState, useCallback, useRef } from 'react';
import {
  Input,
  Output,
  CanvasSource,
  AudioBufferSource,
  Mp4OutputFormat,
  WebMOutputFormat,
  BufferTarget,
  BlobSource,
  VideoSampleSink,
  VideoSample,
  ALL_FORMATS,
  QUALITY_HIGH,
  QUALITY_MEDIUM,
  QUALITY_LOW,
  QUALITY_VERY_HIGH,
  Conversion
} from 'mediabunny';
import { SubtitleStyle } from '@/components/subtitle-styling';
import { processTranscriptChunks } from '@/lib/utils';

// Types
interface TranscriptChunk {
  text: string;
  timestamp: [number, number];
  disabled?: boolean;
  words?: WordTiming[];
}

interface UseVideoDownloadMediaBunnyProps {
  video: HTMLVideoElement | null;
  transcriptChunks: TranscriptChunk[];
  subtitleStyle: SubtitleStyle;
  mode: 'word' | 'phrase';
  format?: 'mp4' | 'webm';
  quality?: 'low' | 'medium' | 'high' | 'very_high';
  fps?: number;
}

// Quality mapping
const qualityMap = {
  low: QUALITY_LOW,
  medium: QUALITY_MEDIUM,
  high: QUALITY_HIGH,
  very_high: QUALITY_VERY_HIGH,
} as const;

interface WordTiming {
  text: string;
  timestamp: [number, number];
}

type ProcessedChunk = ReturnType<typeof processTranscriptChunks>[number];

function isPhraseChunk(chunk: ProcessedChunk): chunk is ProcessedChunk & { words: WordTiming[] } {
  return Array.isArray((chunk as { words?: WordTiming[] }).words);
}

const LETTER_SPACING_EM = 0.05;
const HIGHLIGHT_SPACE_EM = 0.35;
const WORD_PADDING_X_EM = 0.15;
const WORD_PADDING_Y_EM = 0.08;
const HIGHLIGHT_RADIUS_EM = 0.35;
const WORD_EMPHASIS_SCALE = 1.18;
const HIGHLIGHT_BG_ALPHA = 0.65;

export function useVideoDownloadMediaBunny({
  video,
  transcriptChunks,
  subtitleStyle,
  mode,
  format = 'mp4',
  quality = 'high',
  fps = 30
}: UseVideoDownloadMediaBunnyProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('');
  const cancelContextRef = useRef<{
    cancelRequested: boolean;
    output: Output | null;
    videoSource: CanvasSource | null;
  }>({ cancelRequested: false, output: null, videoSource: null });

  const downloadVideo = useCallback(async () => {
    if (!video?.src || transcriptChunks.length === 0) {
      console.error('Missing video or transcript data');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setStatus('Initializing MediaBunny...');
    cancelContextRef.current.cancelRequested = false;
    cancelContextRef.current.output = null;
    cancelContextRef.current.videoSource = null;

    let cancelled = false;

    try {
      // Create canvas matching video dimensions
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Failed to create canvas context');
      }

      // Setup MediaBunny input
      setStatus('Reading original video...');
      const videoBlob = await fetch(video.src).then(r => r.blob());
      using input = new Input({
        source: new BlobSource(videoBlob),
        formats: ALL_FORMATS,
      });

      // Get video metadata
      const duration = await input.computeDuration();
      const originalVideoTrack = await input.getPrimaryVideoTrack();
      const originalAudioTrack = await input.getPrimaryAudioTrack();

      const outputFormat = format === 'webm' 
        ? new WebMOutputFormat() 
        : new Mp4OutputFormat({ fastStart: 'in-memory' });
      const output = new Output({
        format: outputFormat,
        target: new BufferTarget(),
      });
      cancelContextRef.current.output = output;

      // Add video track
      const videoSource = new CanvasSource(canvas, {
        codec: format === 'webm' ? 'vp9' : 'avc',
        bitrate: qualityMap[quality],
      });
      output.addVideoTrack(videoSource, { frameRate: fps });
      cancelContextRef.current.videoSource = videoSource;

      // Handle audio if present
      let audioSource: AudioBufferSource | null = null;
      if (originalAudioTrack) {
        setStatus('Processing audio...');
        try {
          const arrayBuffer = await videoBlob.arrayBuffer();
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));

          audioSource = new AudioBufferSource({
            codec: format === 'webm' ? 'opus' : 'aac',
            bitrate: qualityMap[quality],
          });
          output.addAudioTrack(audioSource);

          // Start output and add audio
          await output.start();
          await audioSource.add(audioBuffer);
          audioSource.close();
          await audioContext.close();
        } catch (error) {
          await output.start();
        }
      } else {
        await output.start();
      }

      let videoSampleSink: VideoSampleSink | null = null;
      if (originalVideoTrack && (await originalVideoTrack.canDecode())) {
        videoSampleSink = new VideoSampleSink(originalVideoTrack);
      }

      // Process chunks according to mode (word/phrase) and filter enabled ones 
      // this is done to remove disabled chunks eventually to remove silence sections
      const processedChunks = processTranscriptChunks({ chunks: transcriptChunks }, mode);
      const enabledChunks = processedChunks.filter((chunk) => {
        if (mode === 'phrase' && isPhraseChunk(chunk)) {
          return !chunk.words.some((word) => {
            const originalChunk = transcriptChunks.find(
              (candidate) =>
                candidate.timestamp[0] === word.timestamp[0] &&
                candidate.timestamp[1] === word.timestamp[1]
            );
            return originalChunk?.disabled;
          });
        }
        return !chunk.disabled;
      });

      const totalFrames = Math.ceil(duration * fps);
      setStatus('Rendering video frames...');

      const timestampIterator = (async function* () {
        for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
          yield frameIndex / fps;
        }
      })();

      const sampleIterator = videoSampleSink
        ? videoSampleSink.samplesAtTimestamps(timestampIterator)
        : null;
      let iteratorResult: IteratorResult<VideoSample | null> | undefined;

      // Render each frame
      for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        if (cancelContextRef.current.cancelRequested) {
          cancelled = true;
          setStatus('Cancelling download...');
          break;
        }

        const time = frameIndex / fps;

        // Update progress (convert to percentage 0-100)
        const progressPercent = Math.min(100, (frameIndex / totalFrames) * 100);
        if (frameIndex % 3 === 0 || frameIndex === totalFrames - 1) {
          setProgress(progressPercent);
          setStatus(`Rendering: ${Math.round(time)}s / ${Math.round(duration)}s (${Math.round(progressPercent)}%)`);
        }

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw video frame using iterator to avoid repeated decoder setup
        if (videoSampleSink && sampleIterator) {
          try {
            iteratorResult = await sampleIterator.next();
            const sample = iteratorResult.value ?? null;
            if (sample) {
              sample.draw(ctx, 0, 0, canvas.width, canvas.height);
              sample.close();
            }
          } catch (error) {
            // Skip failed frames silently
          }
        }

        // Find and render current subtitle
        const currentChunk = enabledChunks.find((chunk) => {
          const [start, end] = chunk.timestamp;
          return time >= start && time <= end;
        });

        if (currentChunk) {
          renderSubtitle(ctx, currentChunk, subtitleStyle, canvas, mode, time);
        }

        if (cancelContextRef.current.cancelRequested) {
          cancelled = true;
          setStatus('Cancelling download...');
          break;
        }

        try {
          await videoSource.add(time, 1 / fps);
        } catch (error) {
          if (cancelContextRef.current.cancelRequested) {
            cancelled = true;
            setStatus('Cancelling download...');
            break;
          }
          throw error;
        }
      }

      // Clean up iterator
      if (sampleIterator) {
        try {
          await sampleIterator.return?.();
        } catch (error) {
          // Cleanup error - safe to ignore
        }
      }

      // Finalize export
      try {
        videoSource.close();
      } catch (closeError) {
        // Close error - safe to ignore
      }

      if (cancelled) {
        await output.cancel();
        setProgress(0);
        setStatus('Download cancelled');
      } else {
        setStatus('Finalizing video...');
        await output.finalize();

        // Download file
        const bufferTarget = output.target as BufferTarget;
        const buffer = bufferTarget.buffer;

        if (!buffer) {
          throw new Error('Failed to generate video buffer');
        }

        const mimeType = format === 'webm' ? 'video/webm' : 'video/mp4';
        const blob = new Blob([buffer], { type: mimeType });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `video_with_subtitles_${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setStatus('Export complete!');
        setProgress(100);
      }

    } catch (error) {
      console.error('MediaBunny video processing failed:', error);
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      cancelContextRef.current.output = null;
      cancelContextRef.current.videoSource = null;
      const wasCancelled = cancelled;
      setIsProcessing(false);
      if (wasCancelled) {
        setTimeout(() => setProgress(0), 500);
      } else {
        setTimeout(() => setProgress(0), 3000);
      }
      cancelContextRef.current.cancelRequested = false;
    }
  }, [video, transcriptChunks, subtitleStyle, mode, format, quality, fps]);

  const cancelDownload = useCallback(() => {
    if (!isProcessing) {
      return;
    }
    cancelContextRef.current.cancelRequested = true;
    setStatus('Cancelling download...');

    if (cancelContextRef.current.videoSource) {
      try {
        cancelContextRef.current.videoSource.close();
      } catch (error) {
        // Close error during cancel - safe to ignore
      } finally {
        cancelContextRef.current.videoSource = null;
      }
    }
  }, [isProcessing]);

  return {
    downloadVideo,
    cancelDownload,
    isProcessing,
    progress,
    status
  };
}

// Subtitle rendering function
function renderSubtitle(
  ctx: CanvasRenderingContext2D,
  chunk: TranscriptChunk,
  style: SubtitleStyle,
  canvas: HTMLCanvasElement,
  mode: 'word' | 'phrase',
  currentTime: number
) {
  const displayText = chunk.text;
  const isVerticalVideo = canvas.height > canvas.width;

  // Calculate scale based on video dimensions
  // Use a reference resolution for consistent scaling
  const referenceHeight = isVerticalVideo ? 1920 : 1080;
  const baseScale = canvas.height / referenceHeight;
  
  // Calculate font size to match preview proportions
  // Apply a scaling factor to match preview appearance
  const finalFontSize = Math.round(style.fontSize * baseScale * 1.5);

  // Handle font family - resolve CSS custom properties to actual font names
  let fontFamily = style.fontFamily;
  if (fontFamily.includes('var(')) {
    // Map CSS custom properties to actual font names that Canvas can use
    const fontMappings: { [key: string]: string } = {
      'var(--font-bangers)': 'Bangers',
      'var(--font-montserrat)': 'Montserrat',
      'var(--font-inter)': 'Inter',
      'var(--font-bebas-neue)': 'Bebas Neue',
      'var(--font-poppins)': 'Poppins',
      'var(--font-open-sans)': 'Open Sans',
      'var(--font-oswald)': 'Oswald',
      'var(--font-anton)': 'Anton',
      'var(--font-fredoka)': 'Fredoka',
      'var(--font-righteous)': 'Righteous',
      'var(--font-nunito)': 'Nunito',
      'var(--font-roboto)': 'Roboto',
    };
    
    // Find the CSS variable in the font family string
    for (const [cssVar, actualFont] of Object.entries(fontMappings)) {
      if (fontFamily.includes(cssVar)) {
        // Replace the CSS variable with the actual font name
        fontFamily = fontFamily.replace(cssVar, actualFont);
        break;
      }
    }
    
    // If no mapping found, extract fallback fonts
    if (fontFamily.includes('var(')) {
      const fallbackMatch = fontFamily.match(/,\s*(.+)$/);
      fontFamily = fallbackMatch ? fallbackMatch[1] : 'Arial, sans-serif';
    }
  }

  // Set font properties with font loading check
  const fontString = `${style.fontWeight} ${finalFontSize}px ${fontFamily}`;
  ctx.font = fontString;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Calculate positioning
  const x = canvas.width / 2;
  const baseY = canvas.height - (canvas.height * (isVerticalVideo ? 0.08 : 0.16));
  
  // Text wrapping logic
  const wordsInText = displayText.split(" ");
  const maxWordsPerLine = isVerticalVideo ? 4 : 6;
  const shouldSplitText = wordsInText.length > maxWordsPerLine;

  let lines = [displayText];
  let splitPoint: number | null = null;
  if (shouldSplitText) {
    const midpoint = Math.ceil(wordsInText.length / 2);
    splitPoint = midpoint;

    for (let i = Math.max(2, midpoint - 2); i <= Math.min(wordsInText.length - 2, midpoint + 2); i++) {
      if (/[,;:.!?]$/.test(wordsInText[i])) {
        splitPoint = i + 1;
        break;
      }
    }

    lines = [
      wordsInText.slice(0, splitPoint).join(" "),
      wordsInText.slice(splitPoint).join(" ")
    ].filter(Boolean);
  }

  const lineHeight = finalFontSize;
  const lineGap = 4 * baseScale;
  const totalHeight =
    lines.length * lineHeight + Math.max(0, lines.length - 1) * lineGap;
  const startY = baseY - totalHeight / 2 + lineHeight / 2;

  // Draw background if specified
  if (style.backgroundColor && style.backgroundColor !== "transparent") {
    const borderRadius = 8 * baseScale;
    const paddingX = 12 * baseScale;
    const paddingY = 8 * baseScale;
    
    // Measure maximum line width
    let maxWidth = 0;
    lines.forEach(line => {
      const metrics = ctx.measureText(line.toUpperCase());
      maxWidth = Math.max(maxWidth, metrics.width);
    });

    // Draw background perfectly centered with text
    const bgX = x - maxWidth / 2 - paddingX;
    const bgY = baseY - totalHeight / 2 - paddingY;
    const bgWidth = maxWidth + paddingX * 2;
    const bgHeight = totalHeight + paddingY * 2;

    ctx.fillStyle = style.backgroundColor;
    ctx.beginPath();
    ctx.roundRect(bgX, bgY, bgWidth, bgHeight, borderRadius);
    ctx.fill();
  }

  const phraseWords = Array.isArray(chunk.words) ? chunk.words : undefined;
  const canEmphasize =
    style.wordEmphasisEnabled &&
    mode === 'phrase' &&
    phraseWords &&
    phraseWords.length > 0 &&
    Number.isFinite(currentTime);

  if (canEmphasize) {
    const lineWordGroups = splitPoint !== null && phraseWords
      ? [
          phraseWords.slice(0, splitPoint),
          phraseWords.slice(splitPoint)
        ].filter((group) => group.length > 0)
      : [phraseWords];

    lineWordGroups.forEach((wordGroup, index) => {
      const lineY = startY + index * (lineHeight + lineGap);
      renderPhraseLineWithEmphasis(
        ctx,
        wordGroup,
        x,
        lineY,
        style,
        baseScale,
        currentTime,
        finalFontSize
      );
    });
    return;
  }

  lines.forEach((line, index) => {
    const lineY = startY + index * (lineHeight + lineGap);
    renderTextLine(ctx, line, x, lineY, style, baseScale);
  });
}

// Text rendering helper
function renderTextLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  style: SubtitleStyle,
  baseScale: number = 1
) {
  const upperText = text.toUpperCase();
  if (style.borderWidth > 0) {
    ctx.save();
    ctx.strokeStyle = style.borderColor;
    const strokeWidth = Math.max(0.5, style.borderWidth * baseScale);
    ctx.lineWidth = strokeWidth;
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeText(upperText, x, y);
    ctx.restore();
  }

  let fillStyle: string | CanvasGradient = style.color;
  if (style.color === '#CCCCCC' || style.color === '#C0C0C0') {
    const textWidth = ctx.measureText(upperText).width;
    const gradientHeight = 20 * baseScale;
    const gradient = ctx.createLinearGradient(
      x - textWidth / 2,
      y - gradientHeight,
      x + textWidth / 2,
      y + gradientHeight
    );
    gradient.addColorStop(0, '#FFFFFF');
    gradient.addColorStop(0.5, '#CCCCCC');
    gradient.addColorStop(1, '#999999');
    fillStyle = gradient;
  }

  ctx.save();
  if (style.dropShadowIntensity > 0) {
    const shadowOpacity = Math.min(1, style.dropShadowIntensity);
    ctx.shadowColor = `rgba(0,0,0,${shadowOpacity})`;
    ctx.shadowBlur = Math.max(2, style.dropShadowIntensity * 4 * baseScale);
    const shadowOffset = 2 * baseScale;
    ctx.shadowOffsetX = shadowOffset;
    ctx.shadowOffsetY = shadowOffset;
  } else {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
  ctx.fillStyle = fillStyle;
  ctx.fillText(upperText, x, y);
  ctx.restore();
}

// Helper to determine if a color is light or dark (matches video-caption.tsx logic)
function isLightColor(color: string): boolean {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  }
  return false;
}

function renderPhraseLineWithEmphasis(
  ctx: CanvasRenderingContext2D,
  words: WordTiming[],
  centerX: number,
  centerY: number,
  style: SubtitleStyle,
  baseScale: number,
  currentTime: number,
  finalFontSize: number
) {
  if (words.length === 0) {
    return;
  }

  const uppercaseWords = words.map((word) => word.text.toUpperCase());
  // Match preview spacer span width: 0.35em
  const spaceWidth = 0.35 * finalFontSize;
  const scales = words.map((word) =>
    currentTime >= word.timestamp[0] && currentTime <= word.timestamp[1] && style.wordEmphasisEnabled
      ? 1.18
      : 1
  );

  const baseWidths = uppercaseWords.map((value) => ctx.measureText(value).width);
  const scaledWidths = baseWidths.map((width, index) => width * scales[index]);
  const totalWidth = scaledWidths.reduce((total, width) => total + width, 0) + spaceWidth * Math.max(0, words.length - 1);
  let cursor = centerX - totalWidth / 2;

  // Match inline span padding: ~0.15em horizontally, minimal vertical padding
  const highlightPaddingX = finalFontSize * 0.15;
  const highlightPaddingY = finalFontSize * 0.08;
  const highlightRadius = finalFontSize * 0.35;

  // Determine emphasis colors based on text color (matches preview logic)
  const textIsLight = isLightColor(style.color);
  const emphasisBgColor = textIsLight ? 'rgba(0, 0, 0, 0.65)' : 'rgba(255, 255, 255, 0.85)';
  const emphasisTextColor = textIsLight ? '#FFFFFF' : '#000000';

  words.forEach((word, index) => {
    const displayText = uppercaseWords[index];
    const scale = scales[index];
    const scaledWidth = scaledWidths[index];
    const baseWidth = baseWidths[index];
    const isActive = scale > 1;
    const wordCenterX = cursor + scaledWidth / 2;

    if (isActive) {
      const boxWidth = scaledWidth + highlightPaddingX * 2;
      const boxHeight = finalFontSize * scale + highlightPaddingY * 2;

      ctx.save();
      ctx.fillStyle = emphasisBgColor;
      ctx.beginPath();
      ctx.roundRect(
        wordCenterX - boxWidth / 2,
        centerY - boxHeight / 2,
        boxWidth,
        boxHeight,
        highlightRadius
      );
      ctx.fill();
      ctx.restore();
    }

    const fillColor = isActive ? emphasisTextColor : style.color;

    drawWordText(
      ctx,
      displayText,
      wordCenterX,
      centerY,
      style,
      baseScale,
      scale,
      baseWidth,
      fillColor
    );

    cursor += scaledWidth + spaceWidth;
  });
}

function drawWordText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  style: SubtitleStyle,
  baseScale: number,
  scale: number,
  baseWidth: number,
  fillColor: string
) {
  const uppercase = text.toUpperCase();

  // Stroke closely matching WebKitTextStroke without over-thickening
  if (style.borderWidth > 0) {
    ctx.save();
    ctx.strokeStyle = style.borderColor;
    const scaledBorderWidth = Math.max(0.5, (style.borderWidth * baseScale) / Math.max(scale, 0.001));
    ctx.lineWidth = scaledBorderWidth;
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeText(uppercase, 0, 0);
    ctx.restore();
  }

  let fillStyle: string | CanvasGradient = fillColor;
  if (fillColor === style.color && (style.color === '#CCCCCC' || style.color === '#C0C0C0')) {
    const scaledWidth = baseWidth * scale;
    const gradientHeight = 20 * baseScale;
    const gradient = ctx.createLinearGradient(
      centerX - scaledWidth / 2,
      centerY - gradientHeight,
      centerX + scaledWidth / 2,
      centerY + gradientHeight
    );
    gradient.addColorStop(0, '#FFFFFF');
    gradient.addColorStop(0.5, '#CCCCCC');
    gradient.addColorStop(1, '#999999');
    fillStyle = gradient;
  }

  ctx.save();
  // Use canvas shadow with blur to resemble CSS drop-shadow in preview
  if (style.dropShadowIntensity > 0) {
    const shadowOpacity = Math.min(1, style.dropShadowIntensity);
    ctx.shadowColor = `rgba(0,0,0,${shadowOpacity})`;
    ctx.shadowBlur = Math.max(2, style.dropShadowIntensity * 5 * baseScale);
    const shadowOffset = 2 * baseScale;
    ctx.shadowOffsetX = shadowOffset;
    ctx.shadowOffsetY = shadowOffset;
  } else {
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }
  ctx.fillStyle = fillStyle;
  ctx.translate(centerX, centerY);
  ctx.scale(scale, scale);
  ctx.fillText(uppercase, 0, 0);
  ctx.restore();
}