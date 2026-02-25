"use client";

import type { JSX } from "react";
import {
  Captions,
  Eraser,
  Layers3,
  Type,
  Languages,
  Download,
  WifiOff,
  BadgeCheck,
  Camera,
  Globe,
  Sparkles,
} from "lucide-react";

export function LandingFeatures(): JSX.Element {
  return (
    <section className="relative py-16 sm:py-24 bg-white">
      <div className="mx-auto max-w-7xl px-6">
        {/* Section header */}
        <div className="max-w-2xl mb-12">
          <span
            className="text-xs font-semibold uppercase tracking-widest text-amber-600"
            style={{ fontFamily: "var(--font-outfit), sans-serif" }}
          >
            Features
          </span>
          <h2
            className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900"
            style={{ fontFamily: "var(--font-outfit), sans-serif" }}
          >
            Everything you need,
            <br />
            nothing you don&apos;t.
          </h2>
        </div>

        {/* Feature grid — playful bento with visual representations */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* AI Subtitle Generation — Large hero card */}
          <div className="sm:col-span-2 lg:col-span-2 group relative rounded-2xl border border-slate-200/80 bg-gradient-to-br from-blue-50 to-white p-6 shadow-sm transition-all hover:shadow-lg hover:shadow-blue-100/60 hover:-translate-y-0.5 overflow-hidden">
            <div className="flex flex-col items-center sm:flex-row sm:items-center gap-6">
              <div className="relative shrink-0">
                {/* Big visual: subtitle text over waveform-like bars */}
                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-2xl bg-blue-100/60 flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-x-4 bottom-4 space-y-1">
                    <div className="h-1.5 bg-blue-300/50 rounded-full w-full" />
                    <div className="h-1.5 bg-blue-300/50 rounded-full w-3/4" />
                    <div className="h-1.5 bg-blue-300/50 rounded-full w-5/6" />
                    <div className="h-1.5 bg-blue-300/50 rounded-full w-2/3" />
                  </div>
                  <Captions className="h-14 w-14 text-blue-500 relative z-10" strokeWidth={1.2} />
                </div>
              </div>
              <div className="text-center sm:text-left">
                <h3
                  className="text-lg font-bold text-slate-900"
                  style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                >
                  AI Subtitle Generation
                </h3>
                <p
                  className="mt-2 text-sm text-slate-500 leading-relaxed max-w-sm"
                  style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                >
                  Powered by Whisper.js running entirely in your browser. State-of-the-art speech recognition, zero cloud dependency.
                </p>
                <div className="mt-3 flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-blue-500" />
                  <span className="text-xs font-semibold text-blue-600" style={{ fontFamily: "var(--font-outfit), sans-serif" }}>
                    WebGPU accelerated
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Background Removal */}
          <div className="group relative rounded-2xl border border-slate-200/80 bg-gradient-to-br from-rose-50 to-white p-6 shadow-sm transition-all hover:shadow-lg hover:shadow-rose-100/60 hover:-translate-y-0.5 overflow-hidden">
            <div className="relative w-full h-28 rounded-xl bg-rose-100/50 flex items-center justify-center mb-4">
              {/* Person in front, background fading */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-rose-200/30 via-transparent to-rose-200/30" />
              <Camera className="h-12 w-12 text-rose-400 relative z-10" strokeWidth={1.2} />
              <Eraser className="absolute bottom-2 right-2 h-6 w-6 text-rose-500" strokeWidth={1.5} />
            </div>
            <h3
              className="text-sm font-bold text-slate-900"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              Background Removal
            </h3>
            <p
              className="mt-1.5 text-xs text-slate-500 leading-relaxed"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              AI person segmentation that runs locally. Remove backgrounds without uploading a frame.
            </p>
          </div>

          {/* Dynamic 3D Subtitles — Visual: text layered behind icon */}
          <div className="group relative rounded-2xl border border-slate-200/80 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm transition-all hover:shadow-lg hover:shadow-amber-100/60 hover:-translate-y-0.5 overflow-hidden">
            <div className="relative w-full h-28 rounded-xl bg-amber-100/50 flex items-center justify-center mb-4">
              {/* Text behind and in front of icon */}
              <span
                className="absolute text-2xl font-black text-amber-300/60 -rotate-3 top-3 left-4 select-none"
                style={{ fontFamily: "var(--font-bangers), cursive" }}
              >
                HELLO
              </span>
              <Layers3 className="h-14 w-14 text-amber-500 relative z-10" strokeWidth={1.2} />
              <span
                className="absolute text-lg font-black text-amber-600/80 rotate-2 bottom-3 right-4 select-none z-20"
                style={{ fontFamily: "var(--font-bangers), cursive" }}
              >
                WORLD
              </span>
            </div>
            <h3
              className="text-sm font-bold text-slate-900"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              Dynamic 3D Subtitles
            </h3>
            <p
              className="mt-1.5 text-xs text-slate-500 leading-relaxed"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              Place text behind or in front of people. Cinematic depth effects that pop.
            </p>
          </div>

          {/* 25+ Fonts — Visual: font samples */}
          <div className="group relative rounded-2xl border border-slate-200/80 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm transition-all hover:shadow-lg hover:shadow-emerald-100/60 hover:-translate-y-0.5 overflow-hidden">
            <div className="relative w-full h-28 rounded-xl bg-emerald-100/40 flex flex-col items-center justify-center mb-4 gap-1">
              <span className="text-xl font-bold text-emerald-700/70 select-none" style={{ fontFamily: "var(--font-bangers), cursive" }}>Bangers</span>
              <span className="text-lg text-emerald-600/60 select-none" style={{ fontFamily: "var(--font-playfair-display), serif" }}>Playfair</span>
              <span className="text-base font-bold text-emerald-500/50 select-none" style={{ fontFamily: "var(--font-permanent-marker), cursive" }}>Marker</span>
            </div>
            <h3
              className="text-sm font-bold text-slate-900"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              25+ Fonts & Custom Styles
            </h3>
            <p
              className="mt-1.5 text-xs text-slate-500 leading-relaxed"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              Colors, shadows, emphasis effects, and word-by-word highlighting.
            </p>
          </div>

          {/* 100+ Languages */}
          <div className="group relative rounded-2xl border border-slate-200/80 bg-gradient-to-br from-sky-50 to-white p-6 shadow-sm transition-all hover:shadow-lg hover:shadow-sky-100/60 hover:-translate-y-0.5 overflow-hidden">
            <div className="relative w-full h-28 rounded-xl bg-sky-100/40 flex items-center justify-center mb-4">
              <Globe className="h-16 w-16 text-sky-400" strokeWidth={0.8} />
              <div className="absolute inset-0 flex flex-wrap items-center justify-center gap-1.5 p-3">
                {["EN", "ES", "FR", "DE", "JP", "KO", "ZH", "AR", "PT"].map((lang) => (
                  <span
                    key={lang}
                    className="text-[10px] font-bold text-sky-600/50 select-none"
                    style={{ fontFamily: "var(--font-geist-mono), monospace" }}
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>
            <h3
              className="text-sm font-bold text-slate-900"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              100+ Languages
            </h3>
            <p
              className="mt-1.5 text-xs text-slate-500 leading-relaxed"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              Whisper AI understands speech in over 100 languages out of the box.
            </p>
          </div>

          {/* Bottom row: 3 simple cards */}
          {/* Export */}
          <div className="group relative rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 ring-1 ring-slate-200/80 text-slate-600 mb-3">
              <Download className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <h3
              className="text-sm font-bold text-slate-900"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              Export with Baked-in Subs
            </h3>
            <p
              className="mt-1.5 text-xs text-slate-500 leading-relaxed"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              Download video with subtitles permanently rendered in.
            </p>
          </div>

          {/* Works Offline */}
          <div className="group relative rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 ring-1 ring-slate-200/80 text-slate-600 mb-3">
              <WifiOff className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <h3
              className="text-sm font-bold text-slate-900"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              Works Offline
            </h3>
            <p
              className="mt-1.5 text-xs text-slate-500 leading-relaxed"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              After the first load, everything is cached. Process videos anywhere.
            </p>
          </div>

          {/* Free */}
          <div className="group relative rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all hover:shadow-lg hover:shadow-slate-200/60 hover:-translate-y-0.5">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 ring-1 ring-slate-200/80 text-slate-600 mb-3">
              <BadgeCheck className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <h3
              className="text-sm font-bold text-slate-900"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              Free. No Sign-up. No Watermarks.
            </h3>
            <p
              className="mt-1.5 text-xs text-slate-500 leading-relaxed"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              No accounts, no paywalls, no limitations. Your videos, your subtitles.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
