"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/auth-context";
import { db } from "../lib/firebase";
import { getCycleBounds, getCycleId } from "../lib/cycle-utils";
import { getOrCreateCycle, deleteTransaction, TransactionData, StatementCycleData, decryptTransactionDoc, decryptStatementCycleDoc } from "../lib/db-helpers";
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
import { evaluateAmountExpression } from "../lib/calculator";

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
  const [quickAmountError, setQuickAmountError] = useState("");
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
          async (docSnap) => {
            if (docSnap.exists()) {
              setCycle(await decryptStatementCycleDoc(docSnap.data(), docSnap.id));
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
          async (querySnap) => {
            const txList = await Promise.all(
              querySnap.docs.map((docSnap) => decryptTransactionDoc(docSnap.data(), docSnap.id))
            );
            const activeTxList = txList.filter((tx) => !tx.deleted);

            // Sort in memory by transactionDate desc, then createdAt desc
            activeTxList.sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime());
            setTransactions(activeTxList);
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

    let resolvedAmount = 0;
    try {
      resolvedAmount = evaluateAmountExpression(quickAmount);
      if (resolvedAmount <= 0) {
        throw new Error("Amount must be greater than 0.");
      }
      setQuickAmount(resolvedAmount.toFixed(2));
      setQuickAmountError("");
    } catch (error) {
      setQuickAmountError((error as { message?: string }).message || "Invalid amount expression.");
      return;
    }

    setQuickLoading(true);
    try {
      await addTransaction(user.uid, {
        transactionName: quickName,
        transactionDate: new Date(),
        amount: resolvedAmount,
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
      <div className="flex flex-col flex-1 items-center justify-center min-h-[50vh] text-zinc-400">
        <div className="relative w-12 h-12 mb-3">
          <div className="absolute inset-0 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin"></div>
          <div className="absolute inset-1 rounded-full border-2 border-purple-500/15 border-b-purple-400 animate-spin duration-1000"></div>
        </div>
        <p className="text-xs tracking-widest text-zinc-400 font-sans uppercase animate-pulse">Syncing statement details...</p>
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
                    <span className="text-sm font-bold text-white tracking-wide truncate max-w-30" title={b.name}>
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
                  type="text"
                  inputMode="decimal"
                  value={quickAmount}
                  onChange={(e) => {
                    setQuickAmount(e.target.value);
                    setQuickAmountError("");
                  }}
                  onBlur={() => {
                    if (!quickAmount.trim()) return;
                    try {
                      setQuickAmount(evaluateAmountExpression(quickAmount).toFixed(2));
                      setQuickAmountError("");
                    } catch (error) {
                      setQuickAmountError((error as { message?: string }).message || "Invalid amount expression.");
                    }
                  }}
                  placeholder="100+50*2"
                  required
                  className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 rounded-lg h-9 text-xs"
                />
                {quickAmountError && (
                  <p className="text-[10px] text-red-400">{quickAmountError}</p>
                )}
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
                  ₹{(() => {
                    try {
                      return Math.max(0, evaluateAmountExpression(quickAmount) - (Number(quickDeposit) || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 });
                    } catch {
                      return "0.00";
                    }
                  })()}
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
