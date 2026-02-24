"use client";

import type { JSX } from "react";
import Link from "next/link";

export function LandingHeader(): JSX.Element {
  return (
    <header className="relative z-10">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex items-center justify-between py-5">
          <Link href="#" className="inline-flex items-center gap-2.5 group">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold tracking-tight text-white transition-transform group-hover:scale-105">
              BS
            </span>
            <span
              className="text-sm font-semibold tracking-tight text-slate-900"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              basedsubtitles
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200/60">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              100% Local
            </span>
            <a
              href="#dropzone"
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-lg"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              Get Started
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
