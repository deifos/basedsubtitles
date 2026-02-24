"use client";

import type { JSX } from "react";

import { SiteFooter } from "@/components/site-footer";
import { BuyMeCoffee } from "@/components/buy-me-coffee";

import { LandingHeader } from "./landing-header";
import { LandingHero } from "./landing-hero";
import { LandingFeatures } from "./landing-features";
import { LandingLocal } from "./landing-local";
import { LandingHowItWorks } from "./landing-how-it-works";
import { LandingCTA } from "./landing-cta";

interface LandingPageProps {
  onVideoSelect?: (file: File) => void;
}

export function LandingPage({ onVideoSelect }: LandingPageProps): JSX.Element {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-800">
      <LandingHeader />
      <main className="flex-1">
        <LandingHero onVideoSelect={onVideoSelect} />
        <LandingFeatures />
        <LandingLocal />
        <LandingHowItWorks />
        <LandingCTA />
      </main>
      <SiteFooter />
      <BuyMeCoffee />
    </div>
  );
}
