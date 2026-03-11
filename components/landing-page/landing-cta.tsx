"use client";

import type { JSX } from "react";
import { ArrowUp } from "lucide-react";

export function LandingCTA(): JSX.Element {
  return (
    <section className="relative py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="relative rounded-2xl bg-primary px-8 py-14 sm:px-14 sm:py-16 text-center overflow-hidden shadow-2xl">
          {/* Dot pattern overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "radial-gradient(circle, #ffffff 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
          {/* Gradient orbs */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-amber-400/10 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full bg-blue-400/10 blur-3xl" />
          </div>

          <div className="relative z-10">
            <h2
              className="text-3xl sm:text-4xl font-bold tracking-tight text-primary-foreground"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              Ready to add subtitles?
            </h2>
            <p
              className="mt-3 text-sm sm:text-base text-muted-foreground max-w-md mx-auto"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              Drop your video above and get started in seconds. No account
              needed.
            </p>
            <a
              href="#dropzone"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-background px-5 py-2.5 text-sm font-semibold text-foreground shadow-lg transition-all hover:bg-amber-50 hover:shadow-xl hover:-translate-y-0.5"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2} />
              Scroll to dropzone
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
