"use client";

import type { JSX } from "react";
import { ShieldCheck, WifiOff, Sparkles } from "lucide-react";
import { GitHubIcon } from "@/components/icons/github-icon";

import { LandingDropzone } from "./landing-dropzone";

interface LandingHeroProps {
  onVideoSelect?: (file: File) => void;
}

export function LandingHero({ onVideoSelect }: LandingHeroProps): JSX.Element {
  return (
    <section className="relative overflow-hidden pt-8 pb-20 sm:pt-16 sm:pb-28 lg:min-h-[88vh] lg:flex lg:flex-col lg:justify-center">
      {/* Dot grid pattern background */}
      <div
        className="pointer-events-none absolute inset-0 -z-20"
        style={{
          backgroundImage:
            "radial-gradient(circle, #c7cbd1 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Fade edges */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background" />
      </div>

      <div className="mx-auto max-w-7xl px-6">
        {/* Pill badge */}
        <div className="flex justify-center lg:justify-start mb-5 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <a
            href="https://github.com/deifos/basedsubtitles"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-4 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm hover:border-border hover:text-foreground transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" strokeWidth={2} />
            Free &middot; No sign-up &middot; No watermarks &middot;{" "}
            <span className="inline-flex items-center gap-1">
              <GitHubIcon width={12} height={12} />
              Open Source
            </span>
          </a>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-12 lg:gap-20 items-center">
          {/* Left: copy + dropzone */}
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            <h1
              className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-foreground leading-[1.05]"
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
              className="mt-4 text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              Drop a video. Get AI-generated subtitles in seconds. Everything
              happens on your device — nothing is ever uploaded.
            </p>

            {/* Trust indicators */}
            <div className="flex flex-wrap gap-4 mt-5 animate-in fade-in slide-in-from-bottom-3 duration-500 delay-300">
              {[
                { icon: ShieldCheck, text: "No data leaves your device" },
                { icon: WifiOff, text: "Works offline" },
                { icon: Sparkles, text: "Powered by Whisper AI" },
              ].map(({ icon: Icon, text }) => (
                <span
                  key={text}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                  style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                >
                  <Icon className="h-3 w-3" strokeWidth={1.5} />
                  {text}
                </span>
              ))}
              <a
                href="https://github.com/deifos/basedsubtitles"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                style={{ fontFamily: "var(--font-outfit), sans-serif" }}
              >
                <GitHubIcon width={12} height={12} />
                Open source on GitHub
              </a>
            </div>

            {/* Dropzone */}
            <div
              id="dropzone"
              className="mt-8 animate-in fade-in zoom-in-95 duration-700 delay-200"
            >
              <div className="rounded-2xl bg-background shadow-xl ring-1 ring-border">
                <LandingDropzone onVideoSelect={onVideoSelect} />
              </div>
            </div>
          </div>

          {/* Right: app screenshot */}
          <div className="hidden lg:block animate-in fade-in slide-in-from-right-8 duration-700 delay-200 lg:-mr-12">
            <div className="rounded-2xl overflow-hidden shadow-2xl ring-1 ring-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/hero-image.webp"
                alt="Based Subtitles app — AI subtitle editor in the browser"
                className="w-full h-auto block"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
