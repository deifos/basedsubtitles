"use client";

import type { JSX } from "react";
import Image from "next/image";
import Link from "next/link";
import { APP_VERSION } from "@/lib/changelog";

export function SiteFooter(): JSX.Element {
  return (
    <footer className="bg-white border-t-2 border-black/10 flex-shrink-0">
      <div className="container mx-auto px-6 py-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-black/40">
                Built by
              </span>
              <a
                href="https://x.com/deifosv"
                className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-black hover:underline underline-offset-4 decoration-2"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Image
                  src="/vlad-pfp.jpg"
                  alt="Vlad"
                  width={24}
                  height={24}
                  className="rounded-full border border-black/20"
                />
                Vlad
              </a>
            </div>
            <span className="hidden sm:inline text-black/20">&bull;</span>
            <Link
              href="/changelog"
              className="text-xs font-bold uppercase tracking-widest text-black/40 hover:text-black transition-colors"
            >
              v{APP_VERSION}
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-black/40">
              Part of
            </span>
            <a
              href="https://getbasedapps.com"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-black bg-black text-white text-xs font-bold uppercase tracking-wider hover:bg-white hover:text-black transition-colors duration-200"
              target="_blank"
              rel="noopener noreferrer"
            >
              getbasedapps
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
