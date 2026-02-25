"use client";

import type { JSX } from "react";
import { ShieldCheck, WifiOff, Sparkles } from "lucide-react";

import { LandingDropzone } from "./landing-dropzone";

interface LandingHeroProps {
  onVideoSelect?: (file: File) => void;
}

export function LandingHero({ onVideoSelect }: LandingHeroProps): JSX.Element {
  return (
    <section className="relative overflow-hidden pt-4 pb-12 sm:pt-6 sm:pb-16">
      {/* Dot grid pattern background */}
      <div
        className="pointer-events-none absolute inset-0 -z-20"
        style={{
          backgroundImage: "radial-gradient(circle, #c7cbd1 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Fade edges so pattern doesn't start/end abruptly */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-transparent to-white" />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-transparent to-white" />
      </div>

      <div className="mx-auto max-w-7xl px-6">
        {/* Pill badge */}
        <div className="flex justify-center mb-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-1.5 text-xs font-medium text-slate-600 shadow-sm backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" strokeWidth={2} />
            Free &middot; No sign-up &middot; No watermarks
          </span>
        </div>

        {/* Headline */}
        <div className="text-center max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-slate-900 leading-[1.05]"
            style={{ fontFamily: "var(--font-outfit), sans-serif" }}
          >
            Subtitles that run{" "}
            <span className="relative inline-block">
              <span className="relative z-10">in your browser</span>
              <span
                className="absolute -bottom-0.5 left-0 right-0 h-[0.2em] bg-amber-300/60 rounded-full -z-0"
                aria-hidden
              />
            </span>
          </h1>

          <p
            className="mt-4 text-base sm:text-lg text-slate-500 max-w-xl mx-auto leading-relaxed"
            style={{ fontFamily: "var(--font-outfit), sans-serif" }}
          >
            Drop a video. Get AI-generated subtitles in seconds.
            Everything happens on your device — nothing is ever uploaded.
          </p>
        </div>

        {/* Trust indicators */}
        <div className="flex flex-wrap justify-center gap-4 mt-5 animate-in fade-in slide-in-from-bottom-3 duration-500 delay-300">
          {[
            { icon: ShieldCheck, text: "No data leaves your device" },
            { icon: WifiOff, text: "Works offline" },
            { icon: Sparkles, text: "Powered by Whisper AI" },
          ].map(({ icon: Icon, text }) => (
            <span
              key={text}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              <Icon className="h-3 w-3" strokeWidth={1.5} />
              {text}
            </span>
          ))}
        </div>

        {/* Dropzone */}
        <div
          id="dropzone"
          className="mt-8 max-w-lg mx-auto animate-in fade-in zoom-in-95 duration-700 delay-200"
        >
          <div className="rounded-2xl bg-white shadow-xl shadow-slate-200/50 ring-1 ring-slate-100">
            <LandingDropzone onVideoSelect={onVideoSelect} />
          </div>
        </div>
      </div>
    </section>
  );
}
