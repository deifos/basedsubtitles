# BasedSubtitles

AI-powered subtitle generator that runs 100% in your browser. No uploads, no servers, no accounts.

- Transcribes video audio using [Whisper.js](https://huggingface.co/docs/transformers.js) (WebGPU/WASM)
- Exports MP4 with subtitles baked in using [Mediabunny](https://mediabunny.dev/)
- Works offline after first load (models are cached by the browser)

Live at [basedsubs.getbasedapps.com](https://basedsubs.getbasedapps.com)

## AI Models

All models run locally in the browser — no data ever leaves your device.

| Model                             | Task                                            | Library                                   |
| --------------------------------- | ----------------------------------------------- | ----------------------------------------- |
| **Whisper** (tiny / base / small) | Speech-to-text transcription, 100+ languages    | `@huggingface/transformers` (WebGPU/WASM) |
| **MODNet** (`Xenova/modnet`)      | Background removal — person segmentation        | `@huggingface/transformers` (Web Worker)  |
| **MediaPipe Blaze Face**          | Real-time face detection for subtitle placement | `@mediapipe/tasks-vision`                 |

## Features

- **100% local** — audio never leaves your device
- **100+ languages** — Whisper multilingual models (tiny/base/small)
- **25+ Google Fonts** — Bangers, Bebas Neue, Permanent Marker, Montserrat, and more
- **Per-word styling** — override font, size, color, and effects on individual words
- **Emoji replace / overlay** — swap a word for an emoji or float one above it
- **Background removal** — AI person segmentation, runs locally via Web Worker
- **3D depth effect** — subtitles render behind or in front of the detected person
- **Face tracking** — MediaPipe Blaze Face, real-time EMA-smoothed position
- **Split subtitle mode** — phrase words placed above/below or left/right of the face
- **Display on Spoken** — words light up as each one is spoken (karaoke style)
- **Portrait / landscape** — 9:16 and 16:9 export with portrait zoom/crop
- **Camera recording** — record directly from front or back camera
- **MP4 export** — baked subtitles, H.264 + AAC, 30fps

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm run build   # production build
npm run lint    # ESLint
npm run format  # Prettier
```

## Architecture

### Subtitle Generation

Whisper models run in a dedicated Web Worker (`app/worker.ts`) via `@huggingface/transformers`. Audio is extracted from the video file client-side and passed as a `Float32Array`. No network requests occur after the model is cached.

```
Video File → audio-utils (Web Worker) → Float32Array → Whisper Worker → TranscriptChunks[]
```

Models available:
| Name | Size | Notes |
|------|------|-------|
| Tiny | ~75 MB | Fastest |
| Base | ~150 MB | Default |
| Small | ~500 MB | Most accurate |

#### Streaming transcription — how it works

The `@huggingface/transformers` ASR pipeline processes the whole audio then merges at the end, with no built-in way to get partial results per chunk. To support long videos and live previews, `app/worker.ts` replicates the pipeline's internal `_call_whisper` loop directly:

1. **Chunk the audio** using the same 30s window / 5s stride / 20s jump that the pipeline uses internally.
2. **Call `model.generate()`** on each chunk with:
   - `return_timestamps: true` — embeds timestamp tokens in the output sequence. `_decode_asr` requires these to detect where each chunk's usable region starts and ends (stride filtering via `first_timestamp` / `last_timestamp`). Without them, multi-chunk merging silently skips content.
   - `return_token_timestamps: true` — uses DTW cross-attention alignment to produce per-token timestamps, enabling word-level output from `_decode_asr`.
3. **Call `tokenizer._decode_asr(processedSoFar, { return_timestamps: "word" })`** after each chunk. This does stride-aware merging of all chunks processed so far and posts a partial `update` result to the main thread.
4. After all chunks are processed, the final `_decode_asr` call produces the complete transcript.

This approach gives accuracy identical to the single full pipeline call (same chunking math, same merge logic) while streaming word-level results chunk by chunk.

#### Why not use the high-level pipeline call?

`transcriber(audio, { chunk_length_s: 30, stride_length_s: 5 })` processes all chunks, then merges once at the end. The old `@xenova/transformers` library exposed a `chunk_callback` fired after each internal chunk; `@huggingface/transformers` does not. Replicating the internal loop is the only way to stream results.

### Background Removal

A second Web Worker runs **MODNet** (`Xenova/modnet`) for AI person segmentation on video frames and returns masks at 5fps. The masks are cached and reused at 30fps during both preview and export.

```
Video Frames → BG Removal Worker → Masks[] → Composited Canvas
```

### Face Tracking

**MediaPipe Blaze Face** runs in the main thread, scanning frames at ~5fps. Position is smoothed with an EMA filter (α = 0.15). During export, a 150ms lookahead compensates for EMA phase lag.

### Rendering Pipeline

| Mode                          | How                                                            |
| ----------------------------- | -------------------------------------------------------------- |
| Plain preview                 | DOM `VideoCaption` component (CSS + HTML)                      |
| Compositing (BG removal / 3D) | Canvas loop → `lib/render-subtitle.ts`                         |
| Export                        | `hooks/useVideoDownloadMediaBunny.ts` internal canvas renderer |

The preview and export renderers share font resolution logic via `lib/font-config.ts`.

### Video Export

Mediabunny renders each frame to an offscreen canvas, composites subtitles (and optionally masks), then encodes to MP4. Export is capped at 1080p on mobile to stay within canvas memory limits.

```
Video + Subtitles + Masks → frame-by-frame canvas render → Mediabunny → MP4 download
```

## Project Structure

```
app/
  page.tsx                    # Home page
  layout.tsx                  # Root layout (Google Fonts, analytics)
  worker.ts                   # Transcription Web Worker (Whisper)
  bg-removal-worker.ts        # Background removal Web Worker
  changelog/page.tsx          # Changelog page

components/
  main-app.tsx                # Main editor — all state lives here
  video-upload.tsx            # Video player + compositing canvas
  video-caption.tsx           # DOM subtitle renderer
  subtitle-styling.tsx        # Style controls panel
  transcript-sidebar.tsx      # Editable transcript list
  word-style-popover.tsx      # Per-word style overrides
  landing-page/               # Landing page components
  ui/                         # shadcn/ui primitives

hooks/
  useTranscription.ts         # Whisper via Web Worker
  useBackgroundRemoval.ts     # BG removal via Web Worker
  useFaceTracking.ts          # MediaPipe face detection
  useVideoDownloadMediaBunny.ts # Video export
  useCameraRecording.ts       # Camera input

lib/
  font-config.ts              # Shared font map (CSS vars → canvas names)
  render-subtitle.ts          # Canvas subtitle rendering (preview)
  person-tracking.ts          # Face position interpolation
  audio-utils.ts              # Audio extraction
  utils.ts                    # cn(), formatTime(), processTranscriptChunks()
  changelog.ts                # Version history data
```

## Adding a Font

1. Add the Google Font import to `app/layout.tsx`
2. Add the CSS variable → font name entry to `lib/font-config.ts`
3. Add the font as an option in `components/subtitle-styling.tsx`

## Contributing

Pull requests are welcome. For larger changes, open an issue first to discuss the approach.

```bash
npm run lint         # check for lint errors
npm run format:check # check formatting
npm run format       # auto-fix formatting
```

## Dependencies

| Package                     | Purpose                          |
| --------------------------- | -------------------------------- |
| `@huggingface/transformers` | Whisper AI transcription (local) |
| `@mediapipe/tasks-vision`   | Face detection                   |
| `mediabunny`                | MP4 video encoding               |
| `next`                      | React framework (v15)            |
| `react` / `react-dom`       | React v19                        |
| `@radix-ui/*`               | Accessible UI primitives         |
| `emoji-picker-react`        | Emoji picker                     |
| `lucide-react`              | Icons                            |
| `sonner`                    | Toast notifications              |
| `tailwindcss`               | Utility CSS (v4)                 |

## License

MIT — see [LICENSE](./LICENSE).
