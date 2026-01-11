"use client";

import type { JSX } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ShieldCheck } from "lucide-react";

interface HeaderBadge {
  icon: LucideIcon;
  label: string;
}

interface LandingHeaderProps {
  badges?: HeaderBadge[];
}

const DEFAULT_BADGES: HeaderBadge[] = [
  { icon: ShieldCheck, label: "100% Local" },
];

export function LandingHeader({
  badges = DEFAULT_BADGES,
}: LandingHeaderProps = {}): JSX.Element {
  return (
    <header className="relative">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex items-center justify-between py-6">
          <Link href="#" className="inline-flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-sm font-medium tracking-tight text-white">
              BS
            </span>
            <span className="text-sm font-medium tracking-tight text-slate-900">
              basedsubtitles
            </span>
          </Link>
          <div className="flex items-center gap-3">
            {badges.map((badge) => (
              <span
                key={badge.label}
                className="hidden items-center rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-600 sm:inline-flex"
              >
                <badge.icon className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.5} />
                {badge.label}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div
        aria-hidden={true}
        className="pointer-events-none absolute inset-x-0 top-0 -z-10"
      >
        <div className="mx-auto max-w-7xl px-6">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        </div>
      </div>
    </header>
  );
}
