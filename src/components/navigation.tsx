"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, CreditCard, History, User } from "lucide-react";
import { cn } from "../lib/utils";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Transactions", href: "/transactions", icon: CreditCard },
  { label: "Statements", href: "/statements", icon: History },
  { label: "Profile", href: "/profile", icon: User },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-64 border-r border-zinc-800 bg-[#111113] p-6 text-zinc-400">
      <div className="mb-8 flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold text-lg">
          O
        </div>
        <span className="text-xl font-bold tracking-tight text-white">Offset</span>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-150",
                isActive
                  ? "bg-zinc-800/50 text-blue-400 font-semibold border-l-2 border-blue-400 pl-3.5"
                  : "hover:bg-zinc-800/30 hover:text-zinc-200"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="pt-6 border-t border-zinc-800/50">
        <p className="text-xs text-zinc-500 font-medium">Offset Tracker v0.1.0</p>
      </div>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 border-t border-zinc-800 bg-[#111113]/90 backdrop-blur-md z-40 flex items-center justify-around pb-safe">
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center w-16 h-full text-zinc-400 transition-colors duration-150",
              isActive ? "text-blue-400 font-semibold" : "hover:text-zinc-200"
            )}
          >
            <Icon className="h-5 w-5 mb-1" />
            <span className="text-[10px] tracking-tight">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
