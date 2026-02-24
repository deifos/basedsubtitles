"use client";

import type { JSX } from "react";

export function BuyMeCoffee(): JSX.Element {
  return (
    <a
      href="https://www.buymeacoffee.com/vladships"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-20 right-3 lg:bottom-5 lg:right-5 z-50 inline-flex items-center justify-center gap-0 lg:gap-2 rounded-full bg-[#FFDD00] p-3 lg:px-4 lg:py-3 text-xs lg:text-sm font-semibold text-black shadow-lg transition hover:scale-105 hover:shadow-xl"
      aria-label="Buy me a coffee"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
        <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
        <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
        <line x1="6" x2="6" y1="2" y2="4"/>
        <line x1="10" x2="10" y1="2" y2="4"/>
        <line x1="14" x2="14" y1="2" y2="4"/>
      </svg>
      <span className="hidden lg:inline">Buy me a coffee</span>
    </a>
  );
}
