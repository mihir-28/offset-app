"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../context/auth-context";
import { db } from "../../../lib/firebase";
import { closeCycle, StatementCycleData, TransactionData } from "../../../lib/db-helpers";
import { doc, collection, query, where, onSnapshot } from "firebase/firestore";
import { ArrowLeft, Lock, Unlock, Calendar, AlertCircle, ShieldCheck } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { cn } from "../../../lib/utils";

export default function StatementDetailsPage() {
  const { user } = useAuth();
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
          list.push({
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

      {/* Financial stats summary blocks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Spend */}
        <div className="bg-[#111113] border border-zinc-800 rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
            Total Spend
          </p>
          <p className="text-2xl font-bold text-white tracking-tight">
            ₹{totalSpend.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Deposits */}
        <div className="bg-[#111113] border border-zinc-800 rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
            Total Deposits
          </p>
          <p className="text-2xl font-bold text-green-500 tracking-tight">
            ₹{totalDeposits.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
        </div>

        {/* Outstanding */}
        <div className="bg-[#111113] border border-zinc-800 rounded-2xl p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1.5">
            Outstanding Liability
          </p>
          <p className="text-2xl font-bold text-blue-400 tracking-tight">
            ₹{totalOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Home & Mine details grids */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Home Summary */}
        <div className="bg-[#111113] border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4 border-b border-zinc-800/50 pb-3">
            <span className="text-sm font-bold text-white tracking-wide">HOME</span>
            <span className="text-xs text-zinc-500">Shared Liability</span>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-zinc-400">Home Total</span>
              <span className="text-sm font-medium text-zinc-200">
                ₹{homeTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-zinc-400">Home Deposits</span>
              <span className="text-sm font-medium text-green-500">
                ₹{homeDeposits.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-baseline border-t border-zinc-800/30 pt-3">
              <span className="text-xs font-semibold text-zinc-300">Home Outstanding</span>
              <span className="text-base font-bold text-blue-400">
                ₹{homeOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Mine Summary */}
        <div className="bg-[#111113] border border-zinc-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4 border-b border-zinc-800/50 pb-3">
            <span className="text-sm font-bold text-white tracking-wide">MINE</span>
            <span className="text-xs text-zinc-500">Personal Liability</span>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-zinc-400">My Total</span>
              <span className="text-sm font-medium text-zinc-200">
                ₹{myTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-zinc-400">My Deposits</span>
              <span className="text-sm font-medium text-green-500">
                ₹{myDeposits.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-baseline border-t border-zinc-800/30 pt-3">
              <span className="text-xs font-semibold text-zinc-300">My Outstanding</span>
              <span className="text-base font-bold text-blue-400">
                ₹{myOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
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
