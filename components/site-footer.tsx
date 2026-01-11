"use client";

import type { JSX, ReactNode } from "react";
import Link from "next/link";

interface FooterLink {
  href: string;
  label: string;
  external?: boolean;
}

interface SiteFooterProps {
  ownerName?: string;
  navLinks?: FooterLink[];
  leftContent?: ReactNode;
  rightContent?: ReactNode;
  className?: string;
}

const DEFAULT_NAV_LINKS: FooterLink[] = [];

const DEFAULT_AUTHOR_LINK = {
  href: "https://x.com/deifosv",
  label: "@deifosv",
};

export function SiteFooter({
  ownerName = "Based Subtitles",
  navLinks,
  leftContent,
  rightContent,
  className = "",
}: SiteFooterProps): JSX.Element {
  const currentYear = new Date().getFullYear();
  const resolvedNavLinks = navLinks ?? DEFAULT_NAV_LINKS;

  const defaultLeft = (
    <p className="text-xs text-muted-foreground">
      © {currentYear} {ownerName}. Built by{" "}
      <a
        href={DEFAULT_AUTHOR_LINK.href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-semibold text-primary hover:text-primary/80"
      >
        {DEFAULT_AUTHOR_LINK.label}
      </a>
      .
    </p>
  );

  const defaultRight = resolvedNavLinks.length > 0 ? (
    <nav className="flex items-center gap-4 text-xs text-muted-foreground">
      {resolvedNavLinks.map((link) => (
        <Link
          key={link.label}
          href={link.href}
          target={link.external ? "_blank" : undefined}
          rel={link.external ? "noopener noreferrer" : undefined}
          className="transition-colors hover:text-foreground"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  ) : null;

  return (
    <>
      <footer className={`border-t border-border/40 bg-background ${className}`}>
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-6 text-center sm:flex-row sm:text-left">
          {leftContent ?? defaultLeft}
          {rightContent ?? defaultRight}
        </div>
      </footer>
      <a
        href="https://www.buymeacoffee.com/vladships"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-24 right-3 lg:bottom-5 lg:right-5 z-50 inline-flex items-center gap-1.5 lg:gap-2 rounded-full bg-[#FFDD00] px-3 py-2 lg:px-4 lg:py-3 text-xs lg:text-sm font-semibold text-black shadow-lg transition hover:scale-105 hover:shadow-xl"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
          <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
          <line x1="6" x2="6" y1="2" y2="4"/>
          <line x1="10" x2="10" y1="2" y2="4"/>
          <line x1="14" x2="14" y1="2" y2="4"/>
        </svg>
        Buy me a coffee
      </a>
    </>
  );
}

export type { FooterLink };
