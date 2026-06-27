"use client";

import Link from "next/link";
import { ChevronRight, Settings, User, Info } from "lucide-react";

const settingsRows = [
  {
    href: "/settings/general",
    title: "General",
    description: "Buckets and billing cycle",
    icon: Settings,
  },
  {
    href: "/settings/account",
    title: "Account",
    description: "Profile and sign out",
    icon: User,
  },
  {
    href: "/settings/about",
    title: "About",
    description: "App, developer, and contact details",
    icon: Info,
  },
];

export default function SettingsPage() {
  return (
    <div className="w-full max-w-md space-y-4">
      <div className="border-b border-zinc-800 pb-4">
        <h2 className="text-2xl font-bold tracking-tight text-white">Settings</h2>
        <p className="mt-1 text-xs text-zinc-500">Manage Offset preferences.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#111113]">
        {settingsRows.map((row) => {
          const Icon = row.icon;
          return (
            <Link
              key={row.href}
              href={row.href}
              className="group flex items-center gap-4 border-b border-zinc-800/70 px-4 py-4 transition-colors last:border-b-0 hover:bg-zinc-900/80"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-blue-400 ring-1 ring-zinc-800">
                <Icon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-zinc-100">{row.title}</div>
                <div className="mt-0.5 text-xs text-zinc-500">{row.description}</div>
              </div>
              <ChevronRight className="h-4.5 w-4.5 text-zinc-600 transition-colors group-hover:text-zinc-300" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
