# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.3.0] — 2026-03-09 — Installable PWA & Home Screen Support

### Added

- Installable Progressive Web App support — Based Subtitles can now be added to the home screen and launched in standalone app mode
- Generated branded app icons using the existing BS monogram for Android, desktop install prompts, and Apple touch devices
- Install banner — shows a native install prompt on supported browsers and Add to Home Screen instructions on iPhone/iPad Safari

### Changed

- App Router metadata now includes a web app manifest, Apple web app settings, and service worker wiring required for installation

---

## [2.2.0] — 2026-03-09 — Background Removal Performance & Reliability

### Added

- Mask lookahead offset (+half frame interval) when looking up the bg-removal mask in the preview compositing loop — mask is now centered around the current video time instead of always lagging behind by a full interval
- Export face timeline validation — `buildExportTimeline` now only uses the preview-collected timeline if it covers ≥90% of the video, preventing partial data (e.g. user watched first 5s of a 30s clip) from locking the crop to the last tracked position for the rest of the export

### Changed

- Background removal mask resolution capped at 640px (longest edge) during processing — reduces peak memory from ~300MB to ~34MB for a typical 1080p source at the same 8fps sampling rate
- Mask sampling rate increased from 5fps to 8fps — reduces max temporal lag from 200ms to 125ms with the resolution cap keeping memory well under 100MB for most videos
- Mask storage refactored from `Map<number, MaskData>` to `MaskData[]` — dense array with O(1) clamped-index lookup replaces the O(n) nearest-key scan

### Fixed

- Preview compositing was processing the full mask pixel array (up to 2MB) every rAF frame (~60fps) even though the mask only changes at 8fps — now skips the conversion and `putImageData` when the mask reference hasn't changed, cutting CPU work by ~87%
- Mask crop alignment for 9:16 portrait with background removal was wrong when the source was landscape — the mask was drawn at full frame scale instead of being proportionally cropped to match the visible portrait region
- Three memory leaks: null event handlers not cleared before resetting the processing video `src`, `skipTimeoutRef` setTimeout not cleared on unmount in `VideoUpload`, progress-reset timeout not cleared on unmount in `useVideoDownloadMediaBunny`
- Video upload showed `ERR_FILE_NOT_FOUND` after the first upload in development — cleanup effects and mount effects were revoking the blob URL while the async `onloadedmetadata` promise was still pending (React StrictMode double-invoke). Revocations now happen only at explicit replacement/error/reset points
- Face tracking was not applied during export — `startTracking` was resetting `timelineRef` on every call including ratio/settings changes, so `buildExportTimeline` always found an empty timeline and fell back to the fresh scan which often detected no faces. Fixed by preserving the timeline across re-runs when the video source hasn't changed (`trackedSrcRef`)
- Face tracking export fresh scan could hang indefinitely if the video was already at `t=0` when the scan started — the `seeked` event listener is now registered before setting `currentTime`, and the seek is skipped entirely if already within 10ms of the target

### Removed

- "Generation time: X.XXs (WebGPU)" display below the background removal section — transcription stats (time taken and device) are now shown in the transcript sidebar banner
- Transcription progress % was shown next to the GPU/CPU label, making it look like GPU usage — % now appears next to the timestamp (e.g. "Transcribing 0:42 · 73%") and the banner shows "Done in 1m 4s" after completion

---

## [2.1.0] — 2026-03-08 — Streaming Transcription & Long Video Support

### Added

- Streaming transcription — partial results appear chunk by chunk as Whisper processes the audio instead of waiting for the full video to finish
- Live subtitle preview updates in the transcript sidebar while transcription is still running
- Non-blocking UI after the first transcription chunk arrives — the blocking overlay is replaced by a slim in-header progress indicator so you can see and interact with partial subtitles in real time
- Transcribing banner in the transcript sidebar (amber, with spinner and progress bar) pinned below the scroll area so it stays visible while reading results
- Transcribing banner now shows the current timestamp being processed (e.g. "Transcribing 0:42 · 73%") so you can see progress without scrolling

### Changed

