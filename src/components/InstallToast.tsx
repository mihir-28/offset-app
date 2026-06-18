"use client";

import React, { useEffect, useRef } from "react";
import { toast } from "sonner";
import { BrandMark } from "./brand-mark";
import { Share2, Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface Window {
    deferredPrompt?: BeforeInstallPromptEvent | null;
  }
}

const DISMISS_KEY = "pwa-install-dismissed";
const DISMISS_DURATION = 1000 * 60 * 60 * 4; // 4 hours

let memoryDismissedUntil = 0;

export default function InstallToast() {
  const toastRef = useRef<string | number | null>(null);

  // Helper check for standalone display mode
  const isStandalone = () => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  };

  // Helper check for recently dismissed prompt
  const checkDismissed = () => {
    if (typeof window === "undefined") return true;
    if (Date.now() < memoryDismissedUntil) return true;
    try {
      const dismissedTime = window.localStorage.getItem(DISMISS_KEY);
      if (!dismissedTime) return false;
      const parsedTime = parseInt(dismissedTime, 10);
      if (isNaN(parsedTime)) return false;
      return Date.now() - parsedTime < DISMISS_DURATION;
    } catch (e) {
      console.error("Failed to read install dismissal from localStorage", e);
      return false;
    }
  };

  const setDismissed = () => {
    if (typeof window === "undefined") return;
    const now = Date.now();
    memoryDismissedUntil = now + DISMISS_DURATION;
    try {
      window.localStorage.setItem(DISMISS_KEY, now.toString());
    } catch (e) {
      console.error("Failed to save install dismissal to localStorage", e);
    }
  };

  // Helper check for iOS
  const isIOS = () => {
    if (typeof window === "undefined") return false;
    const ua = window.navigator.userAgent;
    const isIPad = !!ua.match(/iPad/i);
    const isIPhone = !!ua.match(/iPhone/i);
    const isMacTouch = window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
    return isIPad || isIPhone || isMacTouch;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (checkDismissed()) return;

    let installTimer: NodeJS.Timeout | null = null;

    const showIosToast = () => {
      if (toastRef.current) return;

      toastRef.current = toast.custom((t) => (
        <div className="mx-auto w-[calc(100vw-2rem)] max-w-sm glass-panel border border-white/10 shadow-2xl p-4 flex gap-3 text-left relative overflow-hidden bg-[#111113]/95 backdrop-blur-md">
          {/* Glow accent */}
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-[#60A5FA]/10 blur-xl pointer-events-none"></div>
          
          <BrandMark className="h-11 w-11 rounded-xl shrink-0" />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-white font-sans">
              Add to Home Screen
            </h4>
            <p className="text-xs text-zinc-400 font-body mt-1 leading-relaxed">
              Tap the <span className="inline-flex items-center justify-center p-1 bg-white/10 rounded-md text-blue-400 mx-0.5"><Share2 className="w-3 h-3" /></span> share button in Safari, then select <strong>Add to Home Screen</strong>.
            </p>
            <div className="flex gap-2.5 mt-3 justify-end">
              <button
                onClick={() => {
                  setDismissed();
                  toast.dismiss(t);
                  toastRef.current = null;
                }}
                className="px-3 py-1.5 text-[11px] font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Maybe Later
              </button>
              <button
                onClick={() => {
                  setDismissed();
                  toast.dismiss(t);
                  toastRef.current = null;
                }}
                className="px-3.5 py-1.5 bg-blue-500 hover:bg-blue-600 text-black rounded-lg text-[11px] font-bold transition-all shadow-md active:scale-95 cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      ), {
        duration: Infinity,
        position: "top-center",
        onDismiss: () => {
          setDismissed();
          toastRef.current = null;
        },
      });
    };

    const showInstallToast = (event: BeforeInstallPromptEvent) => {
      if (toastRef.current) return;

      toastRef.current = toast.custom((t) => (
        <div className="mx-auto w-[calc(100vw-2rem)] max-w-sm glass-panel border border-white/10 shadow-2xl p-4 flex gap-3 text-left relative overflow-hidden bg-[#111113]/95 backdrop-blur-md">
          {/* Glow accent */}
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-[#60A5FA]/10 blur-xl pointer-events-none"></div>
          
          <BrandMark className="h-11 w-11 rounded-xl shrink-0" />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-bold text-white font-sans">
              Install Offset
            </h4>
            <p className="text-xs text-zinc-400 font-body mt-1 leading-relaxed">
              Install our app for quick access, offline transaction tracking, and a native experience.
            </p>
            <div className="flex gap-2.5 mt-3 justify-end">
              <button
                onClick={() => {
                  setDismissed();
                  toast.dismiss(t);
                  toastRef.current = null;
                }}
                className="px-3 py-1.5 text-[11px] font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Maybe Later
              </button>
              <button
                onClick={async () => {
                  const activePrompt = window.deferredPrompt || event;
                  if (!activePrompt) {
                    console.error("No active install prompt event found");
                    toast.custom(() => (
                      <div className="mx-auto w-[calc(100vw-2rem)] max-w-sm rounded-3xl border border-white/10 bg-[#111113]/95 p-4 text-left shadow-2xl backdrop-blur-md">
                        <p className="font-sans text-sm font-bold text-white">Install prompt unavailable</p>
                        <p className="mt-1 font-body text-xs leading-relaxed text-zinc-400">Try reloading the page.</p>
                      </div>
                    ), { position: "top-center" });
                    toast.dismiss(t);
                    toastRef.current = null;
                    return;
                  }
                  try {
                    await activePrompt.prompt();
                    const { outcome } = await activePrompt.userChoice;
                    console.log(`Install choice: ${outcome}`);
                    if (outcome === "accepted") {
                      window.deferredPrompt = null;
                    }
                  } catch (err) {
                    console.error("Error triggering install prompt:", err);
                  }
                  setDismissed();
                  toast.dismiss(t);
                  toastRef.current = null;
                }}
                className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-900 rounded-lg text-[11px] font-bold transition-all shadow-md active:scale-95 flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3 h-3" />
                <span>Install</span>
              </button>
            </div>
          </div>
        </div>
      ), {
        duration: Infinity,
        position: "top-center",
        onDismiss: () => {
          setDismissed();
          toastRef.current = null;
        },
      });
    };

    const showToastWithDelay = (event: BeforeInstallPromptEvent) => {
      if (installTimer) clearTimeout(installTimer);
      installTimer = setTimeout(() => {
        showInstallToast(event);
      }, 3000);
    };

    // If we already have a saved prompt in window, use it
    if (window.deferredPrompt) {
      showToastWithDelay(window.deferredPrompt);
    }

    // Handle Chromium PWA Install event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const pwaEvent = e as BeforeInstallPromptEvent;
      window.deferredPrompt = pwaEvent;
      showToastWithDelay(pwaEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Handle app installed event
    const handleAppInstalled = () => {
      if (toastRef.current) {
        toast.dismiss(toastRef.current);
        toastRef.current = null;
      }
      window.deferredPrompt = null;
    };
    
    window.addEventListener("appinstalled", handleAppInstalled);

    // iOS Specific Logic (as beforeinstallprompt won't trigger)
    let iosTimer: NodeJS.Timeout | null = null;
    if (isIOS() && !window.deferredPrompt) {
      iosTimer = setTimeout(() => {
        showIosToast();
      }, 5000); // Wait 5 seconds to show iOS manual prompt
    }

    return () => {
      if (installTimer) clearTimeout(installTimer);
      if (iosTimer) clearTimeout(iosTimer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  return null;
}
