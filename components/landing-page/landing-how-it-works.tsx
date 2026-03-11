"use client";

import type { JSX } from "react";
import { Upload, Captions, Download } from "lucide-react";

const STEPS = [
  {
    number: "01",
    icon: Upload,
    title: "Drop your video",
    description:
      "Drag a video file into the browser. MP4, MOV, WebM — up to 2 hours. Nothing gets uploaded anywhere.",
    accent: "from-sky-400 to-sky-500",
    bg: "bg-sky-50",
    text: "text-sky-600",
  },
  {
    number: "02",
    icon: Captions,
    title: "Generate subtitles",
    description:
      "Whisper AI transcribes your audio locally. Customize fonts, colors, positioning, and effects.",
    accent: "from-amber-400 to-amber-500",
    bg: "bg-amber-50",
    text: "text-amber-600",
  },
  {
    number: "03",
    icon: Download,
    title: "Export your video",
    description:
      "Download your video with subtitles baked in. Share anywhere — the subs are part of the video.",
    accent: "from-emerald-400 to-emerald-500",
    bg: "bg-emerald-50",
    text: "text-emerald-600",
  },
] as const;

export function LandingHowItWorks(): JSX.Element {
  return (
    <section className="relative py-16 sm:py-24">
      {/* Dot pattern background for this section */}
      <div
        className="pointer-events-none absolute inset-0 -z-20"
        style={{
          backgroundImage:
            "radial-gradient(circle, #c7cbd1 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent to-background" />
      </div>

      <div className="mx-auto max-w-7xl px-6">
        {/* Section header */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span
            className="text-xs font-semibold uppercase tracking-widest text-amber-600"
            style={{ fontFamily: "var(--font-outfit), sans-serif" }}
          >
            How it works
          </span>
          <h2
            className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-foreground"
            style={{ fontFamily: "var(--font-outfit), sans-serif" }}
          >
            Three steps. That&apos;s it.
          </h2>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="relative text-center group rounded-2xl border border-border bg-background p-6 shadow-sm transition-all hover:shadow-lg"
              >
                {/* Step number + icon visual */}
                <div
                  className={`relative w-20 h-20 mx-auto ${step.bg} rounded-2xl flex items-center justify-center mb-5`}
                >
                  <span
                    className={`absolute -top-2 -right-2 text-xs font-black ${step.text} bg-background rounded-full w-7 h-7 flex items-center justify-center ring-2 ring-background shadow-sm`}
                    style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                  >
                    {step.number}
                  </span>
                  <div
                    className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-b ${step.accent} text-primary-foreground shadow-md`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.5} />
                  </div>
                </div>

                <h3
                  className="text-base font-semibold text-foreground"
                  style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                >
                  {step.title}
                </h3>
                <p
                  className="mt-1.5 text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto"
                  style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                >
                  {step.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