- Long video support is now reliable — transcription uses the same 30s / 5s stride chunking that the Whisper reference implementation uses, with stride-aware multi-chunk merging via `_decode_asr`. Previously all audio was sent as one block, which caused Whisper to truncate or skip content beyond ~30 seconds
- Whisper worker now replicates the pipeline's internal `_call_whisper` loop (`model.generate()` per chunk + `tokenizer._decode_asr()` for merging) instead of calling the high-level pipeline function, giving identical accuracy with streaming output

### Fixed

- Transcription was silently skipping sections of audio in videos longer than ~30 seconds — caused by sending the full audio in one call without stride-aware chunking
- Multi-chunk merging was incorrectly concatenating chunks instead of filtering stride overlap regions — fixed by enabling `return_timestamps: true` so timestamp tokens are present in the generated output for `_decode_asr`'s stride filtering logic
- Subtitle file downloads used a generic filename ("subtitles.srt") regardless of the source video — now uses the video filename as the base (e.g. "my-clip.srt")

### Removed

- Removed "Add Subtitle" manual entry form from the transcript sidebar — no longer needed now that transcription accuracy covers the full video without gaps

---

## [2.0.0] — 2026-03-06 — Split Subtitles & Display on Spoken

### Added

- Split subtitle mode — phrase text is divided in two and placed around the person's head. Two modes: Above/Below (works on any ratio) and Left/Right (widescreen only)
- Left/Right split positions text at eye level (~38% from top) with a gap on each side of the face so text has room to move as the person shifts
- Per-phrase frozen face position for split subtitles — text is anchored to where the face was at the start of each phrase and stays fixed for its duration, avoiding distracting mid-phrase drift
- Face tracking auto-starts when a split subtitle mode is selected and stops when set back to Off — no manual toggle required
- Display on Spoken — all phrase words appear dim at phrase start and each word lights up to full brightness when spoken. Layout is stable from the first word (no shifting as words appear)
- Display on Spoken works in all render paths: DOM preview, canvas compositing, and video export
- Display on Spoken combined with Split Subtitle mode — each half renders words individually with dim/bright per word

### Changed

