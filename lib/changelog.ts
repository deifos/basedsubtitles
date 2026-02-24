/**
 * Changelog and Version Management
 *
 * Update this file when releasing new versions.
 * Version format: MAJOR.MINOR.PATCH
 * - MAJOR: Breaking changes or major new features
 * - MINOR: New features, backwards compatible
 * - PATCH: Bug fixes and small improvements
 */

export const APP_VERSION = "1.1.0";

export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: {
    type: "added" | "changed" | "fixed" | "removed";
    description: string;
  }[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: "1.1.0",
    date: "2026-02-24",
    title: "Landing Page Redesign & Performance",
    changes: [
      { type: "added", description: "New landing page with hero section, feature highlights, how-it-works flow, local processing showcase, and call-to-action" },
      { type: "added", description: "Full-page drag-and-drop — drop a video anywhere on the landing page to get started" },
      { type: "added", description: "Drag-over visual feedback on the dropzone with amber highlight" },
      { type: "added", description: "Changelog page at /changelog with version history" },
      { type: "added", description: "\"Buy me a coffee\" floating button" },
      { type: "added", description: "Site footer matching getbasedapps design with version link" },
      { type: "changed", description: "Redesigned feature cards with playful visual representations — waveform bars, layered text, font samples, language globe" },
      { type: "changed", description: "Subtitle style presets now use dynamic fonts (Bangers, Permanent Marker, Bebas Neue, Outfit) instead of generic system fonts" },
      { type: "changed", description: "Default subtitle font size changed to Small for a cleaner look" },
      { type: "changed", description: "Subtitle styling panel now uses Outfit font with consistent rounded-lg buttons and amber accent colors" },
      { type: "changed", description: "Style presets now visible in dynamic (3D) mode for consistent styling" },
      { type: "changed", description: "Subtitle preview pinned above the scroll area so it's always visible while adjusting settings" },
      { type: "changed", description: "Editor buttons and panels updated to match the new landing page design" },
      { type: "fixed", description: "Major memory leak — Whisper model (~1GB) now freed after transcription completes instead of staying in memory" },
      { type: "fixed", description: "Major memory leak — background removal model (~500MB-1GB) now freed after processing completes" },
      { type: "fixed", description: "Mask data was duplicated in both a ref and React state (~2x memory usage) — removed unused state copy" },
      { type: "fixed", description: "Canvas render loop now skips redundant draws when video is paused, saving significant CPU" },
      { type: "fixed", description: "ImageData allocation (~8MB) was created every frame at 60fps — now reused across frames" },
      { type: "fixed", description: "Temporary canvases in video export now reused across frames instead of recreated per-frame" },
      { type: "removed", description: "Removed purple color accents — replaced with amber tones throughout" },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-02-24",
    title: "Initial Release",
    changes: [
      { type: "added", description: "AI-powered subtitle generation using Whisper.js — runs 100% locally in the browser via WebGPU/WASM" },
      { type: "added", description: "Multi-language transcription supporting 100+ languages with selectable Whisper model sizes (tiny, base, small)" },
      { type: "added", description: "Background removal with AI person segmentation — processes video frames locally without any uploads" },
      { type: "added", description: "Dynamic 3D subtitles — place text behind or in front of people with depth effects" },
      { type: "added", description: "Follow-word mode for dynamic subtitles — text tracks the position of the spoken word" },
      { type: "added", description: "25+ Google Fonts including Bangers, Montserrat, Bebas Neue, Poppins, Oswald, Anton, Fredoka, Permanent Marker, Pacifico, and more" },
      { type: "added", description: "Full subtitle styling controls — font, size, weight, color, background, border, drop shadow, word emphasis" },
      { type: "added", description: "Word-by-word and phrase display modes with configurable max words per line" },
      { type: "added", description: "Subtitle position control (top, middle, bottom) with adjustable Y positioning for dynamic mode" },
      { type: "added", description: "Video export with baked-in subtitles using Mediabunny — downloads MP4 with subtitles permanently rendered" },
      { type: "added", description: "Landscape (16:9) and portrait (9:16) aspect ratio modes with zoom toggle for portrait" },
      { type: "added", description: "Editable transcript sidebar — click any segment to modify the transcribed text" },
      { type: "added", description: "Language selection modal with model size picker before transcription starts" },
      { type: "added", description: "Mobile-responsive design with drawer navigation for styling and transcript editing" },
      { type: "added", description: "Works offline after first load — all AI models are cached in the browser" },
      { type: "added", description: "Free to use — no sign-up, no watermarks, no data collection" },
    ],
  },
];

// Helper to get the latest version
export function getLatestVersion(): string {
  return APP_VERSION;
}

// Helper to get changelog by version
export function getChangelogByVersion(version: string): ChangelogEntry | undefined {
  return changelog.find((entry) => entry.version === version);
}
