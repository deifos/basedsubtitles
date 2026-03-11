"use client";

import type { JSX, DragEvent } from "react";
import { useCallback, useState } from "react";

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
  const [isPageDragOver, setIsPageDragOver] = useState(false);

  const handlePageDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsPageDragOver(false);
      const file = event.dataTransfer.files?.[0] ?? null;
      if (file && file.type.startsWith("video/")) {
        onVideoSelect?.(file);
      }
    },
    [onVideoSelect],
  );

  const handlePageDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsPageDragOver(true);
  }, []);

  const handlePageDragLeave = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      // Only trigger when leaving the page container itself
      if (event.currentTarget === event.target) {
        setIsPageDragOver(false);
      }
    },
    [],
  );

  return (
    <div
      className="flex min-h-screen flex-col bg-background text-foreground relative"
      onDrop={handlePageDrop}
      onDragOver={handlePageDragOver}
      onDragLeave={handlePageDragLeave}
    >
      {/* Full-page drop overlay */}
      {isPageDragOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-amber-500/10 backdrop-blur-sm pointer-events-none">
          <div className="rounded-2xl border-2 border-dashed border-amber-400 bg-background/90 px-10 py-8 shadow-2xl text-center">
            <p
              className="text-lg font-semibold text-foreground"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              Drop your video anywhere
            </p>
            <p
              className="mt-1 text-sm text-muted-foreground"
              style={{ fontFamily: "var(--font-outfit), sans-serif" }}
            >
              MP4, MOV, WebM
            </p>
          </div>
        </div>
      )}
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
