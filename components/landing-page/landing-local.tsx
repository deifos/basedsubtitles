"use client";

import type { JSX } from "react";
import {
  Monitor,
  ServerOff,
  Lock,
  Cpu,
  HardDrive,
  ShieldCheck,
} from "lucide-react";

const PRIVACY_POINTS = [
  {
    icon: ServerOff,
    title: "No servers",
    desc: "Zero backend. Your video never touches a remote machine.",
  },
  {
    icon: Lock,
    title: "No data collection",
    desc: "We don't track, store, or analyze any of your content.",
  },
  {
    icon: Cpu,
    title: "Your CPU does the work",
    desc: "WebGPU + WASM powered AI runs on your own hardware.",
  },
  {
    icon: HardDrive,
    title: "Nothing stored",
    desc: "Files stay in memory during processing, then vanish.",
  },
] as const;

export function LandingLocal(): JSX.Element {
  return (
    <section className="relative py-16 sm:py-24 overflow-hidden">
      {/* Background with dot pattern */}
      <div className="absolute inset-0 -z-20 bg-slate-50" />
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(circle, #b0b8c4 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />
      <div className="pointer-events-none absolute inset-0 -z-[5]">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 via-transparent to-slate-50" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-50 via-transparent to-slate-50" />
      </div>

      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Left: Browser visual */}
          <div className="relative">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/30 overflow-hidden">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-300" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                </div>
                <div className="flex-1 mx-3">
                  <div className="flex items-center gap-2 rounded-md bg-white border border-slate-100 px-3 py-1 text-xs text-slate-400">
                    <Lock className="h-3 w-3" strokeWidth={2} />
                    <span
                      style={{
                        fontFamily: "var(--font-geist-mono), monospace",
                      }}
                    >
                      basedsubs.getbasedapps.com
                    </span>
                  </div>
                </div>
              </div>

              {/* Browser content */}
              <div className="p-5 sm:p-6 space-y-5">
                {/* Processing visualization */}
                <div className="flex items-center gap-3">
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-md">
                    <Monitor className="h-5 w-5" />
                    <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 ring-2 ring-white flex items-center justify-center">
                      <ShieldCheck
                        className="h-2.5 w-2.5 text-white"
                        strokeWidth={3}
                      />
                    </div>
                  </div>
                  <div>
                    <p
                      className="text-sm font-semibold text-slate-900"
                      style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                    >
                      Processing locally
                    </p>
                    <p
                      className="text-xs text-slate-500"
                      style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                    >
                      All AI models run in this browser tab
                    </p>
                  </div>
                </div>

                {/* Animated pipeline */}
                <div className="space-y-2.5">
                  {[
                    { label: "Audio extraction", color: "bg-blue-500" },
                    { label: "Whisper transcription", color: "bg-amber-500" },
                    { label: "Subtitle rendering", color: "bg-amber-500" },
                  ].map((step, i) => (
                    <div key={step.label} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span
                          className="text-xs font-medium text-slate-600"
                          style={{
                            fontFamily: "var(--font-outfit), sans-serif",
                          }}
                        >
                          {step.label}
                        </span>
                        <span
                          className="text-[10px] text-slate-400 font-medium uppercase tracking-wider"
                          style={{
                            fontFamily: "var(--font-geist-mono), monospace",
                          }}
                        >
                          local
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${step.color} animate-pulse`}
                          style={{
                            width: `${85 - i * 15}%`,
                            animationDelay: `${i * 200}ms`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Network indicator */}
                <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-emerald-200 bg-emerald-50/50 px-3 py-2.5">
                  <ServerOff
                    className="h-3.5 w-3.5 text-emerald-600 shrink-0"
                    strokeWidth={1.5}
                  />
                  <p
                    className="text-xs text-emerald-700"
                    style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                  >
                    <span className="font-semibold">0 network requests</span> —
                    all processing happens on your device
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Copy + points */}
          <div>
            <span
              className="text-xs font-semibold uppercase tracking-widest text-amber-600"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              Privacy by design
            </span>
            <h2
              className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              Your browser is
              <br />
              the entire studio.
            </h2>
            <p
              className="mt-3 text-base text-slate-500 leading-relaxed"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              No cloud. No uploads. No tracking. The AI models download once,
              then everything runs locally using WebGPU and WebAssembly. Your
              video files never leave your machine.
            </p>

            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-5">
              {PRIVACY_POINTS.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm ring-1 ring-slate-100">
                    <Icon className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p
                      className="text-sm font-semibold text-slate-900"
                      style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                    >
                      {title}
                    </p>
                    <p
                      className="mt-0.5 text-xs text-slate-500 leading-relaxed"
                      style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                    >
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
