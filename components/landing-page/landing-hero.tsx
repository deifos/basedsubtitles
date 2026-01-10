"use client";

import type { JSX } from "react";
import { BadgeCheck, LucideIcon, ShieldCheck, Sparkles, WifiOff } from "lucide-react";

import { LandingDropzone } from "./landing-dropzone";

interface LandingHighlight {
  icon: LucideIcon;
  label: string;
}

interface LandingHeroProps {
  highlights: LandingHighlight[];
  onVideoSelect?: (file: File) => void;
}

const DROPZONE_FACTS: LandingHighlight[] = [
  { icon: ShieldCheck, label: "No data leaves your device" },
  { icon: WifiOff, label: "Works offline" },
  { icon: BadgeCheck, label: "Free to use" },
];

export function LandingHero({ highlights, onVideoSelect }: LandingHeroProps): JSX.Element {
  return (
    <section className="relative">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 items-center gap-10 pb-20 pt-8 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
              Free to use • No sign-up
            </div>
            <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
              Privacy-first subtitles,
              <br className="hidden sm:block" />
              generated 100% in your browser
            </h1>
            <p className="mt-5 text-base text-slate-600 sm:text-lg">
              Drop a video and get accurate subtitles locally. Nothing is uploaded—ever. Fast, private, and works offline.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {highlights.map((highlight) => (
                <span
                  key={highlight.label}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600"
                >
                  <highlight.icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {highlight.label}
                </span>
              ))}
            </div>

            <p className="mt-8 text-sm text-slate-500">
              Drop your video on the right to start generating subtitles instantly.
            </p>
          </div>

          <div className="lg:col-span-6">
            <LandingDropzone onVideoSelect={onVideoSelect} />
            <div className="mt-6 border-t border-slate-200 pt-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {DROPZONE_FACTS.map((fact) => (
                  <span
                    key={fact.label}
                    className="flex items-center gap-2 text-xs text-slate-600"
                  >
                    <fact.icon className="h-4 w-4" strokeWidth={1.5} />
                    {fact.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div aria-hidden className="absolute inset-x-0 -z-10">
        <div className="mx-auto max-w-7xl px-6">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        </div>
      </div>
    </section>
  );
}
