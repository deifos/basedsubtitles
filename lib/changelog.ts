/**
 * Changelog and Version Management
 *
 * Update this file when releasing new versions.
 * Version format: MAJOR.MINOR.PATCH
 * - MAJOR: Breaking changes or major new features
 * - MINOR: New features, backwards compatible
 * - PATCH: Bug fixes and small improvements
 */

export const APP_VERSION = "1.0.0";

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
