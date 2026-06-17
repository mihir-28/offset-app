"use client";

import React, { useEffect, useState } from "react";
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
import { Plus, Edit2, Trash2, ShieldCheck, ShieldAlert, ArrowUpRight, ArrowDownLeft, Receipt } from "lucide-react";
import { AddTransactionSheet } from "../components/add-transaction-sheet";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { addTransaction } from "../lib/db-helpers";
import { cn } from "../lib/utils";

export default function Dashboard() {
  const { user } = useAuth();
  
  // State for cycle & transactions
  const [cycle, setCycle] = useState<StatementCycleData | null>(null);
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Sheets & Forms State
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState<TransactionData | null>(null);

  // Desktop Quick Add Form State
  const [quickName, setQuickName] = useState("");
  const [quickAmount, setQuickAmount] = useState("");
  const [quickDeposit, setQuickDeposit] = useState("");
  const [quickOwner, setQuickOwner] = useState<"HOME" | "MINE">("MINE");
  const [quickLoading, setQuickLoading] = useState(false);

  // Calculate current cycle ID on load
  useEffect(() => {
    if (!user) return;

    let unsubscribeTx = () => {};
    let unsubscribeCycle = () => {};

    const setupData = async () => {
      try {
        const bounds = getCycleBounds(new Date());
        const cycleIdKey = getCycleId(bounds.startDate);
        const fullCycleId = `${user.uid}_${cycleIdKey}`;

        // Ensure cycle document exists in DB
        await getOrCreateCycle(user.uid, new Date());

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
              txList.push({
                id: data.id,
                userId: data.userId,
                transactionName: data.transactionName,
                amount: Number(data.amount),
                deposit: Number(data.deposit),
                owner: data.owner,
                transactionDate: data.transactionDate.toDate(),
                cycleId: data.cycleId,
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
  }, [user]);

  // Calculations
  let homeTotal = 0;
  let homeDeposits = 0;
  let myTotal = 0;
  let myDeposits = 0;

  transactions.forEach((t) => {
    if (t.owner === "HOME") {
      homeTotal += t.amount;
      homeDeposits += t.deposit;
    } else {
      myTotal += t.amount;
      myDeposits += t.deposit;
    }
  });

  const homeOutstanding = homeTotal - homeDeposits;
  const myOutstanding = myTotal - myDeposits;

  const totalSpend = homeTotal + myTotal;
  const totalDeposits = homeDeposits + myDeposits;
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
        owner: quickOwner,
      });

      // Reset Form
      setQuickName("");
      setQuickAmount("");
      setQuickDeposit("");
      setQuickOwner("MINE");
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
    setSelectedTx(tx);
    setSheetOpen(true);
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

  const handleCreateNewClick = () => {
    if (isCycleClosed) {
      alert("Current cycle is closed. You can add transactions to open cycles via the Transactions page.");
      return;
    }
    setSelectedTx(null);
    setSheetOpen(true);
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
          <Button
            onClick={handleCreateNewClick}
            disabled={isCycleClosed}
            className="md:hidden h-10 bg-blue-500 hover:bg-blue-600 text-black font-semibold rounded-xl"
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>

        {/* Overall Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Spend Card */}
          <div className="bg-[#111113] border border-zinc-800 rounded-2xl p-5 relative overflow-hidden group">
            <div className="absolute top-4 right-4 text-zinc-600 group-hover:text-zinc-500 transition-colors">
              <ArrowUpRight className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
              Total Spend
            </p>
            <h3 className="text-2xl font-bold text-white tracking-tight">
              ₹{totalSpend.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </h3>
          </div>

          {/* Deposits Card */}
          <div className="bg-[#111113] border border-zinc-800 rounded-2xl p-5 relative overflow-hidden group">
            <div className="absolute top-4 right-4 text-zinc-600 group-hover:text-zinc-500 transition-colors">
              <ArrowDownLeft className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
              Total Deposits
            </p>
            <h3 className="text-2xl font-bold text-green-500 tracking-tight">
              ₹{totalDeposits.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </h3>
          </div>

          {/* Outstanding Card */}
          <div className="bg-[#111113] border border-zinc-800 rounded-2xl p-5 relative overflow-hidden group">
            <div className="absolute top-4 right-4 text-zinc-600 group-hover:text-zinc-500 transition-colors">
              <Receipt className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
              Total Outstanding
            </p>
            <h3 className="text-2xl font-bold text-blue-400 tracking-tight">
              ₹{totalOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </h3>
          </div>
        </div>

        {/* Home & Mine Split Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* HOME Card */}
          <div className="bg-[#111113] border border-zinc-800 rounded-2xl p-6 relative">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-800/50 pb-3">
              <span className="text-sm font-bold text-white tracking-wide">HOME</span>
              <span className="text-xs text-zinc-500">Shared Liability</span>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-zinc-400">Home Total</span>
                <span className="text-base font-semibold text-zinc-200">
                  ₹{homeTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-zinc-400">Deposits Received</span>
                <span className="text-base font-semibold text-green-500">
                  ₹{homeDeposits.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-baseline border-t border-zinc-800/30 pt-3">
                <span className="text-xs font-semibold text-zinc-300">Outstanding</span>
                <span className="text-lg font-bold text-blue-400">
                  ₹{homeOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* MINE Card */}
          <div className="bg-[#111113] border border-zinc-800 rounded-2xl p-6 relative">
            <div className="flex items-center justify-between mb-4 border-b border-zinc-800/50 pb-3">
              <span className="text-sm font-bold text-white tracking-wide">MINE</span>
              <span className="text-xs text-zinc-500">Personal Liability</span>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-zinc-400">My Total</span>
                <span className="text-base font-semibold text-zinc-200">
                  ₹{myTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-zinc-400">Deposits Received</span>
                <span className="text-base font-semibold text-green-500">
                  ₹{myDeposits.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-baseline border-t border-zinc-800/30 pt-3">
                <span className="text-xs font-semibold text-zinc-300">Outstanding</span>
                <span className="text-lg font-bold text-blue-400">
                  ₹{myOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
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
                            "text-[10px] font-bold px-1.5 py-0.5 rounded",
                            tx.owner === "HOME"
                              ? "bg-blue-400/10 text-blue-400 border border-blue-400/20"
                              : "bg-purple-400/10 text-purple-400 border border-purple-400/20"
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
            <div className="space-y-1">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                Owner
              </label>
              <div className="flex bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setQuickOwner("HOME")}
                  className={cn(
                    "flex-1 py-1.5 text-[10px] font-bold rounded transition-all cursor-pointer",
                    quickOwner === "HOME"
                      ? "bg-blue-500 text-black font-semibold"
                      : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  HOME
                </button>
                <button
                  type="button"
                  onClick={() => setQuickOwner("MINE")}
                  className={cn(
                    "flex-1 py-1.5 text-[10px] font-bold rounded transition-all cursor-pointer",
                    quickOwner === "MINE"
                      ? "bg-blue-500 text-black font-semibold"
                      : "text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  MINE
                </button>
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

      {/* Floating Action Button (FAB) for Mobile / Tablet */}
      {!isCycleClosed && (
        <button
          onClick={handleCreateNewClick}
          className="lg:hidden fixed bottom-20 right-6 z-30 h-14 w-14 rounded-full bg-blue-500 hover:bg-blue-600 text-black flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer"
        >
          <Plus className="h-6 w-6 font-bold" />
        </button>
      )}

      {/* Add/Edit Sheet */}
      <AddTransactionSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        editData={selectedTx}
      />
    </div>
  );
}
