"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "../context/auth-context";
import { Sidebar, BottomNav } from "./navigation";
import { PwaRegistration } from "./pwa-register";
import InstallToast from "./InstallToast";
import { BrandMark } from "./brand-mark";
import { Settings } from "lucide-react";
import { CardSetupDialog } from "./card-setup-dialog";
import { CardSwitcher } from "./card-switcher";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading, cards } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isPublicRoute = pathname === "/login" || pathname === "/privacy" || pathname === "/terms";
  const isLegalRoute = pathname === "/privacy" || pathname === "/terms";

  useEffect(() => {
    // Redirect authenticated users immediately; profile/card hydration can finish in the background.
    if (user && pathname === "/login") {
      router.replace("/");
      return;
    }

    if (!loading && !user && !isPublicRoute) {
      router.replace("/login");
    }
  }, [user, loading, pathname, router, isPublicRoute]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const shortcutPaths = new Set(["/transactions", "/statements", "/settings"]);
    const openShortcutPath = (url?: string) => {
      if (!url) return;
      try {
        const path = new URL(url).pathname;
        if (shortcutPaths.has(path) && path !== pathname) {
          router.replace(path);
        }
      } catch {
        // Ignore non-URL launch intents.
      }
    };

    let disposed = false;
    let removeListener: (() => void) | undefined;
    App.getLaunchUrl().then((launch) => openShortcutPath(launch?.url));
    App.addListener("appUrlOpen", ({ url }) => openShortcutPath(url)).then((listener) => {
      if (disposed) {
        listener.remove();
      } else {
        removeListener = () => listener.remove();
      }
    });

    return () => {
      disposed = true;
      removeListener?.();
    };
  }, [pathname, router]);

  // Loading / Splash Screen
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#09090B] text-zinc-100">
        <div className="relative w-20 h-20 mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-blue-500/20 border-t-blue-500 animate-spin"></div>
          <div className="absolute inset-2 rounded-full border-4 border-purple-500/15 border-b-purple-400 animate-spin duration-1000"></div>
        </div>
        <p className="text-xs tracking-widest text-zinc-400 font-sans uppercase animate-pulse">
          Loading Offset...
        </p>
      </div>
    );
  }

  // Not logged in -> allow public pages only.
  if (!user) {
    return isPublicRoute ? (
      <div className="min-h-screen bg-[#09090B] text-white flex flex-col relative overflow-hidden">
        {/* Ambient background glow for Login */}
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[55vw] h-[55vw] rounded-full bg-white/2 blur-[130px]"></div>
          <div className="absolute bottom-[-15%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-blue-500/2 blur-[140px]"></div>
        </div>
        <div className="relative z-10 flex-1 flex flex-col">{children}</div>
      </div>
    ) : (
      <div className="h-screen w-screen bg-[#09090B]" />
    );
  }

  // Logged in layout
  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col relative overflow-hidden">
      {/* Background extension / Ambient liquid colors */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[55vw] h-[55vw] rounded-full bg-white/2 blur-[130px]"></div>
        <div className="absolute bottom-[-15%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-blue-500/2 blur-[140px]"></div>
        <div className="absolute top-[35%] right-[15%] w-[40vw] h-[40vw] rounded-full bg-zinc-650/1 blur-[120px]"></div>
      </div>

      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Header (hidden on Desktop) */}
      <header className="md:hidden sticky top-0 z-40 border-b border-zinc-800/40 bg-[#09090B]/90 px-5 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex shrink-0 items-center space-x-2.5">
          <BrandMark className="h-8 w-8 rounded-lg border-blue-400/20 shadow-none shrink-0" />
          <span className="text-lg font-bold tracking-tight text-white font-sans bg-clip-text bg-linear-to-r from-white via-zinc-100 to-sky-200">
            Offset
          </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <CardSwitcher compact />
            {user && (
              <Link href="/settings" className="flex h-11 w-11 items-center justify-center rounded-xl text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white" title="Settings">
                <Settings className="w-5.5 h-5.5" />
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen md:pl-76 relative z-10">
        <main className={`flex-1 pb-24 md:pb-5 max-w-7xl w-full mx-auto ${isLegalRoute ? "" : "px-6 py-5"}`}>
          {children}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <BottomNav />

      {/* PWA Register & Toast components */}
      <PwaRegistration />
      <InstallToast />
      {cards.length === 0 && <CardSetupDialog />}
    </div>
  );
}
