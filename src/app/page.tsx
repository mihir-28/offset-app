"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/auth-context";
import { db } from "../lib/firebase";
import { getCycleBounds, getCycleId } from "../lib/cycle-utils";
import { getOrCreateCycle, deleteTransaction, TransactionData, StatementCycleData } from "../lib/db-helpers";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
} from "firebase/firestore";
import { Edit2, Trash2, ShieldCheck, ShieldAlert, ArrowUpRight, ArrowDownLeft, Receipt } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { addTransaction } from "../lib/db-helpers";
import { cn } from "../lib/utils";

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

export default function Dashboard() {
  const { user, profile } = useAuth();
  const router = useRouter();

  // State for cycle & transactions
  const [cycle, setCycle] = useState<StatementCycleData | null>(null);
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Desktop Quick Add Form State
  const [quickName, setQuickName] = useState("");
  const [quickAmount, setQuickAmount] = useState("");
  const [quickDeposit, setQuickDeposit] = useState("");
  const [quickOwner, setQuickOwner] = useState<string>("");
  const [quickLoading, setQuickLoading] = useState(false);

  const buckets = useMemo(() => profile?.buckets || ["HOME", "MINE"], [profile?.buckets]);
  const cycleStartDay = profile?.cycleStartDay || 17;

  // Initialize quickOwner when profile/buckets load
  useEffect(() => {
    if (buckets.length > 0 && !quickOwner) {
      const firstBucket = buckets[0];
      Promise.resolve().then(() => {
        setQuickOwner(firstBucket);
      });
    }
  }, [buckets, quickOwner]);

  // Calculate current cycle ID on load
  useEffect(() => {
    if (!user || !profile) return;

    let unsubscribeTx = () => {};
    let unsubscribeCycle = () => {};

    const setupData = async () => {
      try {
        const bounds = getCycleBounds(new Date(), cycleStartDay);
        const cycleIdKey = getCycleId(bounds.startDate);
        const fullCycleId = `${user.uid}_${cycleIdKey}`;

        // Ensure cycle document exists in DB
        await getOrCreateCycle(user.uid, new Date(), cycleStartDay);

        // 1. Listen to Cycle Document
        const cycleDocRef = doc(db, "statementCycles", fullCycleId);
        unsubscribeCycle = onSnapshot(
          cycleDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              setCycle({
                id: data.id,
                userId: data.userId,
                startDate: data.startDate.toDate(),
                endDate: data.endDate.toDate(),
                title: data.title,
                year: data.year,
                status: data.status,
              });
            }
          },
          (err) => {
            console.error("Dashboard cycle load error:", err);
            setLoadingData(false);
          }
        );

        // 2. Listen to Transactions
        const txQuery = query(
          collection(db, "transactions"),
          where("userId", "==", user.uid),
          where("cycleId", "==", fullCycleId)
        );

        unsubscribeTx = onSnapshot(
          txQuery,
          (querySnap) => {
            const txList: TransactionData[] = [];
            querySnap.forEach((doc) => {
              const data = doc.data();
              if (data.deleted) return;
              txList.push({
                id: data.id,
                userId: data.userId,
                transactionName: data.transactionName,
                amount: Number(data.amount),
                deposit: Number(data.deposit),
                owner: data.owner,
                transactionDate: data.transactionDate.toDate(),
                cycleId: data.cycleId,
                deleted: data.deleted,
              });
            });

            // Sort in memory by transactionDate desc, then createdAt desc
            txList.sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime());
            setTransactions(txList);
            setLoadingData(false);
          },
          (err) => {
            console.error("Dashboard transactions load error:", err);
            setLoadingData(false);
          }
        );
      } catch (err) {
        console.error("Dashboard data load error:", err);
        setLoadingData(false);
      }
    };

    setupData();

    return () => {
      unsubscribeTx();
      unsubscribeCycle();
    };
  }, [user, profile, cycleStartDay]);

  // Calculations
  const displayBuckets = [...buckets];
  transactions.forEach((t) => {
    if (t.owner && !displayBuckets.includes(t.owner)) {
      displayBuckets.push(t.owner);
    }
  });

  const bucketData = displayBuckets.map((bucket) => {
    let total = 0;
    let deposits = 0;
    transactions.forEach((t) => {
      if (t.owner === bucket) {
        total += t.amount;
        deposits += t.deposit;
      }
    });
    return {
      name: bucket,
      total,
      deposits,
      outstanding: total - deposits,
    };
  });

  let totalSpend = 0;
  let totalDeposits = 0;
  transactions.forEach((t) => {
    totalSpend += t.amount;
    totalDeposits += t.deposit;
  });
  const totalOutstanding = totalSpend - totalDeposits;

  const isCycleClosed = cycle?.status === "CLOSED";

  // Desktop Quick Add Handler
  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isCycleClosed) return;
    if (!quickName.trim() || !quickAmount) return;

    setQuickLoading(true);
    try {
      await addTransaction(user.uid, {
        transactionName: quickName,
        transactionDate: new Date(),
        amount: Number(quickAmount),
        deposit: Number(quickDeposit) || 0,
        owner: quickOwner || buckets[0],
      }, cycleStartDay);

      // Reset Form
      setQuickName("");
      setQuickAmount("");
      setQuickDeposit("");
      setQuickOwner(buckets[0] || "");
    } catch (err) {
      const errorVal = err as { message?: string };
      alert(errorVal?.message || "Failed to add transaction.");
    } finally {
      setQuickLoading(false);
    }
  };

  const handleEditClick = (tx: TransactionData) => {
    if (isCycleClosed) {
      alert("This statement cycle is closed and read-only.");
      return;
    }
    router.push(`/add?edit=${tx.id}`);
  };

  const handleDeleteClick = async (txId: string) => {
    if (isCycleClosed) {
      alert("This statement cycle is closed and read-only.");
      return;
    }
    if (confirm("Are you sure you want to delete this transaction?")) {
      try {
        await deleteTransaction(txId);
      } catch (err) {
        const errorVal = err as { message?: string };
        alert(errorVal?.message || "Failed to delete transaction.");
      }
    }
  };

  if (loadingData) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center min-h-[50vh] text-zinc-400 gap-2">
        <div className="h-8 w-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Syncing statement details...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Main Dashboard Panel */}
      <div className="flex-1 space-y-8">
        {/* Header section */}
        <div className="flex justify-between items-end border-b border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-widest">
                Active Statement
              </span>
              {isCycleClosed ? (
                <span className="flex items-center gap-1 rounded bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-400 border border-red-500/20">
                  <ShieldAlert className="h-3 w-3" /> Locked
                </span>
              ) : (
                <span className="flex items-center gap-1 rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-400 border border-green-500/20">
                  <ShieldCheck className="h-3 w-3" /> Active
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              {cycle ? cycle.title : "Calculating Cycle..."}
            </h2>
            <p className="text-xs text-zinc-500 mt-1">
              {cycle && `${cycle.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} - ${cycle.endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
            </p>
          </div>
        </div>

        {/* Overall Summary Cards */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          {/* Spend Card */}
          <div className="bg-[#111113] border border-zinc-800 rounded-2xl p-3 sm:p-5 flex flex-col items-center justify-center text-center group transition-all hover:border-zinc-750" title="Total Spend">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mb-1.5 sm:mb-2.5">
              <ArrowUpRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <h3 className="text-xs sm:text-base md:text-xl font-extrabold text-white tracking-tight truncate w-full">
              ₹{totalSpend.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </h3>
          </div>

          {/* Deposits Card */}
          <div className="bg-[#111113] border border-zinc-800 rounded-2xl p-3 sm:p-5 flex flex-col items-center justify-center text-center group transition-all hover:border-zinc-750" title="Total Deposits">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center mb-1.5 sm:mb-2.5">
              <ArrowDownLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <h3 className="text-xs sm:text-base md:text-xl font-extrabold text-green-500 tracking-tight truncate w-full">
              ₹{totalDeposits.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </h3>
          </div>

          {/* Outstanding Card */}
          <div className="bg-[#111113] border border-zinc-800 rounded-2xl p-3 sm:p-5 flex flex-col items-center justify-center text-center group transition-all hover:border-zinc-750" title="Total Outstanding">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center mb-1.5 sm:mb-2.5">
              <Receipt className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <h3 className="text-xs sm:text-base md:text-xl font-extrabold text-blue-400 tracking-tight truncate w-full">
              ₹{totalOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </h3>
          </div>
        </div>

        {/* Bucket Split Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {bucketData.map((b) => {
            const colors = getBucketColor(b.name);
            const isConfigured = buckets.includes(b.name);
            return (
              <div key={b.name} className="bg-[#111113] border border-zinc-800 rounded-2xl p-6 relative">
                <div className="flex items-center justify-between mb-4 border-b border-zinc-800/50 pb-3">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full", colors.solid)} />
                    <span className="text-sm font-bold text-white tracking-wide truncate max-w-[120px]" title={b.name}>
                      {b.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500 font-medium">
                    {isConfigured ? "Active" : "Legacy"}
                  </span>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-zinc-400">Total Spend</span>
                    <span className="text-base font-semibold text-zinc-200">
                      ₹{b.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs text-zinc-400">Deposits Received</span>
                    <span className="text-base font-semibold text-green-500">
                      ₹{b.deposits.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline border-t border-zinc-800/30 pt-3">
                    <span className="text-xs font-semibold text-zinc-300">Outstanding</span>
                    <span className={cn("text-lg font-bold", colors.text)}>
                      ₹{b.outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Transactions List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white tracking-tight">Recent Transactions</h3>
            <span className="text-xs text-zinc-500">{transactions.length} items this cycle</span>
          </div>

          {transactions.length === 0 ? (
            <div className="bg-[#111113] border border-zinc-800 border-dashed rounded-2xl p-8 text-center text-zinc-500 text-sm">
              No transactions recorded in the current statement cycle yet.
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 10).map((tx) => {
                const outstandingAmt = Math.max(0, tx.amount - tx.deposit);
                const badgeColors = getBucketColor(tx.owner);
                return (
                  <div
                    key={tx.id}
                    className="bg-[#111113] border border-zinc-800 hover:border-zinc-700/80 p-4 rounded-xl flex items-center justify-between gap-4 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm text-zinc-100 truncate">
                          {tx.transactionName}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded border",
                            badgeColors.bg,
                            badgeColors.text,
                            badgeColors.border
                          )}
                        >
                          {tx.owner}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">
                        {tx.transactionDate.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Financial info */}
                      <div className="text-right">
                        <p className="text-sm font-semibold text-zinc-200">
                          ₹{tx.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </p>
                        {tx.deposit > 0 && (
                          <p className="text-[10px] text-zinc-500">
                            Collected: ₹{tx.deposit} | Out: ₹{outstandingAmt}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 border-l border-zinc-800 pl-3">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleEditClick(tx)}
                          disabled={isCycleClosed}
                          className="h-8 w-8 hover:bg-zinc-800 text-zinc-400 hover:text-white"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDeleteClick(tx.id!)}
                          disabled={isCycleClosed}
                          className="h-8 w-8 hover:bg-red-500/10 text-zinc-400 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Profile Card at the end */}
        {user && (
          <div className="glass-panel border border-white/5 p-6 relative overflow-hidden flex flex-col sm:flex-row items-center gap-6 bg-[#111113]/40">
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-blue-500/5 blur-2xl pointer-events-none"></div>
            
            {/* Avatar with status glow */}
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-md scale-105"></div>
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || "User"}
                  className="relative w-20 h-20 rounded-full border border-white/10 ring-4 ring-blue-500/10 object-cover"
                />
              ) : (
                <div className="relative w-20 h-20 rounded-full bg-zinc-800 flex items-center justify-center text-blue-400 font-extrabold text-2xl uppercase border border-white/10 ring-4 ring-blue-500/10">
                  {user.displayName?.charAt(0) || "U"}
                </div>
              )}
            </div>

            {/* User Details */}
            <div className="flex-1 text-center sm:text-left space-y-1">
              <h4 className="text-lg font-bold text-white font-sans tracking-tight">
                {user.displayName || "Active Member"}
              </h4>
              <p className="text-xs text-zinc-400 font-body">
                {user.email}
              </p>
              <div className="flex flex-wrap justify-center sm:justify-start gap-x-3 gap-y-1.5 pt-2 text-[11px] text-zinc-500 font-medium">
                <span>Location: Mumbai, India</span>
                <span className="text-zinc-700">•</span>
                <span>Role: Card Administrator</span>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex gap-2 shrink-0">
              <a
                href="https://github.com/mihir-28"
                target="_blank"
                rel="noreferrer"
                className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-zinc-400 hover:text-white transition-all duration-300"
                title="GitHub"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                </svg>
              </a>
              <a
                href="https://www.linkedin.com/in/mihir-an28/"
                target="_blank"
                rel="noreferrer"
                className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-zinc-400 hover:text-white transition-all duration-300"
                title="LinkedIn"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
              </a>
              <a
                href="https://x.com/kyayaar_mihir"
                target="_blank"
                rel="noreferrer"
                className="p-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-zinc-400 hover:text-white transition-all duration-300"
                title="Twitter / X"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Quick Add Panel (Right Sidebar on Desktop screens) */}
      <div className="hidden lg:block w-80 shrink-0">
        <div className="bg-[#111113] border border-zinc-800 rounded-2xl p-6 sticky top-8">
          <h3 className="text-base font-bold text-white tracking-tight mb-4">Quick Add</h3>
          
          <form onSubmit={handleQuickAddSubmit} className="space-y-4">
            {/* Transaction Name */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Transaction Name
              </label>
              <Input
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                placeholder="e.g., Electricity"
                required
                className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 rounded-lg h-9 text-xs"
              />
            </div>

            {/* Amount & Deposit */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Amount (₹)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={quickAmount}
                  onChange={(e) => setQuickAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 rounded-lg h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Deposit (₹)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  value={quickDeposit}
                  onChange={(e) => setQuickDeposit(e.target.value)}
                  placeholder="0.00"
                  className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 rounded-lg h-9 text-xs"
                />
              </div>
            </div>

            {/* Owner Toggle */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Allocate to Bucket
              </label>
              <div className="flex flex-wrap gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                {buckets.map((b) => {
                  const isSelected = quickOwner === b;
                  const bucketTheme = getBucketColor(b);
                  return (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setQuickOwner(b)}
                      className={cn(
                        "flex-1 min-w-[70px] py-1.5 px-2.5 text-[10px] font-bold rounded transition-all cursor-pointer text-center truncate",
                        isSelected
                          ? `${bucketTheme.solid} text-black font-extrabold shadow-sm`
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                      )}
                      title={b}
                    >
                      {b}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live preview line */}
            {quickAmount && (
              <div className="pt-2 flex justify-between text-[11px] border-t border-zinc-800/50">
                <span className="text-zinc-500">Outstanding preview:</span>
                <span className="font-semibold text-blue-400">
                  ₹{Math.max(0, Number(quickAmount) - (Number(quickDeposit) || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={quickLoading || isCycleClosed}
              className="w-full bg-zinc-100 hover:bg-zinc-200 text-black font-semibold rounded-lg h-9 text-xs transition duration-150 cursor-pointer"
            >
              {quickLoading ? "Saving..." : "Add Transaction"}
            </Button>
          </form>
        </div>
      </div>

    </div>
  );
}
