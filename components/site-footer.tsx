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
    <footer className={`border-t border-border/40 bg-background ${className}`}>
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-6 text-center sm:flex-row sm:text-left">
        {leftContent ?? defaultLeft}
        {rightContent ?? defaultRight}
      </div>
    </footer>
  );
}

export type { FooterLink };
