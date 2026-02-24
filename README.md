This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Domain

https://basedsubs.getbasedapps.com

## Architecture

### Subtitle Generation

Uses [Transformers.js](https://huggingface.co/docs/transformers.js) with OpenAI Whisper models running entirely in the browser (WebGPU/WASM). No server-side processing.

**Flow:**
```
Video File → Extract Audio (Web Worker) → Whisper Transcription → TranscriptChunks[]
```

**Models Available:**
- Tiny (~75MB) - Fastest, lower accuracy
- Base (~150MB) - Balanced (default)
- Small (~500MB) - Most accurate, slower

**Language Support:** 100+ languages via Whisper's multilingual models.

### Background Removal

AI person segmentation using a dedicated Web Worker. Processes video frames locally to generate masks for separating the person from the background.

**Flow:**
```
Video Frames → Background Removal Worker → Segmentation Masks → Composited Output
```

**Features:**
- Enable/disable background removal on processed video
- "Subtitle behind person" mode — text renders behind the detected person
- Dynamic 3D subtitle effects with front/back text layering

### Video Export (Mediabunny)

Uses [Mediabunny](https://github.com/nickspaargaren/mediabunny) for rendering subtitles directly onto video frames and exporting as MP4.

**Flow:**
```
Video + Subtitles + Masks → Frame-by-frame rendering → Mediabunny (MP4) → Download
```

**Export Features:**
- Baked-in subtitles (permanently rendered into the video)
- Landscape (16:9) and portrait (9:16) aspect ratios
- Portrait zoom mode for cropping
- Background removal compositing during export
- High quality 30fps MP4 output

### Project Structure

```
app/
  page.tsx                  # Home page (renders AppRoot)
  layout.tsx                # Root layout with 25+ Google Fonts
  worker.ts                 # Transcription Web Worker (Whisper.js)
  bg-removal-worker.ts      # Background removal Web Worker
  sitemap.ts                # SEO sitemap
  changelog/
    page.tsx                # Changelog page

components/
  app-root.tsx              # State toggle: Landing ↔ Editor
  main-app.tsx              # Main editor application
  site-footer.tsx           # Footer (Built by Vlad, version, getbasedapps)
  buy-me-coffee.tsx         # Floating coffee button
  video-upload.tsx          # Video player with subtitle overlay
  video-caption.tsx         # Subtitle rendering on canvas
  subtitle-styling.tsx      # Full styling controls panel
  transcript-sidebar.tsx    # Editable transcript list
  transcript.tsx            # Transcript data display
  processing-overlay.tsx    # Loading overlay with progress
  language-selector.tsx     # Language dropdown
  language-selection-modal.tsx # Modal for language + model selection
  landing-page/
    landing-page.tsx        # Landing page composition
    landing-header.tsx      # Header with nav
    landing-hero.tsx        # Hero section with dropzone
    landing-dropzone.tsx    # Drag-and-drop video upload
    landing-features.tsx    # Feature highlights grid
    landing-local.tsx       # "Runs locally" section
    landing-how-it-works.tsx # 3-step flow
    landing-cta.tsx         # Call to action
  ui/                       # Radix UI components (shadcn/ui)

hooks/
  useTranscription.ts       # Whisper transcription via Web Worker
  useBackgroundRemoval.ts   # Background removal via Web Worker
  useVideoDownloadMediaBunny.ts # Video export with Mediabunny

lib/
  changelog.ts              # Version constant & changelog data
  audio-utils.ts            # Audio extraction utilities
  render-subtitle.ts        # Subtitle rendering to canvas
  utils.ts                  # Shared utilities (cn, etc.)
```

### Dependencies

#### Production

| Package | Purpose |
|---------|---------|
| `@huggingface/transformers` | Whisper AI models for local transcription |
| `@radix-ui/react-dialog` | Dialog/modal components |
| `@radix-ui/react-progress` | Progress bar |
| `@radix-ui/react-scroll-area` | Scrollable areas |
| `@radix-ui/react-select` | Select dropdowns |
| `@radix-ui/react-slider` | Slider controls |
| `@radix-ui/react-slot` | Radix slot utility |
| `@radix-ui/react-switch` | Toggle switches |
| `@radix-ui/react-tabs` | Tab components |
| `class-variance-authority` | CSS class composition |
| `clsx` | Conditional class concatenation |
| `lucide-react` | Icon library |
| `mediabunny` | Video encoding/export (MP4) |
| `next` | React framework (v15) |
| `react` / `react-dom` | React (v19) |
| `tailwind-merge` | Tailwind class deduplication |

#### Development

| Package | Purpose |
|---------|---------|
| `@eslint/eslintrc` | ESLint configuration |
| `@tailwindcss/postcss` | Tailwind CSS PostCSS plugin |
| `@types/node` | Node.js type definitions |
| `@types/react` / `@types/react-dom` | React type definitions |
| `eslint` / `eslint-config-next` | Linting |
| `tailwindcss` | Utility CSS framework (v4) |
| `tw-animate-css` | Tailwind animation utilities |
| `typescript` | TypeScript compiler |

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
