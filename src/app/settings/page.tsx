"use client";

import React, { useState } from "react";
import { useAuth } from "../../context/auth-context";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { LogOut, Calendar, User, Mail, Settings, Trash2, RefreshCw } from "lucide-react";
import { migrateTransactionsToNewCycleDay } from "../../lib/db-helpers";
import { cn } from "../../lib/utils";

const getBucketColor = (bucketName: string) => {
  const themes = [
    { text: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400/20", solid: "bg-blue-500" }, // 0: Blue (HOME)
    { text: "text-purple-400", bg: "bg-purple-400/10", border: "border-purple-400/20", solid: "bg-purple-500" }, // 1: Purple (MINE)
    { text: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/20", solid: "bg-emerald-500" }, // 2: Emerald
    { text: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/20", solid: "bg-amber-500" }, // 3: Amber
    { text: "text-rose-400", bg: "bg-rose-400/10", border: "border-rose-400/20", solid: "bg-rose-500" }, // 4: Rose
    { text: "text-cyan-400", bg: "bg-cyan-400/10", border: "border-cyan-400/20", solid: "bg-cyan-500" }, // 5: Cyan
  ];

  const nameUpper = bucketName.toUpperCase();
  if (nameUpper === "HOME") return themes[0];
  if (nameUpper === "MINE") return themes[1];

  let hash = 0;
  for (let i = 0; i < bucketName.length; i++) {
    hash = bucketName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = 2 + (Math.abs(hash) % 4); // Maps dynamically to indices 2..5
  return themes[index];
};

export default function SettingsPage() {
  const { profile, logout, updateBuckets, updateCycleStartDay } = useAuth();
  const [logoutLoading, setLogoutLoading] = useState(false);
  
  const [newBucketName, setNewBucketName] = useState("");
  const [savingBuckets, setSavingBuckets] = useState(false);
  const [savingCycleDay, setSavingCycleDay] = useState(false);

  const buckets = profile?.buckets || ["HOME", "MINE"];
  const cycleStartDay = profile?.cycleStartDay || 17;

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      await logout();
    } catch (err) {
      console.error("Logout error:", err);
      setLogoutLoading(false);
    }
  };

  const handleAddBucket = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newBucketName.trim();
    if (!trimmed) return;
    
    // Check for duplicates (case-insensitive)
    if (buckets.some(b => b.toLowerCase() === trimmed.toLowerCase())) {
      alert("A bucket with this name already exists.");
      return;
    }

    setSavingBuckets(true);
    try {
      await updateBuckets([...buckets, trimmed]);
      setNewBucketName("");
    } catch (err) {
      console.error("Failed to add bucket:", err);
      alert("Failed to add bucket.");
    } finally {
      setSavingBuckets(false);
    }
  };

  const handleDeleteBucket = async (bucketToDelete: string) => {
    if (buckets.length <= 1) {
      alert("You must have at least one bucket.");
      return;
    }

    if (
      confirm(
        `Are you sure you want to delete the bucket "${bucketToDelete}"?\n\nExisting transactions belonging to this bucket will keep their label but won't be selectable for new transactions.`
      )
    ) {
      setSavingBuckets(true);
      try {
        await updateBuckets(buckets.filter(b => b !== bucketToDelete));
      } catch (err) {
        console.error("Failed to delete bucket:", err);
        alert("Failed to delete bucket.");
      } finally {
        setSavingBuckets(false);
      }
    }
  };

  const handleCycleStartDayChange = async (day: number) => {
    if (day < 1 || day > 28) return;
    if (day === cycleStartDay) return;

    if (
      confirm(
        `Are you sure you want to change your billing cycle start day to the ${day === 1 ? "1st" : day === 2 ? "2nd" : day === 3 ? "3rd" : `${day}th`}?\n\nThis will trigger a database migration to recalculate and shift all your active and closed transactions to their new cycle boundaries. This may take a few seconds.`
      )
    ) {
      setSavingCycleDay(true);
      try {
        if (profile?.id) {
          // 1. Migrate all user's transactions
          await migrateTransactionsToNewCycleDay(profile.id, day);
          // 2. Update user settings
          await updateCycleStartDay(day);
        }
      } catch (err) {
        console.error("Failed to update cycle start day:", err);
        alert("Failed to update billing cycle start day.");
      } finally {
        setSavingCycleDay(false);
      }
    }
  };

  const getBoundaryText = (day: number) => {
    if (day === 1) return "1st of the month → Last day of the month";
    const getOrdinal = (d: number) => {
      if (d === 1 || d === 21 || d === 31) return `${d}st`;
      if (d === 2 || d === 22) return `${d}nd`;
      if (d === 3 || d === 23) return `${d}rd`;
      return `${d}th`;
    };
    return `${getOrdinal(day)} of the month → ${getOrdinal(day - 1)} of the following month`;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-4">
        <h2 className="text-2xl font-bold tracking-tight text-white">Settings</h2>
        <p className="text-xs text-zinc-500 mt-1">
          Manage your cycle date preferences and account session.
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

      {/* Bucket Configurations Card */}
      <div className="bg-[#111113] border border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-800/50 pb-3">
          <Settings className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-bold text-white tracking-wide">Configure Buckets</h3>
        </div>

        <div className="space-y-4">
          <p className="text-xs text-zinc-500 leading-relaxed">
            Manage the categories/buckets used to allocate credit card transactions. 
            Outstanding balances will be calculated and tracked separately for each bucket.
          </p>

          {/* List of current buckets */}
          <div className="space-y-2">
            {buckets.map((bucket) => {
              const colors = getBucketColor(bucket);
              return (
                <div
                  key={bucket}
                  className="flex items-center justify-between bg-zinc-900/60 border border-zinc-850 rounded-xl px-4 py-3 text-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <span className={cn("w-2 h-2 rounded-full", colors.solid)} />
                    <span className="font-semibold text-zinc-200">{bucket}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDeleteBucket(bucket)}
                    disabled={buckets.length <= 1 || savingBuckets} // Ensure at least 1 bucket remains
                    className="h-8 w-8 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 disabled:opacity-35 disabled:cursor-not-allowed"
                    title={buckets.length <= 1 ? "Must have at least one bucket" : "Delete Bucket"}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Add a new bucket form */}
          <form onSubmit={handleAddBucket} className="flex gap-2 pt-2">
            <Input
              type="text"
              placeholder="New bucket name (e.g. Work, Shared)"
              value={newBucketName}
              onChange={(e) => setNewBucketName(e.target.value)}
              required
              className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-650 rounded-xl h-10 text-xs flex-1"
            />
            <Button
              type="submit"
              disabled={!newBucketName.trim() || savingBuckets}
              className="bg-blue-500 hover:bg-blue-600 text-black font-semibold rounded-xl h-10 px-5 text-xs transition duration-150 shrink-0 cursor-pointer"
            >
              {savingBuckets ? "Saving..." : "Add Bucket"}
            </Button>
          </form>
        </div>
      </div>

      {/* Billing Cycle Card */}
      <div className="bg-[#111113] border border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-800/50 pb-3">
          <Calendar className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-bold text-white tracking-wide">Billing Cycle Preferences</h3>
        </div>

        <div className="space-y-4">
          {savingCycleDay ? (
            <div className="py-6 flex flex-col items-center justify-center text-zinc-400 gap-3">
              <RefreshCw className="h-6 w-6 text-blue-400 animate-spin" />
              <p className="text-xs text-center leading-normal">
                Migrating statement cycles in database...<br />
                <span className="text-[10px] text-zinc-500">Please do not close this tab.</span>
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Cycle Start Day
                </label>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <Select
                    value={String(cycleStartDay)}
                    onValueChange={(val) => handleCycleStartDayChange(Number(val))}
                  >
                    <SelectTrigger className="w-full sm:w-40 bg-zinc-900 border-zinc-800 text-zinc-200 rounded-xl h-10 px-3 cursor-pointer text-left flex items-center justify-between focus:outline-none focus:border-blue-500/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-xl shadow-2xl p-1 max-h-60 overflow-y-auto">
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          {d === 1 ? "1st (Monthly)" : d === 2 ? "2nd" : d === 3 ? "3rd" : `${d}th`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <div className="flex-1 flex items-center bg-zinc-900/60 border border-zinc-850 rounded-xl px-4 py-2.5 text-xs text-zinc-300">
                    <span>Active Boundary: <strong>{getBoundaryText(cycleStartDay)}</strong></span>
                  </div>
                </div>

                <p className="text-xs text-zinc-500 leading-relaxed pt-1">
                  Transactions will be automatically grouped into statement cycles based on this boundary. Changing this setting will recalculate cycle IDs for all transactions immediately, so new and existing transactions will shift to their corresponding new cycle bounds.
                </p>
              </div>
            </div>
          )}
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
