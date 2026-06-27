"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, LogOut, Mail, User } from "lucide-react";
import { useAuth } from "../../../context/auth-context";
import { Button } from "../../../components/ui/button";

export default function AccountSettingsPage() {
  const { profile, logout } = useAuth();
  const [logoutLoading, setLogoutLoading] = useState(false);

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await logout();
    } catch (err) {
      console.error("Logout error:", err);
      setLogoutLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-4">
      <div className="space-y-4 border-b border-zinc-800 pb-4">
        <Link href="/settings" className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Settings
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Account</h2>
          <p className="mt-1 text-xs text-zinc-500">Profile and session controls.</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#111113]">
        <div className="flex items-center gap-4 border-b border-zinc-800/70 px-4 py-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-zinc-700 bg-zinc-850 text-zinc-500">
            {profile?.name ? (
              <span className="text-lg font-extrabold uppercase text-blue-400">
                {profile.name.charAt(0)}
              </span>
            ) : (
              <User className="h-7 w-7" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold text-white">{profile?.name || "User"}</h3>
            <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-zinc-400">
              <Mail className="h-3.5 w-3.5 shrink-0 text-zinc-650" />
              {profile?.email || "No email available"}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-sm font-bold text-white">Sign Out</h4>
            <p className="mt-0.5 text-xs text-zinc-500">End this device session.</p>
          </div>
          <Button
            onClick={handleLogout}
            disabled={logoutLoading}
            className="h-10 rounded-xl border border-red-500/20 bg-red-500/10 px-5 text-xs font-semibold text-red-400 hover:bg-red-500/20"
          >
            {logoutLoading ? (
              <div className="h-4 w-4 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />
            ) : (
              <>
                <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign Out
              </>
            )}
          </Button>
        </div>
      </section>
    </div>
  );
}
