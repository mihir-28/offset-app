"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "./ui/button";

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
  interface Window {
    MSStream?: unknown;
  }
  interface Navigator {
    standalone?: boolean;
  }
}

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  useEffect(() => {
    const canUseServiceWorker = "serviceWorker" in navigator;
    const shouldRegisterServiceWorker =
      canUseServiceWorker &&
      process.env.NODE_ENV === "production" &&
      window.location.protocol === "https:";

    if (canUseServiceWorker && process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister();
        });
      });

      caches.keys().then((cacheNames) => {
        cacheNames
          .filter((cacheName) => cacheName.startsWith("offset-cache"))
          .forEach((cacheName) => {
            caches.delete(cacheName);
          });
      });
    }

    // Register Service Worker
    if (shouldRegisterServiceWorker) {
      navigator.serviceWorker.register("/sw.js")
        .then((reg) => {
          console.log("Service worker registered successfully:", reg.scope);
        })
        .catch((err) => {
          console.error("Service worker registration failed:", err);
        });
    }

    // Capture standard install prompt
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || 
                         navigator.standalone === true;
      if (!standalone) {
        setShowBanner(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // Run layout-dependent detections asynchronously to avoid synchronous setState inside useEffect
    const timer = setTimeout(() => {
      const standalone = window.matchMedia("(display-mode: standalone)").matches || 
                         navigator.standalone === true;
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

      setIsStandalone(standalone);
      setIsIOS(ios);

      if (ios && !standalone) {
        const dismissed = sessionStorage.getItem("ios-prompt-dismissed");
        if (!dismissed) {
          setShowIOSPrompt(true);
        }
      }
    }, 0);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === "accepted") {
      console.log("User accepted the install prompt");
      setShowBanner(false);
      setDeferredPrompt(null);
    }
  };

  const dismissBanner = () => {
    setShowBanner(false);
  };

  const dismissIOSPrompt = () => {
    setShowIOSPrompt(false);
    sessionStorage.setItem("ios-prompt-dismissed", "true");
  };

  if (isStandalone) return null;

  return (
    <>
      {/* Android/Chrome Install Banner */}
      {showBanner && deferredPrompt && (
        <div className="fixed bottom-20 left-4 right-4 z-50 flex items-center justify-between gap-4 rounded-xl border border-zinc-800 bg-[#111113]/95 p-4 shadow-2xl backdrop-blur-md md:bottom-6 md:left-auto md:right-6 md:w-96">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-100">Install Offset</p>
              <p className="text-xs text-zinc-400">Add to Home Screen for the best experience.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={dismissBanner}>
              <X className="h-4 w-4" />
            </Button>
            <Button size="sm" onClick={handleInstallClick} className="bg-blue-500 hover:bg-blue-600 text-black font-medium">
              Install
            </Button>
          </div>
        </div>
      )}

      {/* iOS Instructions Prompt */}
      {showIOSPrompt && isIOS && (
        <div className="fixed bottom-20 left-4 right-4 z-50 rounded-xl border border-zinc-800 bg-[#111113]/95 p-4 shadow-2xl backdrop-blur-md md:bottom-6 md:left-auto md:right-6 md:w-96">
          <div className="flex justify-between items-start mb-2">
            <h4 className="text-sm font-semibold text-zinc-100">Install Offset PWA</h4>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-zinc-400" onClick={dismissIOSPrompt}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            To install this app on your iPhone, tap the Share button{" "}
            <span className="inline-block px-1 font-mono text-sm bg-zinc-800 rounded">⎋</span>{" "}
            in Safari, then select <strong className="text-zinc-200">{"Add to Home Screen"}</strong>{" "}
            <span className="inline-block px-1 font-mono text-sm bg-zinc-800 rounded">＋</span>.
          </p>
        </div>
      )}
    </>
  );
}
