"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../context/auth-context";
import { Sidebar, BottomNav } from "./navigation";
import { PwaRegistration } from "./pwa-register";
import InstallToast from "./InstallToast";
import { BrandMark } from "./brand-mark";
import { Settings } from "lucide-react";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user && pathname !== "/login") {
        router.replace("/login");
      } else if (user && pathname === "/login") {
        router.replace("/");
      }
    }
  }, [user, loading, pathname, router]);

  // Loading / Splash Screen
  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#09090B] text-white">
        <div className="relative w-20 h-20 mb-4 flex flex-col items-center justify-center">
          <BrandMark className="h-16 w-16 animate-pulse rounded-2xl border-blue-400/20 shadow-2xl shadow-blue-950/30" />
        </div>
      </div>
    );
  }

  // Not logged in -> only allow Login page
  if (!user) {
    return pathname === "/login" ? (
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
      <header className="md:hidden flex items-center justify-between px-6 py-4 sticky top-0 z-40 bg-[#09090B]/60 backdrop-blur-md border-b border-zinc-800/40 relative">
        <div className="flex items-center space-x-2.5">
          <BrandMark className="h-8 w-8 rounded-lg border-blue-400/20 shadow-none shrink-0" />
          <span className="text-lg font-bold tracking-tight text-white font-sans bg-clip-text bg-linear-to-r from-white via-zinc-100 to-sky-200">
            Offset
          </span>
        </div>
        {user && (
          <Link href="/settings" className="p-1.5 text-zinc-400 hover:text-white transition-colors cursor-pointer" title="Settings">
            <Settings className="w-5.5 h-5.5" />
          </Link>
        )}
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen md:pl-76 relative z-10">
        <main className="flex-1 px-6 py-5 md:p-8 pb-24 md:pb-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <BottomNav />

      {/* PWA Register & Toast components */}
      <PwaRegistration />
      <InstallToast />
    </div>
  );
}
