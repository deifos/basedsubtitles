/**
 * Changelog and Version Management
 *
 * Update this file when releasing new versions.
 * Version format: MAJOR.MINOR.PATCH
 * - MAJOR: Breaking changes or major new features
 * - MINOR: New features, backwards compatible
 * - PATCH: Bug fixes and small improvements
 */

export const APP_VERSION = "2.4.0";

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
    version: "2.4.0",
    date: "2026-03-09",
    title: "Faster Export & Quality Selector",
    changes: [
      {
        type: "added",
        description:
          "Export quality selector — choose between Medium (smaller file, closer to source bitrate) and High Quality before downloading",
      },
      {
        type: "changed",
        description:
          "Export pipeline now uses OffscreenCanvas, alpha-free contexts, and StreamTarget for reduced memory usage and faster frame rendering",
      },
      {
        type: "changed",
        description:
          "Default export quality lowered from High to Medium so output file sizes match the original video more closely",
      },
      {
        type: "changed",
        description:
          "Face position analysis before 9:16 export now runs at 2fps instead of 5fps (2.5x faster) and shows a live progress percentage",
      },
      {
        type: "fixed",
        description:
          "Canvas context state (transforms, composite ops) no longer resets every frame during compositing export — blur, foreground, and mask canvases are sized once and cleared instead of recreated",
      },
      {
        type: "fixed",
        description:
          "Subtitle chunk lookup during export uses binary search instead of linear scan, eliminating per-frame overhead on long videos with many subtitles",
      },
      {
        type: "fixed",
        description:
          "Subtitle preview text on mobile now scales relative to the video container width instead of the viewport, with a readability boost on small screens so text stays legible even on compact previews",
      },
    ],
  },
  {
    version: "2.3.0",
    date: "2026-03-09",
    title: "Installable PWA & Home Screen Support",
    changes: [
      {
        type: "added",
        description:
          "Installable Progressive Web App support — Based Subtitles can now be added to the home screen and launched in standalone app mode",
      },
      {
        type: "added",
        description:
          "Generated branded app icons using the existing BS monogram for Android, desktop install prompts, and Apple touch devices",
      },
      {
        type: "added",
        description:
          "Install banner — shows a native install prompt on supported browsers and Add to Home Screen instructions on iPhone/iPad Safari",
      },
      {
        type: "changed",
        description:
          "App Router metadata now includes a web app manifest, Apple web app settings, and service worker wiring required for installation",
      },
      {
        type: "changed",
        description:
          "Split subtitle controls are now always visible in the styling panel, so top/bottom and left/right layouts can be selected without depending on 3D depth mode visibility",
      },
      {
        type: "fixed",
        description:
          "Display-on-spoken subtitles in dynamic 3D preview and export now keep a stable layout — future words stay reserved in place and no longer cause earlier words to shift when they appear",
      },
      {
        type: "fixed",
        description:
          "Per-word editing chips now remain available for single-word phrase subtitles, so brief isolated words can still be selected and styled from the bottom editor bar",
      },
      {
        type: "fixed",
        description:
          "Split subtitle mode now preserves per-word emoji replacement and emoji overlay styling in both preview and exported video instead of dropping those overrides on split lines",
      },
    ],
  },
  {
    version: "2.2.0",
    date: "2026-03-08",
    title: "Vertical Offset, Sidebar Cleanup & Open Source",
    changes: [
      {
        type: "added",
        description:
          "Vertical offset slider (±50 px) to fine-tune subtitle position above or below the default — applies to preview, canvas compositing, and exported video",
      },
      {
        type: "fixed",
        description:
          "Vertical offset now correctly applied during video export — previously the setting was ignored and subtitles always rendered at the default position",
      },
      {
        type: "added",
        description:
          '"Hide inactive" toggle in the transcript sidebar — hides both skipped segments (no audio) and hidden-subtitle segments (audio plays, no text) to keep the sidebar clean',
      },
      {
        type: "changed",
        description:
          "Project is now open source — source code available on GitHub at github.com/deifos/basedsubtitles",
      },
    ],
  },
  {
    version: "2.1.0",
    date: "2026-03-08",
    title: "Streaming Transcription & Long Video Support",
    changes: [
      {
        type: "added",
        description:
          "Streaming transcription — partial results appear chunk by chunk as Whisper processes the audio instead of waiting for the full video to finish",
      },
      {
        type: "added",
        description:
          "Live subtitle preview updates in the transcript sidebar while transcription is still running",
      },
      {
        type: "added",
        description:
          "Non-blocking UI after the first chunk arrives — blocking overlay replaced by a slim in-header progress indicator so you can see partial subtitles in real time",
      },
      {
        type: "added",
        description:
          "Transcribing banner in the transcript sidebar (amber, with spinner and progress bar) pinned below the scroll area so it stays visible while reading results",
      },
      {
        type: "added",
        description:
          "Transcribing banner now shows the current timestamp being processed (e.g. Transcribing 0:42 · 73%) so you can track progress without scrolling",
      },
      {
        type: "changed",
        description:
          "Long video support is now reliable — transcription uses the same 30s / 5s stride chunking that the Whisper reference implementation uses, with stride-aware multi-chunk merging via _decode_asr",
      },
      {
        type: "changed",
        description:
          "Whisper worker now replicates the pipeline's internal _call_whisper loop (model.generate() per chunk + tokenizer._decode_asr() for merging) instead of calling the high-level pipeline function, giving identical accuracy with streaming output",
      },
      {
        type: "fixed",
        description:
          "Transcription was silently skipping sections of audio in videos longer than ~30 seconds — caused by sending the full audio in one call without stride-aware chunking",
      },
      {
        type: "fixed",
        description:
          "Multi-chunk merging was incorrectly concatenating chunks instead of filtering stride overlap regions — fixed by enabling return_timestamps so timestamp tokens are present for _decode_asr's stride filtering logic",
      },
      {
        type: "fixed",
        description:
          "Subtitle file downloads used a generic filename (subtitles.srt) regardless of the source video — now uses the video filename as the base (e.g. my-clip.srt)",
      },
      {
        type: "removed",
        description:
          "Removed 'Add Subtitle' manual entry form from the transcript sidebar — no longer needed now that transcription accuracy covers the full video without gaps",
      },
    ],
  },
  {
    version: "2.0.0",
    date: "2026-03-06",
    title: "Split Subtitles & Display on Spoken",
    changes: [
      {
        type: "added",
        description:
          "Split subtitle mode — phrase text is divided in two and placed around the person's head. Two modes: Above/Below (works on any ratio) and Left/Right (widescreen only)",
      },
      {
        type: "added",
        description:
          "Left/Right split positions text at eye level (~38% from top) with a gap on each side of the face so text has room to move as the person shifts",
      },
      {
        type: "added",
        description:
          "Per-phrase frozen face position for split subtitles — text is anchored to where the face was at the start of each phrase and stays fixed for its duration, avoiding distracting mid-phrase drift",
      },
      {
        type: "added",
        description:
          "Face tracking auto-starts when a split subtitle mode is selected and stops when set back to Off — no manual toggle required",
      },
      {
        type: "added",
        description:
          "Display on Spoken — all phrase words appear dim at phrase start and each word lights up to full brightness when spoken. Layout is stable from the first word (no shifting as words appear)",
      },
      {
        type: "added",
        description:
          "Display on Spoken works in all render paths: DOM preview, canvas compositing, and video export",
      },
      {
        type: "added",
        description:
          "Display on Spoken combined with Split Subtitle mode — each half renders words individually with dim/bright per word",
      },
      {
        type: "changed",
        description:
          "Split Subtitle section is always visible in the styling panel — no longer gated behind face tracking being active",
      },
      {
        type: "changed",
        description:
          "Applying a style preset no longer resets the font size — presets change color, border, and font family while preserving the user's chosen size",
      },
      {
        type: "changed",
        description:
          "Default style updated to green (#00FF41), medium font size, no background, and Display on Spoken enabled",
      },
    ],
  },
  {
    version: "1.9.0",
    date: "2026-03-05",
    title: "Face Tracking Export, Stroke Slider & Fixes",
    changes: [
      {
        type: "fixed",
        description:
          "Face tracking was not applied during 9:16 video export — the buildExportTimeline function was missing from the useCallback dependency array, causing the export to always use a stale closure where it was undefined",
      },
      {
        type: "fixed",
        description:
          "Exported face tracking had a slight delay compared to the preview — added a 150ms look-ahead offset when sampling the face timeline during export to compensate for EMA smoothing phase lag",
      },
      {
        type: "fixed",
        description:
          "Export failed with odd-dimension error on 4K sources — 9:16 crop of 2160p height produces 1215px width (odd), which H.264 rejects. Dimensions are now rounded down to even numbers",
      },
      {
        type: "fixed",
        description:
          "Font stroke/border was filling inside the text at higher widths — canvas strokeText draws centered on the glyph outline so half went inward. Now draws stroke at 2x width before fill, and CSS preview uses paint-order: stroke fill",
      },
      {
        type: "changed",
        description:
          "Border width control replaced with a 0–20px slider instead of a dropdown with only 4 options (None/Thin/Medium/Thick)",
      },
      {
        type: "changed",
        description:
          "Default subtitle style now uses 10px white border stroke for better contrast and readability on any background",
      },
      {
        type: "removed",
        description:
          "Removed text fade-in effect (letter-by-letter reveal) — timing was unreliable, words would disappear before fully revealing on short chunks",
      },
    ],
  },
  {
    version: "1.8.2",
    date: "2026-03-04",
    title: "Mobile Export Quality & Color Picker Performance",
    changes: [
      {
        type: "fixed",
        description:
          "Exported video was low quality on mobile — the export pipeline creates multiple full-resolution offscreen canvases that exceeded mobile browser memory limits, causing silent quality degradation. Export resolution is now capped at 1080p on mobile to stay within canvas memory budgets",
      },
      {
        type: "fixed",
        description:
          "Black video export on mobile browsers without WebCodecs decoding support — when canDecode() returned false, no video frames were drawn. Added a fallback that seeks the video element and draws each frame directly",
      },
      {
        type: "fixed",
        description:
          "Color pickers caused heavy lag while dragging — all 5 color inputs (per-word color, text color, background color, border color, solid background) fired onChange on every pixel movement, triggering full state updates and canvas re-renders 10–50 times per second. Now debounced with immediate visual feedback via local state",
      },
    ],
  },
  {
    version: "1.8.1",
    date: "2026-02-27",
    title: "Mobile Playback & Camera Fixes",
    changes: [
      {
        type: "fixed",
        description:
          "Camera recording showed black screen on mobile — video element didn't exist in the DOM when the stream was attached; now re-attaches via useEffect when the preview mounts",
      },
      {
        type: "fixed",
        description:
          "Video not playing after scrubbing on mobile — pausing the video on drag start then calling play() on release failed because pointerup on range inputs isn't a trusted gesture on mobile; removed pause/resume entirely",
      },
      {
        type: "fixed",
        description:
          "Video freezing when scrubbing on mobile — was setting videoEl.currentTime on every drag frame, overwhelming the decoder; now only seeks once on pointer release (mediabunny pattern)",
      },
      {
        type: "fixed",
        description:
          "Subtitles showing stale position during seek drag — now calls onTimeUpdate during drag so subtitles and transcript stay in sync with the scrub position",
      },
      {
        type: "fixed",
        description:
          'Video not buffering fully on mobile — added preload="auto" so mobile browsers load the complete video instead of lazy-loading',
      },
      {
        type: "changed",
        description:
          'Replaced <input type="range"> seek bar with custom div-based progress bar using pointer events and setPointerCapture — eliminates all mobile range input quirks and provides reliable touch tracking even when finger drifts off the bar',
      },
      {
        type: "changed",
        description:
          "Progress bar fill and time display update via refs during drag (zero re-renders while scrubbing, Vercel React best practice: useRef for transient values)",
      },
      {
        type: "changed",
        description:
          "Added keyboard support (left/right arrows ±5s) and ARIA slider attributes to custom progress bar for accessibility",
      },
      {
        type: "changed",
        description:
          "Video timeupdate events are ignored during seek drag to prevent the video's stale position from overriding the user's scrub position",
      },
    ],
  },
  {
    version: "1.8.0",
    date: "2026-02-26",
    title: "Unified Word Editing & Min Words",
    changes: [
      {
        type: "added",
        description:
          "Per-word emoji size slider — scale each word's emoji independently from 50% to 200% (appears in word style popover when an emoji is set)",
      },
      {
        type: "added",
        description:
          "Compact word style popover on mobile — collapsible icon tabs (Font, Size, Color, FX, Emoji) overlay the video without blocking subtitles or requiring scroll",
      },
      {
        type: "changed",
        description:
          "Word editing standardized to chip bar below video — works in all modes (3D on/off), replacing direct click-on-word in the preview",
      },
      {
        type: "changed",
        description:
          "Word chips restyled with dark background for better visibility",
      },
      {
        type: "changed",
        description:
          "Min words per line lowered from 3 to 1 — allows single-word-at-a-time subtitle display",
      },
      {
        type: "changed",
        description:
          "Emoji size is now per-word instead of global — moved from styling panel to the word style popover",
      },
      {
        type: "fixed",
        description:
          "Emoji overlay size was not applied during video export — now correctly uses per-word emojiScale in all render paths",
      },
    ],
  },
  {
    version: "1.7.0",
    date: "2026-02-25",
    title: "Per-Word Emoji Replace & Overlay",
    changes: [
      {
        type: "added",
        description:
          "Per-word emoji replace — click any word and pick an emoji to replace the word text entirely with that emoji",
      },
      {
        type: "added",
        description:
          "Per-word emoji overlay — place an emoji above any word while keeping the text visible underneath",
      },
      {
        type: "added",
        description:
          "Emoji picker integrated into the per-word style popover with search support",
      },
      {
        type: "added",
        description:
          "Emoji replace and overlay render in DOM preview, canvas compositing (3D depth mode), and video export",
      },
      {
        type: "added",
        description:
          "Emoji size scales with the word's font size — enlarging a word also enlarges its emoji",
      },
      {
        type: "fixed",
        description:
          "Word style popover in 3D mode did not update when clicking a different word badge — popover now resets and shows the correct word's settings",
      },
      {
        type: "added",
        description:
          'Branding watermark — toggleable "basedsubs.getbasedapps.com" text in the bottom-left corner, rendered in preview and baked into exported videos',
      },
    ],
  },
  {
    version: "1.6.0",
    date: "2026-02-25",
    title: "Letter-by-Letter Text Fade In",
    changes: [
      {
        type: "added",
        description:
          "Letter-by-letter text fade in — characters reveal left-to-right within each word with staggered timing, similar to VEED-style animated captions",
      },
      {
        type: "added",
        description:
          '"Text fade in" toggle in the styling panel — when off, text appears and disappears instantly with no fade effects',
      },
      {
        type: "added",
        description:
          "Letter-by-letter reveal works in DOM preview, canvas compositing (3D depth), and video export",
      },
      {
        type: "changed",
        description:
          "Word and chunk fade effects are now gated behind the text fade in toggle instead of always on",
      },
      {
        type: "changed",
        description: "Active word emphasis is now off by default",
      },
      {
        type: "fixed",
        description:
          "Mobile camera starting with black screen — autoPlay not reliable on mobile, now explicitly calls play() after attaching the stream",
      },
      {
        type: "fixed",
        description:
          'Flipping camera showed "camera in use by another app" — the useEffect re-fired openCamera on facingMode change, causing two getUserMedia calls to race for the same device',
      },
      {
        type: "fixed",
        description:
          "Camera defaulting to back camera on some Android devices — now uses exact facingMode constraint instead of a preference hint the browser can ignore",
      },
      {
        type: "fixed",
        description:
          "Mobile styling and edit panels could not be switched directly — had to close one before opening the other. Bottom bar buttons are now toggles with mutual exclusion",
      },
      {
        type: "fixed",
        description:
          "Mobile drawer panels cut off at the bottom — content now fills the full available height down to the navigation bar",
      },
      {
        type: "fixed",
        description:
          "Mobile styling panel couldn't scroll to the last items — scroll area now accounts for the fixed bottom navigation bar",
      },
      {
        type: "fixed",
        description:
          "Letter-by-letter text fade in now works in 3D depth mode — both behind and front text layers support per-character reveal and chunk fade-out",
      },
      {
        type: "fixed",
        description:
          "Mobile transcript panel height was capped at 384px (max-h-96) — removed the cap on mobile so the list fills the drawer",
      },
      {
        type: "removed",
        description:
          'Removed redundant "Subtitles behind person" toggle — its functionality is fully covered by the "Dynamic depth 3D" toggle',
      },
    ],
  },
  {
    version: "1.5.0",
    date: "2026-02-25",
    title: "Knockout Text Effect & New Font",
    changes: [
      {
        type: "added",
        description:
          "Knockout text effect — per-word style option that makes the text shape reveal an inverted/negative version of the video behind it",
      },
      {
        type: "added",
        description:
          "Knockout toggle in the word style popover under a new 'Effect' section",
      },
      {
        type: "added",
        description:
          "Knockout renders in DOM preview (mix-blend-mode: difference), canvas compositing (3D depth mode), and video export",
      },
      {
        type: "added",
        description:
          "Lilita One font — thick, bold display font with a magazine-cover aesthetic, great for knockout effects",
      },
    ],
  },
  {
    version: "1.4.1",
    date: "2026-02-25",
    title: "Mobile Bug Fixes",
    changes: [
      {
        type: "fixed",
        description:
          "Footer 'Powered by' row no longer overflows on small screens — items wrap and bullet separators hide on mobile",
      },
      {
        type: "fixed",
        description:
          "Video freezing on mobile after transcription — unhandled play() promise rejections from autoplay policy now caught on all play/pause controls",
      },
      {
        type: "added",
        description:
          "Toast notifications for background removal errors — shows a clear message when WebGPU/WASM is unavailable instead of silently failing",
      },
    ],
  },
  {
    version: "1.4.0",
    date: "2026-02-25",
    title: "Camera Recording, Custom Player & Bug Fixes",
    changes: [
      {
        type: "added",
        description:
          "Camera recording — record video directly from your camera (front or back) with a 'Record video' button on the landing page",
      },
      {
        type: "added",
        description:
          "Records straight to MP4 using MediaBunny (H.264 + AAC) — no WebM conversion needed",
      },
      {
        type: "added",
        description:
          "Camera flip button to switch between front and back cameras on mobile",
      },
      {
        type: "added",
        description:
          "Review screen after recording with re-record and 'Use this video' options",
      },
      {
        type: "added",
        description:
          "Custom player controls (play/pause, seek bar, time, mute) shown consistently in all modes",
      },
      {
        type: "added",
        description: "Click anywhere on the video to play/pause",
      },
      { type: "added", description: "Umami analytics integration" },
      {
        type: "added",
        description:
          "Powered by Transformers.js and MediaBunny attribution with logos in the footer",
      },
      {
        type: "changed",
        description:
          "Removed native browser video controls — custom controls prevent subtitles from covering playback buttons",
      },
      {
        type: "changed",
        description:
          "Landing hero tagline updated from 'Free forever' to 'Free'",
      },
      {
        type: "fixed",
        description:
          "Selecting the 500MB model caused a blank screen — base model preload raced with the user's model choice, resolving the wrong download promise",
      },
      {
        type: "fixed",
        description:
          "Added load ID tracking so stale model 'ready' messages from previous downloads can't resolve the wrong promise",
      },
      {
        type: "fixed",
        description:
          "Cancelling the language modal on a fresh upload now returns to the landing page instead of showing a dead-end video screen",
      },
      {
        type: "fixed",
        description:
          "Subtitle text appearing/disappearing no longer causes layout jumps — placeholder space is always reserved",
      },
      {
        type: "fixed",
        description:
          "Word chip bar in compositing mode no longer causes layout shifts between phrases",
      },
    ],
  },
  {
    version: "1.3.1",
    date: "2026-02-25",
    title: "3D Depth Export Performance Fix",
    changes: [
      {
        type: "fixed",
        description:
          "Video export with 3D depth enabled was re-running MODNet AI inference on every frame at 30fps (~1,800 calls per minute of video) — now uses pre-computed 5fps mask cache, reducing export time from ~15 minutes to under a minute",
      },
      {
        type: "fixed",
        description:
          "Export with 3D depth consumed ~2GB+ RAM from per-frame 8MB getImageData allocations and data copies to the AI worker — eliminated entirely by using cached masks",
      },
    ],
  },
  {
    version: "1.3.0",
    date: "2026-02-24",
    title: "Word Chip Bar & Auto 3D Depth",
    changes: [
      {
        type: "added",
        description:
          "Word chip bar — clickable word buttons appear below the video when 3D depth mode is active, letting you select any word for per-word styling",
      },
      {
        type: "added",
        description:
          "Words with custom style overrides are highlighted with an amber tint in the chip bar",
      },
      {
        type: "changed",
        description:
          "3D depth mode now auto-enables when background removal starts — no extra toggle needed",
      },
      {
        type: "changed",
        description:
          "Per-word selection in 3D/bg-removal mode uses the reliable chip bar instead of canvas click coordinates",
      },
      {
        type: "fixed",
        description:
          "Clicking anywhere on the canvas in 3D mode no longer incorrectly triggers word editing",
      },
      {
        type: "fixed",
        description:
          "Hidden and disabled words can no longer be selected for editing",
      },
      {
        type: "fixed",
        description:
          "Major memory leak in video export — frame pixel data (~8MB) was allocated per-frame instead of reusing an offscreen canvas via GPU blit",
      },
      {
        type: "fixed",
        description:
          "AudioContext not closed on error during export, leaking audio memory",
      },
      {
        type: "fixed",
        description:
          "Reusable canvases and buffers from export were never released after completion, staying in memory indefinitely",
      },
      {
        type: "changed",
        description:
          "Font mapping table (24 entries) extracted to a single module-level constant — was duplicated in 5 functions and recreated per-frame during export",
      },
      {
        type: "removed",
        description:
          "Removed dead hitTestOnly prop from VideoCaption and unused renderDynamicWordToCanvas function",
      },
    ],
  },
  {
    version: "1.2.0",
    date: "2026-02-24",
    title: "Per-Word Styling & Preset Preview",
    changes: [
      {
        type: "added",
        description:
          "Per-word custom styling — click any word in the video preview to override its font, size, and color independently",
      },
      {
        type: "added",
        description:
          "Word style popover with font family picker, size multiplier (50%–200%), color picker, and reset button",
      },
      {
        type: "added",
        description:
          "Selected word highlight with yellow outline in the video preview",
      },
      {
        type: "added",
        description:
          "Per-word overrides render correctly in both the live preview and exported video",
      },
      {
        type: "changed",
        description:
          "Preset buttons now render with their actual font — Bangers for Green, Permanent Marker for Gold, Outfit for Subtitle, Bebas Neue for Gamer",
      },
      {
        type: "changed",
        description:
          "Preset buttons show the correct font weight so you can preview the style before applying",
      },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-02-24",
    title: "Landing Page Redesign & Performance",
    changes: [
      {
        type: "added",
        description:
          "New landing page with hero section, feature highlights, how-it-works flow, local processing showcase, and call-to-action",
      },
      {
        type: "added",
        description:
          "Full-page drag-and-drop — drop a video anywhere on the landing page to get started",
      },
      {
        type: "added",
        description:
          "Drag-over visual feedback on the dropzone with amber highlight",
      },
      {
        type: "added",
        description: "Changelog page at /changelog with version history",
      },
      { type: "added", description: '"Buy me a coffee" floating button' },
      {
        type: "added",
        description:
          "Site footer matching getbasedapps design with version link",
      },
      {
        type: "changed",
        description:
          "Redesigned feature cards with playful visual representations — waveform bars, layered text, font samples, language globe",
      },
      {
        type: "changed",
        description:
          "Subtitle style presets now use dynamic fonts (Bangers, Permanent Marker, Bebas Neue, Outfit) instead of generic system fonts",
      },
      {
        type: "changed",
        description:
          "Default subtitle font size changed to Small for a cleaner look",
      },
      {
        type: "changed",
        description:
          "Subtitle styling panel now uses Outfit font with consistent rounded-lg buttons and amber accent colors",
      },
      {
        type: "changed",
        description:
          "Style presets now visible in dynamic (3D) mode for consistent styling",
      },
      {
        type: "changed",
        description:
          "Subtitle preview pinned above the scroll area so it's always visible while adjusting settings",
      },
      {
        type: "changed",
        description:
          "Editor buttons and panels updated to match the new landing page design",
      },
      {
        type: "fixed",
        description:
          "Major memory leak — Whisper model (~1GB) now freed after transcription completes instead of staying in memory",
      },
      {
        type: "fixed",
        description:
          "Major memory leak — background removal model (~500MB-1GB) now freed after processing completes",
      },
      {
        type: "fixed",
        description:
          "Mask data was duplicated in both a ref and React state (~2x memory usage) — removed unused state copy",
      },
      {
        type: "fixed",
        description:
          "Canvas render loop now skips redundant draws when video is paused, saving significant CPU",
      },
      {
        type: "fixed",
        description:
          "ImageData allocation (~8MB) was created every frame at 60fps — now reused across frames",
      },
      {
        type: "fixed",
        description:
          "Temporary canvases in video export now reused across frames instead of recreated per-frame",
      },
      {
        type: "removed",
        description:
          "Removed purple color accents — replaced with amber tones throughout",
      },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-02-24",
    title: "Initial Release",
    changes: [
      {
        type: "added",
        description:
          "AI-powered subtitle generation using Whisper.js — runs 100% locally in the browser via WebGPU/WASM",
      },
      {
        type: "added",
        description:
          "Multi-language transcription supporting 100+ languages with selectable Whisper model sizes (tiny, base, small)",
      },
      {
        type: "added",
        description:
          "Background removal with AI person segmentation — processes video frames locally without any uploads",
      },
      {
        type: "added",
        description:
          "Dynamic 3D subtitles — place text behind or in front of people with depth effects",
      },
      {
        type: "added",
        description:
          "Follow-word mode for dynamic subtitles — text tracks the position of the spoken word",
      },
      {
        type: "added",
        description:
          "25+ Google Fonts including Bangers, Montserrat, Bebas Neue, Poppins, Oswald, Anton, Fredoka, Permanent Marker, Pacifico, and more",
      },
      {
        type: "added",
        description:
          "Full subtitle styling controls — font, size, weight, color, background, border, drop shadow, word emphasis",
      },
      {
        type: "added",
        description:
          "Word-by-word and phrase display modes with configurable max words per line",
      },
      {
        type: "added",
        description:
          "Subtitle position control (top, middle, bottom) with adjustable Y positioning for dynamic mode",
      },
      {
        type: "added",
        description:
          "Video export with baked-in subtitles using Mediabunny — downloads MP4 with subtitles permanently rendered",
      },
      {
        type: "added",
        description:
          "Landscape (16:9) and portrait (9:16) aspect ratio modes with zoom toggle for portrait",
      },
      {
        type: "added",
        description:
          "Editable transcript sidebar — click any segment to modify the transcribed text",
      },
      {
        type: "added",
        description:
          "Language selection modal with model size picker before transcription starts",
      },
      {
        type: "added",
        description:
          "Mobile-responsive design with drawer navigation for styling and transcript editing",
      },
      {
        type: "added",
        description:
          "Works offline after first load — all AI models are cached in the browser",
      },
      {
        type: "added",
        description:
          "Free to use — no sign-up, no watermarks, no data collection",
      },
    ],
  },
];

// Helper to get the latest version
export function getLatestVersion(): string {
  return APP_VERSION;
}

// Helper to get changelog by version
export function getChangelogByVersion(
  version: string,
): ChangelogEntry | undefined {
  return changelog.find((entry) => entry.version === version);
}
