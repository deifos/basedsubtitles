"use client";

import type { JSX } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BookOpen, ShieldCheck } from "lucide-react";

export interface HeaderNavLink {
  href: string;
  label: string;
}

interface HeaderBadge {
  icon: LucideIcon;
  label: string;
}

interface LandingHeaderProps {
  navLinks: HeaderNavLink[];
  docsHref?: string;
  docsLabel?: string;
  badges?: HeaderBadge[];
}

const DEFAULT_BADGES: HeaderBadge[] = [
  { icon: ShieldCheck, label: "100% Local" },
];

export function LandingHeader({
  navLinks,
  docsHref = "#",
  docsLabel = "Docs",
  badges = DEFAULT_BADGES,
}: LandingHeaderProps): JSX.Element {
  return (
    <header className="relative">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex items-center justify-between py-6">
          <Link href="#" className="inline-flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-sm font-medium tracking-tight text-white">
              LS
            </span>
            <span className="text-sm font-medium tracking-tight text-slate-900">
              Local Subtitles
            </span>
          </Link>
          <nav className="hidden items-center gap-6 sm:flex">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm text-slate-600 transition-colors hover:text-slate-900"
              >
                {link.label}
              </Link>
            ))}
          </nav>
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
            <Link
              href={docsHref}
              className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
            >
              <BookOpen className="h-4 w-4" strokeWidth={1.5} />
              {docsLabel}
            </Link>
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
