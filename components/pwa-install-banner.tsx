"use client";

import type { JSX } from "react";
import { useEffect, useState } from "react";
import { Download, Share2, X } from "lucide-react";

import { Button } from "@/components/ui/button";

interface BeforeInstallPromptChoice {
  outcome: "accepted" | "dismissed";
  platform: string;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<BeforeInstallPromptChoice>;
}

const DISMISS_KEY = "basedsubs:pwa-install-dismissed";

function isStandaloneMode(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    nav.standalone === true
  );
}

function isIosDevice(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function persistDismissal(): void {
  try {
    window.localStorage.setItem(DISMISS_KEY, "true");
  } catch {}
}

function readDismissal(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === "true";
  } catch {
    return false;
  }
}

export function PwaInstallBanner(): JSX.Element | null {
  const [isReady, setIsReady] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => undefined);
    }

    setIsIos(isIosDevice());
    setIsStandalone(isStandaloneMode());
    setIsDismissed(readDismissal());
    setIsReady(true);

    const displayModeQuery = window.matchMedia("(display-mode: standalone)");

    function handleDisplayModeChange(): void {
      setIsStandalone(isStandaloneMode());
    }

    function handleBeforeInstallPrompt(event: Event): void {
      const promptEvent = event as BeforeInstallPromptEvent;
      promptEvent.preventDefault();
      setInstallPrompt(promptEvent);
    }

    function handleAppInstalled(): void {
      setIsStandalone(true);
      setInstallPrompt(null);
      setIsDismissed(true);
      persistDismissal();
    }

    displayModeQuery.addEventListener("change", handleDisplayModeChange);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      displayModeQuery.removeEventListener("change", handleDisplayModeChange);
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  function dismissBanner(): void {
    setIsDismissed(true);
    persistDismissal();
  }

  async function handleInstall(): Promise<void> {
    if (!installPrompt) return;

    setIsInstalling(true);

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") dismissBanner();
    } finally {
      setInstallPrompt(null);
      setIsInstalling(false);
    }
  }

  if (!isReady || isStandalone || isDismissed) return null;
  if (!installPrompt && !isIos) return null;

  const title = isIos
    ? "Install Based Subtitles"
    : "Add Based Subtitles to your device";
  const description = isIos
    ? 'Open the Share menu in Safari, then tap "Add to Home Screen".'
    : "Install it for a faster, app-like experience with the Based Subs icon on your home screen.";

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 px-4">
      <div className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-2xl backdrop-blur">
        <div className="flex items-start gap-3 p-4 sm:p-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-sm font-extrabold tracking-tight text-white">
            BS
          </div>
          <div
            className="min-w-0 flex-1"
            style={{ fontFamily: "var(--font-outfit), sans-serif" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{title}</p>
                <p className="mt-1 text-sm leading-5 text-slate-600">
                  {description}
                </p>
              </div>
              <button
                type="button"
                onClick={dismissBanner}
                className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Dismiss install banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {isIos ? (
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900">
                  <Share2 className="h-3.5 w-3.5" />
                  Share
                  <span className="text-slate-300">→</span>
                  Add to Home Screen
                </div>
              ) : (
                <Button
                  onClick={handleInstall}
                  disabled={isInstalling}
                  className="bg-slate-900 text-white hover:bg-slate-800"
                  style={{ fontFamily: "var(--font-outfit), sans-serif" }}
                >
                  <Download className="h-4 w-4" />
                  {isInstalling ? "Opening..." : "Install app"}
                </Button>
              )}
              <Button
                variant="outline"
                onClick={dismissBanner}
                style={{ fontFamily: "var(--font-outfit), sans-serif" }}
              >
                Not now
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
