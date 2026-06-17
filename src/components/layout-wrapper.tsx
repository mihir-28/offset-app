"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "../context/auth-context";
import { Sidebar, BottomNav } from "./navigation";
import { PwaRegister } from "./pwa-register";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
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
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/30 shadow-2xl shadow-blue-500/5 animate-pulse">
            <span className="text-3xl font-extrabold text-blue-400">O</span>
          </div>
          <h1 className="text-xl font-bold tracking-wider text-zinc-200">OFFSET</h1>
          <p className="text-xs text-zinc-500">Track liabilities, effortlessly.</p>
        </div>
      </div>
    );
  }

  // Not logged in -> only allow Login page
  if (!user) {
    return pathname === "/login" ? (
      <div className="min-h-screen bg-[#09090B] text-white flex flex-col">{children}</div>
    ) : (
      <div className="h-screen w-screen bg-[#09090B]" />
    );
  }

  // Logged in layout
  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto pb-20 md:pb-0">
        <div className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <BottomNav />

      {/* PWA Register banner */}
      <PwaRegister />
    </div>
  );
}
