"use client";

import Link from "next/link";
import React, { useState } from "react";
import { ArrowLeft, Calendar, RefreshCw, Settings, Trash2 } from "lucide-react";
import { useAuth } from "../../../context/auth-context";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { migrateTransactionsToNewCycleDay } from "../../../lib/db-helpers";
import { cn } from "../../../lib/utils";

const getBucketColor = (bucketName: string) => {
  const themes = [
    { solid: "bg-blue-500" },
    { solid: "bg-purple-500" },
    { solid: "bg-emerald-500" },
    { solid: "bg-amber-500" },
    { solid: "bg-rose-500" },
    { solid: "bg-cyan-500" },
  ];

  const nameUpper = bucketName.toUpperCase();
  if (nameUpper === "HOME") return themes[0];
  if (nameUpper === "MINE") return themes[1];

  let hash = 0;
  for (let i = 0; i < bucketName.length; i++) {
    hash = bucketName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return themes[2 + (Math.abs(hash) % 4)];
};

export default function GeneralSettingsPage() {
  const { profile, updateBuckets, updateCycleStartDay } = useAuth();
  const [newBucketName, setNewBucketName] = useState("");
  const [savingBuckets, setSavingBuckets] = useState(false);
  const [savingCycleDay, setSavingCycleDay] = useState(false);

  const buckets = profile?.buckets || ["HOME", "MINE"];
  const cycleStartDay = profile?.cycleStartDay || 17;

  const formatOrdinal = (day: number) => {
    if (day === 1 || day === 21) return `${day}st`;
    if (day === 2 || day === 22) return `${day}nd`;
    if (day === 3 || day === 23) return `${day}rd`;
    return `${day}th`;
  };

  const getBoundaryText = (day: number) => {
    if (day === 1) return "1st of the month -> Last day of the month";
    return `${formatOrdinal(day)} of the month -> ${formatOrdinal(day - 1)} of the following month`;
  };

  const handleAddBucket = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newBucketName.trim();
    if (!trimmed) return;

    if (buckets.some((b) => b.toLowerCase() === trimmed.toLowerCase())) {
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
        await updateBuckets(buckets.filter((b) => b !== bucketToDelete));
      } catch (err) {
        console.error("Failed to delete bucket:", err);
        alert("Failed to delete bucket.");
      } finally {
        setSavingBuckets(false);
      }
    }
  };

  const handleCycleStartDayChange = async (day: number) => {
    if (day < 1 || day > 28 || day === cycleStartDay) return;

    if (
      confirm(
        `Change billing cycle start day to ${formatOrdinal(day)}?\n\nThis recalculates all active and closed transactions into new statement boundaries.`
      )
    ) {
      setSavingCycleDay(true);
      try {
        if (profile?.id) {
          await migrateTransactionsToNewCycleDay(profile.id, day);
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

  return (
    <div className="w-full max-w-md space-y-4">
      <div className="space-y-4 border-b border-zinc-800 pb-4">
        <Link href="/settings" className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Settings
        </Link>
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">General</h2>
          <p className="mt-1 text-xs text-zinc-500">Buckets and billing cycle preferences.</p>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-bold text-white">Buckets</h3>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#111113]">
          {buckets.map((bucket) => {
            const colors = getBucketColor(bucket);
            return (
              <div key={bucket} className="flex items-center justify-between border-b border-zinc-800/70 px-4 py-3 last:border-b-0">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", colors.solid)} />
                  <span className="truncate text-sm font-semibold text-zinc-200">{bucket}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDeleteBucket(bucket)}
                  disabled={buckets.length <= 1 || savingBuckets}
                  className="h-8 w-8 text-zinc-400 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-35"
                  title={buckets.length <= 1 ? "Must have at least one bucket" : "Delete bucket"}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>

        <form onSubmit={handleAddBucket} className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="text"
            placeholder="New bucket name"
            value={newBucketName}
            onChange={(e) => setNewBucketName(e.target.value)}
            required
            className="h-10 flex-1 rounded-xl border-zinc-800 bg-zinc-900 text-xs text-zinc-100 placeholder:text-zinc-650"
          />
          <Button
            type="submit"
            disabled={!newBucketName.trim() || savingBuckets}
            className="h-10 shrink-0 rounded-xl bg-blue-500 px-5 text-xs font-semibold text-black hover:bg-blue-600"
          >
            {savingBuckets ? "Saving..." : "Add Bucket"}
          </Button>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-bold text-white">Billing Cycle</h3>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-[#111113] p-4">
          {savingCycleDay ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-zinc-400">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-400" />
              <p className="text-center text-xs leading-normal">Migrating statement cycles...</p>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Cycle Start Day
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Select
                  value={String(cycleStartDay)}
                  onValueChange={(val) => handleCycleStartDayChange(Number(val))}
                >
                  <SelectTrigger className="h-10 w-full rounded-xl border-zinc-800 bg-zinc-900 px-3 text-left text-zinc-200 focus:outline-none focus:border-blue-500/30 sm:w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-950 p-1 text-zinc-200 shadow-2xl">
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {formatOrdinal(d)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-1 items-center rounded-xl border border-zinc-850 bg-zinc-900/60 px-4 py-2.5 text-xs text-zinc-300">
                  <span>Active Boundary: <strong>{getBoundaryText(cycleStartDay)}</strong></span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