- Split Subtitle section is always visible in the styling panel — no longer gated behind face tracking being active
- Applying a style preset no longer resets the font size — presets change color, border, and font family while preserving the user's chosen size
- Default style updated to green (#00FF41), medium font size, no background, and Display on Spoken enabled

---

## [1.9.0] — 2026-03-05 — Face Tracking Export, Stroke Slider & Fixes

### Changed

- Border width control replaced with a 0–20px slider instead of a dropdown with only 4 options (None/Thin/Medium/Thick)
- Default subtitle style now uses 10px white border stroke for better contrast and readability on any background

### Fixed

- Face tracking was not applied during 9:16 video export — the buildExportTimeline function was missing from the useCallback dependency array, causing the export to always use a stale closure where it was undefined
- Exported face tracking had a slight delay compared to the preview — added a 150ms look-ahead offset when sampling the face timeline during export to compensate for EMA smoothing phase lag
- Export failed with odd-dimension error on 4K sources — 9:16 crop of 2160p height produces 1215px width (odd), which H.264 rejects. Dimensions are now rounded down to even numbers
- Font stroke/border was filling inside the text at higher widths — canvas strokeText draws centered on the glyph outline so half went inward. Now draws stroke at 2x width before fill, and CSS preview uses paint-order: stroke fill

### Removed

- Removed text fade-in effect (letter-by-letter reveal) — timing was unreliable, words would disappear before fully revealing on short chunks

---

## [1.8.2] — 2026-03-04 — Mobile Export Quality & Color Picker Performance

### Fixed

- Exported video was low quality on mobile — the export pipeline creates multiple full-resolution offscreen canvases that exceeded mobile browser memory limits, causing silent quality degradation. Export resolution is now capped at 1080p on mobile to stay within canvas memory budgets
- Black video export on mobile browsers without WebCodecs decoding support — when canDecode() returned false, no video frames were drawn. Added a fallback that seeks the video element and draws each frame directly
- Color pickers caused heavy lag while dragging — all 5 color inputs (per-word color, text color, background color, border color, solid background) fired onChange on every pixel movement, triggering full state updates and canvas re-renders 10–50 times per second. Now debounced with immediate visual feedback via local state

---

## [1.8.1] — 2026-02-27 — Mobile Playback & Camera Fixes

### Changed

- Replaced `<input type="range">` seek bar with custom div-based progress bar using pointer events and setPointerCapture — eliminates all mobile range input quirks and provides reliable touch tracking even when finger drifts off the bar
- Progress bar fill and time display update via refs during drag (zero re-renders while scrubbing)
- Added keyboard support (left/right arrows ±5s) and ARIA slider attributes to custom progress bar for accessibility
- Video timeupdate events are ignored during seek drag to prevent the video's stale position from overriding the user's scrub position

### Fixed

- Camera recording showed black screen on mobile — video element didn't exist in the DOM when the stream was attached; now re-attaches via useEffect when the preview mounts
- Video not playing after scrubbing on mobile — pausing the video on drag start then calling play() on release failed because pointerup on range inputs isn't a trusted gesture on mobile; removed pause/resume entirely
- Video freezing when scrubbing on mobile — was setting videoEl.currentTime on every drag frame, overwhelming the decoder; now only seeks once on pointer release
- Subtitles showing stale position during seek drag — now calls onTimeUpdate during drag so subtitles and transcript stay in sync with the scrub position
- Video not buffering fully on mobile — added preload="auto" so mobile browsers load the complete video instead of lazy-loading

---

## [1.8.0] — 2026-02-26 — Unified Word Editing & Min Words

### Added

- Per-word emoji size slider — scale each word's emoji independently from 50% to 200% (appears in word style popover when an emoji is set)
- Compact word style popover on mobile — collapsible icon tabs (Font, Size, Color, FX, Emoji) overlay the video without blocking subtitles or requiring scroll

### Changed

- Word editing standardized to chip bar below video — works in all modes (3D on/off), replacing direct click-on-word in the preview
- Word chips restyled with dark background for better visibility
- Min words per line lowered from 3 to 1 — allows single-word-at-a-time subtitle display
- Emoji size is now per-word instead of global — moved from styling panel to the word style popover

### Fixed

- Emoji overlay size was not applied during video export — now correctly uses per-word emojiScale in all render paths

---

## [1.7.0] — 2026-02-25 — Per-Word Emoji Replace & Overlay

### Added

- Per-word emoji replace — click any word and pick an emoji to replace the word text entirely with that emoji
- Per-word emoji overlay — place an emoji above any word while keeping the text visible underneath
- Emoji picker integrated into the per-word style popover with search support
- Emoji replace and overlay render in DOM preview, canvas compositing (3D depth mode), and video export
- Emoji size scales with the word's font size — enlarging a word also enlarges its emoji
- Branding watermark — toggleable "basedsubs.getbasedapps.com" text in the bottom-left corner, rendered in preview and baked into exported videos

### Fixed

- Word style popover in 3D mode did not update when clicking a different word badge — popover now resets and shows the correct word's settings

---

## [1.6.0] — 2026-02-25 — Letter-by-Letter Text Fade In

### Added

- Letter-by-letter text fade in — characters reveal left-to-right within each word with staggered timing
- "Text fade in" toggle in the styling panel — when off, text appears and disappears instantly with no fade effects
- Letter-by-letter reveal works in DOM preview, canvas compositing (3D depth), and video export

### Changed

- Word and chunk fade effects are now gated behind the text fade in toggle instead of always on
- Active word emphasis is now off by default

### Fixed

- Mobile camera starting with black screen — autoPlay not reliable on mobile, now explicitly calls play() after attaching the stream
- Flipping camera showed "camera in use by another app" — the useEffect re-fired openCamera on facingMode change, causing two getUserMedia calls to race for the same device
- Camera defaulting to back camera on some Android devices — now uses exact facingMode constraint instead of a preference hint the browser can ignore
- Mobile styling and edit panels could not be switched directly — had to close one before opening the other. Bottom bar buttons are now toggles with mutual exclusion
- Mobile drawer panels cut off at the bottom — content now fills the full available height down to the navigation bar
- Mobile styling panel couldn't scroll to the last items — scroll area now accounts for the fixed bottom navigation bar
- Letter-by-letter text fade in now works in 3D depth mode — both behind and front text layers support per-character reveal and chunk fade-out
- Mobile transcript panel height was capped at 384px (max-h-96) — removed the cap on mobile so the list fills the drawer

### Removed

- Removed redundant "Subtitles behind person" toggle — its functionality is fully covered by the "Dynamic depth 3D" toggle

---

## [1.5.0] — 2026-02-25 — Knockout Text Effect & New Font

### Added

- Knockout text effect — per-word style option that makes the text shape reveal an inverted/negative version of the video behind it
- Knockout toggle in the word style popover under a new 'Effect' section
- Knockout renders in DOM preview (mix-blend-mode: difference), canvas compositing (3D depth mode), and video export
- Lilita One font — thick, bold display font with a magazine-cover aesthetic, great for knockout effects

---

## [1.4.1] — 2026-02-25 — Mobile Bug Fixes

### Added

- Toast notifications for background removal errors — shows a clear message when WebGPU/WASM is unavailable instead of silently failing

### Fixed

- Footer 'Powered by' row no longer overflows on small screens — items wrap and bullet separators hide on mobile
- Video freezing on mobile after transcription — unhandled play() promise rejections from autoplay policy now caught on all play/pause controls

---

## [1.4.0] — 2026-02-25 — Camera Recording, Custom Player & Bug Fixes

### Added

- Camera recording — record video directly from your camera (front or back) with a 'Record video' button on the landing page
- Records straight to MP4 using MediaBunny (H.264 + AAC) — no WebM conversion needed
- Camera flip button to switch between front and back cameras on mobile
- Review screen after recording with re-record and 'Use this video' options
- Custom player controls (play/pause, seek bar, time, mute) shown consistently in all modes
- Click anywhere on the video to play/pause
- Umami analytics integration
- Powered by Transformers.js and MediaBunny attribution with logos in the footer

### Changed

- Removed native browser video controls — custom controls prevent subtitles from covering playback buttons
- Landing hero tagline updated from 'Free forever' to 'Free'

### Fixed

- Selecting the 500MB model caused a blank screen — base model preload raced with the user's model choice, resolving the wrong download promise
- Added load ID tracking so stale model 'ready' messages from previous downloads can't resolve the wrong promise
- Cancelling the language modal on a fresh upload now returns to the landing page instead of showing a dead-end video screen
- Subtitle text appearing/disappearing no longer causes layout jumps — placeholder space is always reserved
- Word chip bar in compositing mode no longer causes layout shifts between phrases

---

## [1.3.1] — 2026-02-25 — 3D Depth Export Performance Fix

### Fixed

- Video export with 3D depth enabled was re-running MODNet AI inference on every frame at 30fps (~1,800 calls per minute of video) — now uses pre-computed 5fps mask cache, reducing export time from ~15 minutes to under a minute
- Export with 3D depth consumed ~2GB+ RAM from per-frame 8MB getImageData allocations and data copies to the AI worker — eliminated entirely by using cached masks

---

## [1.3.0] — 2026-02-24 — Word Chip Bar & Auto 3D Depth

### Added

- Word chip bar — clickable word buttons appear below the video when 3D depth mode is active, letting you select any word for per-word styling
- Words with custom style overrides are highlighted with an amber tint in the chip bar

### Changed

- 3D depth mode now auto-enables when background removal starts — no extra toggle needed
- Per-word selection in 3D/bg-removal mode uses the reliable chip bar instead of canvas click coordinates
- Font mapping table (24 entries) extracted to a single module-level constant — was duplicated in 5 functions and recreated per-frame during export

### Fixed

- Clicking anywhere on the canvas in 3D mode no longer incorrectly triggers word editing
- Hidden and disabled words can no longer be selected for editing
- Major memory leak in video export — frame pixel data (~8MB) was allocated per-frame instead of reusing an offscreen canvas via GPU blit
- AudioContext not closed on error during export, leaking audio memory
- Reusable canvases and buffers from export were never released after completion, staying in memory indefinitely

### Removed

- Removed dead hitTestOnly prop from VideoCaption and unused renderDynamicWordToCanvas function

---

## [1.2.0] — 2026-02-24 — Per-Word Styling & Preset Preview

### Added

- Per-word custom styling — click any word in the video preview to override its font, size, and color independently
- Word style popover with font family picker, size multiplier (50%–200%), color picker, and reset button
- Selected word highlight with yellow outline in the video preview
- Per-word overrides render correctly in both the live preview and exported video

### Changed

- Preset buttons now render with their actual font — Bangers for Green, Permanent Marker for Gold, Outfit for Subtitle, Bebas Neue for Gamer
- Preset buttons show the correct font weight so you can preview the style before applying

---

## [1.1.0] — 2026-02-24 — Landing Page Redesign & Performance

### Added

- New landing page with hero section, feature highlights, how-it-works flow, local processing showcase, and call-to-action
- Full-page drag-and-drop — drop a video anywhere on the landing page to get started
- Drag-over visual feedback on the dropzone with amber highlight
- Changelog page at /changelog with version history
- "Buy me a coffee" floating button
- Site footer matching getbasedapps design with version link

### Changed

- Redesigned feature cards with playful visual representations — waveform bars, layered text, font samples, language globe
- Subtitle style presets now use dynamic fonts (Bangers, Permanent Marker, Bebas Neue, Outfit) instead of generic system fonts
- Default subtitle font size changed to Small for a cleaner look
- Subtitle styling panel now uses Outfit font with consistent rounded-lg buttons and amber accent colors
- Style presets now visible in dynamic (3D) mode for consistent styling
- Subtitle preview pinned above the scroll area so it's always visible while adjusting settings
- Editor buttons and panels updated to match the new landing page design

### Fixed

- Major memory leak — Whisper model (~1GB) now freed after transcription completes instead of staying in memory
- Major memory leak — background removal model (~500MB-1GB) now freed after processing completes
- Mask data was duplicated in both a ref and React state (~2x memory usage) — removed unused state copy
- Canvas render loop now skips redundant draws when video is paused, saving significant CPU
- ImageData allocation (~8MB) was created every frame at 60fps — now reused across frames
- Temporary canvases in video export now reused across frames instead of recreated per-frame

### Removed

- Removed purple color accents — replaced with amber tones throughout

---

## [1.0.0] — 2026-02-24 — Initial Release

### Added

- AI-powered subtitle generation using Whisper.js — runs 100% locally in the browser via WebGPU/WASM
- Multi-language transcription supporting 100+ languages with selectable Whisper model sizes (tiny, base, small)
- Background removal with AI person segmentation — processes video frames locally without any uploads
- Dynamic 3D subtitles — place text behind or in front of people with depth effects
- Follow-word mode for dynamic subtitles — text tracks the position of the spoken word
- 25+ Google Fonts including Bangers, Montserrat, Bebas Neue, Poppins, Oswald, Anton, Fredoka, Permanent Marker, Pacifico, and more
- Full subtitle styling controls — font, size, weight, color, background, border, drop shadow, word emphasis
- Word-by-word and phrase display modes with configurable max words per line
- Subtitle position control (top, middle, bottom) with adjustable Y positioning for dynamic mode
- Video export with baked-in subtitles using Mediabunny — downloads MP4 with subtitles permanently rendered
- Landscape (16:9) and portrait (9:16) aspect ratio modes with zoom toggle for portrait
- Editable transcript sidebar — click any segment to modify the transcribed text
- Language selection modal with model size picker before transcription starts
- Mobile-responsive design with drawer navigation for styling and transcript editing
- Works offline after first load — all AI models are cached in the browser
- Free to use — no sign-up, no watermarks, no data collection
