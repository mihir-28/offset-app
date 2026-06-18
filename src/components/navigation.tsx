"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CreditCard, History, LogOut, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "../context/auth-context";
import { BrandMark } from "./brand-mark";

const mainNavItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Transactions", href: "/transactions", icon: CreditCard },
  { label: "Statements", href: "/statements", icon: History },
];

const addNavItem = { label: "Add", href: "/add", icon: Plus };

const allNavItems = [...mainNavItems, addNavItem];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="hidden md:flex md:w-64 flex-col fixed top-6 bottom-6 left-6 glass-nav border border-white/5 rounded-3xl p-6 z-30 shadow-2xl shadow-black/45">
      {/* Header Logo */}
      <div className="flex items-center space-x-3 mb-10 mt-2 group cursor-pointer">
        <BrandMark className="h-8 w-8 rounded-lg border-blue-400/20 shadow-none shrink-0" />
        <span className="text-xl font-bold tracking-tight text-white font-sans bg-clip-text bg-linear-to-r from-white via-slate-100 to-sky-200">
          Offset
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 space-y-1.5 relative">
        {allNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex items-center space-x-3.5 px-4 py-3 rounded-xl transition-all duration-300 cursor-pointer font-bold text-sm group z-10 ${
                isActive
                  ? "text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="activeDesktopTab"
                  className="absolute inset-0 bg-white/15 border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_2px_rgba(0,0,0,0.15)] rounded-xl -z-10 backdrop-blur-sm"
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 30,
                  }}
                />
              )}
              <Icon
                className={`w-5 h-5 transition-transform group-hover:scale-105 ${isActive ? "text-[#60A5FA]" : "text-zinc-400"}`}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Profile Card / Log Out */}
      {user && (
        <div className="border-t border-zinc-800/40 pt-5 mt-auto flex flex-col gap-4">
          <div className="flex items-center space-x-3 px-2">
            <Link href="/settings" className="cursor-pointer shrink-0">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "User"}
                  className="w-9 h-9 rounded-full ring-2 ring-blue-500/20 hover:scale-105 transition-transform"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-zinc-850 flex items-center justify-center text-blue-400 font-semibold uppercase hover:scale-105 transition-transform">
                  {user.displayName?.charAt(0) || "U"}
                </div>
              )}
            </Link>
            <div className="flex-1 min-w-0">
              <Link href="/settings" className="hover:underline cursor-pointer">
                <p className="text-xs font-semibold text-zinc-200 truncate">
                  {user.displayName || "Active User"}
                </p>
              </Link>
              <p className="text-[10px] text-zinc-500 truncate">
                {user.email}
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex items-center space-x-3 px-4 py-3 rounded-xl text-zinc-450 hover:text-rose-400 hover:bg-rose-950/10 border border-transparent hover:border-rose-900/20 transition-all text-sm font-medium cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const activeIndex = allNavItems.findIndex(
    (item) => pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
  );

  return (
    <div className="md:hidden fixed bottom-6 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
      <div
        className="relative flex items-center gap-3.5 max-w-sm w-full pointer-events-auto h-16"
        style={{ containerType: "inline-size" }}
      >
        {/* Glass Panel Background for Main Navigation Pill */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[calc(100%-78px)] glass-panel backdrop-blur-sm shadow-2xl border border-white/10 rounded-full! pointer-events-none"
          style={{ zIndex: 0 }}
        />

        {/* Glass Panel Background for Solo Add Button */}
        <div
          className="absolute right-0 top-0 bottom-0 w-16 glass-panel backdrop-blur-sm shadow-2xl border border-white/10 rounded-full! pointer-events-none"
          style={{ zIndex: 0 }}
        />

        {/* Active background capsule with GPU-accelerated translate3d */}
        {activeIndex !== -1 && (
          <div
            className="absolute bg-white/15 border border-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_1px_2px_rgba(0,0,0,0.15)] rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-[transform,width,height] pointer-events-none"
            style={{
              zIndex: 1,
              height: "48px",
              width: activeIndex === 3 ? "48px" : "calc((100cqw - 114px) / 3)",
              top: "8px",
              transform:
                activeIndex === 3
                  ? "translate3d(calc(100cqw - 56px), 0, 0)"
                  : `translate3d(calc(12px + ${activeIndex} * (100cqw - 114px) / 3 + ${activeIndex} * 6px), 0, 0)`,
            }}
          />
        )}

        {/* Main Navigation Pill Content Wrapper */}
        <div
          className="relative flex-1 flex items-center gap-1.5 px-3 py-2 rounded-full! justify-between"
          style={{ zIndex: 2 }}
        >
          {mainNavItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeIndex === index;

            // Color mapping for icons
            let iconColor = "text-zinc-400";
            if (item.label === "Dashboard") {
              iconColor = isActive ? "text-[#f472b6]" : "text-[#f472b6]/50";
            } else if (item.label === "Transactions") {
              iconColor = isActive ? "text-[#64d2ff]" : "text-[#64d2ff]/50";
            } else if (item.label === "Statements") {
              iconColor = isActive ? "text-[#34d399]" : "text-[#34d399]/50";
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-full transition-all duration-300 cursor-pointer ${
                  isActive ? "text-[#fbdf93] font-bold" : "text-[#fbdf93]/50 hover:text-[#fbdf93]/80"
                }`}
                style={isActive ? { textShadow: "0 0 8px rgba(251, 223, 147, 0.25)" } : undefined}
              >
                <Icon
                  className={`w-5.5 h-5.5 transition-all duration-300 ${iconColor} ${
                    isActive ? "scale-110 drop-shadow-[0_0_6px_rgba(251, 223, 147, 0.15)]" : "scale-100"
                  }`}
                />
                <span className="text-[8px] mt-0.5 font-bold uppercase tracking-wider scale-90">
                  {item.label.replace("Dashboard", "Home")}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Solo Add Button Content Wrapper */}
        <div
          className="relative w-16 h-16 flex items-center justify-center shrink-0"
          style={{ zIndex: 2 }}
        >
          <Link
            href="/add"
            className="relative w-full h-full rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer"
            title="Add Transaction"
          >
            <Plus
              className="w-6 h-6 transition-all duration-300 text-[#b58dfa] opacity-65 hover:opacity-95"
              style={{ strokeWidth: 2.5 }}
            />
          </Link>
        </div>
      </div>
    </div>
  );
}
