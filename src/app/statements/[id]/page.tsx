"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../context/auth-context";
import { db } from "../../../lib/firebase";
import { closeCycle, StatementCycleData, TransactionData } from "../../../lib/db-helpers";
import { doc, collection, query, where, onSnapshot } from "firebase/firestore";
import { ArrowLeft, Lock, Unlock, Calendar, AlertCircle, ShieldCheck, ArrowUpRight, ArrowDownLeft, Receipt } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";

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

export default function StatementDetailsPage() {
  const { user, profile } = useAuth();
  const { id } = useParams() as { id: string };
  const router = useRouter();

  const [cycle, setCycle] = useState<StatementCycleData | null>(null);
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [closingLoading, setClosingLoading] = useState(false);

  useEffect(() => {
    if (!user || !id) return;

    // 1. Listen to specific statement cycle document
    const cycleDocRef = doc(db, "statementCycles", id);
    const unsubscribeCycle = onSnapshot(
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
        } else {
          // If not found, redirect to archive list
          router.push("/statements");
        }
      },
      (err) => {
        console.error("Statement detail cycle load error:", err);
        setLoading(false);
      }
    );

    // 2. Listen to transactions for this specific cycle
    const txQuery = query(
      collection(db, "transactions"),
      where("userId", "==", user.uid),
      where("cycleId", "==", id)
    );
    const unsubscribeTx = onSnapshot(
      txQuery,
      (snap) => {
        const list: TransactionData[] = [];
        snap.forEach((doc) => {
          const data = doc.data();
          if (data.deleted) return;
          list.push({
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
        // Sort desc by date
        list.sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime());
        setTransactions(list);
        setLoading(false);
      },
      (err) => {
        console.error("Statement detail transactions load error:", err);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeCycle();
      unsubscribeTx();
    };
  }, [user, id, router]);

  // Calculations
  const buckets = profile?.buckets || ["HOME", "MINE"];

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

  // Statement Locking checks
  const isClosed = cycle?.status === "CLOSED";
  const today = new Date();
  
  // Can close only if: today is after the end date, and statement is currently OPEN
  const canClose = cycle ? (today >= cycle.endDate && !isClosed) : false;

  const handleCloseStatement = async () => {
    if (!cycle || !canClose) return;

    if (
      confirm(
        `Are you sure you want to CLOSE this statement cycle ("${cycle.title}")?\n\nThis will lock all transactions, making them permanently read-only for historical audit accuracy.`
      )
    ) {
      setClosingLoading(true);
      try {
        await closeCycle(cycle.id);
      } catch (err) {
        const errorVal = err as { message?: string };
        alert(errorVal?.message || "Failed to close statement.");
      } finally {
        setClosingLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center min-h-[50vh] text-zinc-400 gap-2">
        <div className="h-8 w-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Loading statement details...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top navigation */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => router.push("/statements")}
          className="h-8 w-8 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs text-zinc-500 font-medium">Back to archive</span>
      </div>

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-zinc-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold text-blue-400 uppercase tracking-widest">
              Statement Details
            </span>
            {isClosed ? (
              <span className="flex items-center gap-1 rounded bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400 border border-red-500/20">
                <Lock className="h-3 w-3" /> Locked
              </span>
            ) : (
              <span className="flex items-center gap-1 rounded bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-green-400 border border-green-500/20">
                <Unlock className="h-3 w-3" /> Open
              </span>
            )}
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            {cycle ? cycle.title : "Calculating Cycle..."}
          </h2>
          <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {cycle && `${cycle.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} - ${cycle.endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
          </p>
        </div>

        {/* Lock Action Button */}
        <div>
          {isClosed ? (
            <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-2.5 text-xs text-zinc-400">
              <ShieldCheck className="h-4 w-4 text-zinc-500" />
              <span>Locked & Preserved</span>
            </div>
          ) : (
            <div className="flex flex-col items-end gap-1.5">
              <Button
                onClick={handleCloseStatement}
                disabled={!canClose || closingLoading}
                className={cn(
                  "h-10 px-5 font-semibold rounded-xl text-xs transition duration-150 cursor-pointer",
                  canClose
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-[#18181b] border border-zinc-800 text-zinc-500 cursor-not-allowed"
                )}
              >
                {closingLoading ? "Locking..." : "Close Statement"}
              </Button>
              {!canClose && (
                <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Closing enabled after statement end date.
                </span>
              )}
            </div>
          )}
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
            <div key={b.name} className="bg-[#111113] border border-zinc-800 rounded-2xl p-6">
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
                  <span className="text-sm font-medium text-zinc-200">
                    ₹{b.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-zinc-400">Deposits Received</span>
                  <span className="text-sm font-medium text-green-500">
                    ₹{b.deposits.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-baseline border-t border-zinc-800/30 pt-3">
                  <span className="text-xs font-semibold text-zinc-300">Outstanding</span>
                  <span className={cn("text-base font-bold", colors.text)}>
                    ₹{b.outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* List of statement transactions */}
      <div className="space-y-4">
        <h3 className="text-base font-bold text-white tracking-tight">Statement Transactions</h3>

        {transactions.length === 0 ? (
          <div className="bg-[#111113] border border-zinc-800 border-dashed rounded-2xl p-8 text-center text-zinc-500 text-sm">
            No transactions recorded for this statement period.
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => {
              const outstandingAmt = Math.max(0, tx.amount - tx.deposit);
              return (
                <div
                  key={tx.id}
                  className="bg-[#111113] border border-zinc-800 p-4 rounded-xl flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-zinc-100 truncate">
                        {tx.transactionName}
                      </span>
                      {(() => {
                        const badgeColors = getBucketColor(tx.owner);
                        return (
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
                        );
                      })()}
                    </div>
                    <p className="text-xs text-zinc-500">
                      {tx.transactionDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold text-zinc-200">
                      ₹{tx.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                    {tx.deposit > 0 && (
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        Collected: ₹{tx.deposit.toLocaleString("en-IN")} | Outstanding: ₹{outstandingAmt.toLocaleString("en-IN")}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
