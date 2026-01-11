"use client";

import type { JSX } from "react";
import type { LucideIcon } from "lucide-react";
import { Cpu, HardDrive, Languages, Lock, Shield, Zap } from "lucide-react";

import { SiteFooter } from "@/components/site-footer";

import { LandingHeader, type HeaderNavLink } from "./landing-header";
import { LandingHero } from "./landing-hero";

interface LandingPageProps {
  onVideoSelect?: (file: File) => void;
}

type HeroHighlights = Parameters<typeof LandingHero>[0]["highlights"];

const NAV_LINKS: HeaderNavLink[] = [
  { href: "#", label: "How it works" },
  { href: "#", label: "Docs" },
  { href: "#", label: "GitHub" },
];

const HERO_HIGHLIGHTS: HeroHighlights = [
  { icon: Shield, label: "No uploads" },
  { icon: Cpu, label: "Runs on your device" },
  { icon: HardDrive, label: "Keep your files private" },
];

const TRUST_BADGES: Array<{ icon: LucideIcon; label: string }> = [
  { icon: Lock, label: "End-to-end local processing" },
  { icon: Languages, label: "Multi-language ready" },
  { icon: Zap, label: "Fast on modern CPUs" },
];

export function LandingPage({ onVideoSelect }: LandingPageProps): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-800">
      <LandingHeader navLinks={NAV_LINKS} />
      <main className="flex-1 flex flex-col items-center justify-center">
        <LandingHero
          highlights={HERO_HIGHLIGHTS}
          onVideoSelect={onVideoSelect}
        />
        <TrustBar />
      </main>
      <SiteFooter />
    </div>
  );
}

function TrustBar(): JSX.Element {
  return (
    <section className="pb-16">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
          {TRUST_BADGES.map((badge) => (
            <span
              key={badge.label}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1"
            >
              <badge.icon className="h-3.5 w-3.5" strokeWidth={1.5} />
              {badge.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
