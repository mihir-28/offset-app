"use client";

import React, { useState } from "react";
import { useAuth } from "../../context/auth-context";
import { Button } from "../../components/ui/button";
import { LogOut, Calendar, User, Mail, Settings, Info } from "lucide-react";

export default function ProfilePage() {
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
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-4">
        <h2 className="text-2xl font-bold tracking-tight text-white">Profile & Settings</h2>
        <p className="text-xs text-zinc-500 mt-1">
          Manage your account profile and billing cycle preferences.
        </p>
      </div>

      {/* Profile Info Card */}
      <div className="bg-[#111113] border border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-center gap-6">
        {profile?.photoURL ? (
          <img
            src={profile.photoURL}
            alt="Profile avatar"
            referrerPolicy="no-referrer"
            className="w-20 h-20 rounded-full border border-zinc-700 bg-zinc-800"
          />
        ) : (
          <div className="w-20 h-20 rounded-full border border-zinc-700 bg-zinc-850 flex items-center justify-center text-zinc-500">
            <User className="h-10 w-10" />
          </div>
        )}
        
        <div className="flex-1 text-center sm:text-left space-y-1">
          <h3 className="text-lg font-bold text-white tracking-tight">{profile?.name || "User"}</h3>
          <p className="text-sm text-zinc-400 flex items-center justify-center sm:justify-start gap-1.5">
            <Mail className="h-3.5 w-3.5 text-zinc-650" />
            {profile?.email || "No email available"}
          </p>
          <div className="pt-1">
            <span className="inline-block rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-blue-400 border border-blue-400/20">
              Personal Account
            </span>
          </div>
        </div>
      </div>

      {/* Billing Cycle Card */}
      <div className="bg-[#111113] border border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-800/50 pb-3">
          <Settings className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-bold text-white tracking-wide">Billing Cycle Preferences</h3>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Cycle Boundary
            </label>
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200">
              <Calendar className="h-4 w-4 text-zinc-500 mr-2.5" />
              <span>17th of the month → 16th of the following month</span>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Transactions are automatically matched to cycles based on this boundary. For example, a transaction dated June 25th falls into the June 17th - July 16th statement cycle.
            </p>
          </div>

          {/* Feature Customization Hint */}
          <div className="p-3 bg-zinc-900/45 border border-zinc-800/70 rounded-xl flex items-start gap-2.5 text-zinc-500">
            <Info className="h-4 w-4 shrink-0 text-zinc-650 mt-0.5" />
            <p className="text-[11px] leading-normal">
              <strong>Customizable cycles coming soon:</strong> The ability to select custom billing cycle dates (e.g. 1st to 30th) will be available in a future architecture release. Currently, the default 17-16 schedule is active.
            </p>
          </div>
        </div>
      </div>

      {/* Sign Out Card */}
      <div className="bg-[#111113] border border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h4 className="text-sm font-bold text-white tracking-tight">Sign Out of Offset</h4>
          <p className="text-xs text-zinc-500 mt-0.5">
            You will be logged out of your session. Cache data remains active offline.
          </p>
        </div>
        <Button
          onClick={handleLogout}
          disabled={logoutLoading}
          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-5 rounded-xl h-10 text-xs font-semibold cursor-pointer"
        >
          {logoutLoading ? (
            <div className="h-4 w-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <LogOut className="h-3.5 w-3.5 mr-1.5" /> Sign Out
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
