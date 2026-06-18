"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/auth-context";
import { db } from "../../lib/firebase";
import { getCycleBounds, getCycleId } from "../../lib/cycle-utils";
import { deleteTransaction, TransactionData, StatementCycleData } from "../../lib/db-helpers";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Search, Plus, Edit2, Trash2, Lock } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
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

export default function TransactionsPage() {
  const { user, profile } = useAuth();
  const router = useRouter();

  // Database State
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [cycles, setCycles] = useState<Record<string, StatementCycleData>>({});
  const [loading, setLoading] = useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<string>("ALL");
  const [cycleFilter, setCycleFilter] = useState<"CURRENT" | "ALL">("CURRENT");

  const buckets = profile?.buckets || ["HOME", "MINE"];
  const cycleStartDay = profile?.cycleStartDay || 17;

  // Fetch cycles and transactions
  useEffect(() => {
    if (!user) return;

    // 1. Listen to Cycles to check lock status
    const cyclesQuery = query(
      collection(db, "statementCycles"),
      where("userId", "==", user.uid)
    );
    
    const unsubscribeCycles = onSnapshot(
      cyclesQuery,
      (snap) => {
        const cycleMap: Record<string, StatementCycleData> = {};
        snap.forEach((doc) => {
          const data = doc.data();
          cycleMap[data.id] = {
            id: data.id,
            userId: data.userId,
            startDate: data.startDate.toDate(),
            endDate: data.endDate.toDate(),
            title: data.title,
            year: data.year,
            status: data.status,
          };
        });
        setCycles(cycleMap);
      },
      (err) => {
        console.error("Transaction cycles load error:", err);
        setLoading(false);
      }
    );

    // 2. Listen to Transactions
    const txQuery = query(
      collection(db, "transactions"),
      where("userId", "==", user.uid)
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
        
        // Sort desc
        list.sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime());
        setTransactions(list);
        setLoading(false);
      },
      (err) => {
        console.error("Transactions load error:", err);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeCycles();
      unsubscribeTx();
    };
  }, [user]);

  // Determine current active cycle ID
  const bounds = getCycleBounds(new Date(), cycleStartDay);
  const currentCycleIdKey = getCycleId(bounds.startDate);
  const currentFullCycleId = user ? `${user.uid}_${currentCycleIdKey}` : "";

  // Apply Filters in memory
  const filteredTransactions = transactions.filter((tx) => {
    // 1. Cycle Filter
    if (cycleFilter === "CURRENT" && tx.cycleId !== currentFullCycleId) {
      return false;
    }

    // 2. Owner Filter
    if (ownerFilter !== "ALL" && tx.owner !== ownerFilter) {
      return false;
    }

    // 3. Search Filter
    if (
      searchQuery.trim() !== "" &&
      !tx.transactionName.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }

    return true;
  });

  // Calculate filtered totals
  let filteredTotalSpend = 0;
  let filteredTotalDeposits = 0;
  
  filteredTransactions.forEach((tx) => {
    filteredTotalSpend += tx.amount;
    filteredTotalDeposits += tx.deposit;
  });

  const filteredTotalOutstanding = Math.max(0, filteredTotalSpend - filteredTotalDeposits);

  const handleEditClick = (tx: TransactionData) => {
    const isClosed = cycles[tx.cycleId]?.status === "CLOSED";
    if (isClosed) {
      alert("This transaction is in a closed statement cycle and is read-only.");
      return;
    }
    router.push(`/add?edit=${tx.id}`);
  };

  const handleDeleteClick = async (tx: TransactionData) => {
    const isClosed = cycles[tx.cycleId]?.status === "CLOSED";
    if (isClosed) {
      alert("This transaction is in a closed statement cycle and is read-only.");
      return;
    }
    if (confirm("Are you sure you want to delete this transaction?")) {
      try {
        await deleteTransaction(tx.id!);
      } catch (err) {
        const errorVal = err as { message?: string };
        alert(errorVal?.message || "Failed to delete transaction.");
      }
    }
  };

  const handleAddNewClick = () => {
    router.push("/add");
  };

  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center min-h-[50vh] text-zinc-400 gap-2">
        <div className="h-8 w-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Loading ledger...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Transactions</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Manage your card spend and liabilities.
          </p>
        </div>
        <Button
          onClick={handleAddNewClick}
          className="hidden md:inline-flex bg-blue-500 hover:bg-blue-600 text-black font-semibold rounded-xl h-10 px-4"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Add Transaction
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="bg-[#111113] border border-zinc-800 rounded-2xl p-4 md:p-5 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* Search bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <Input
              type="text"
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 rounded-lg pl-10 h-10 text-sm"
            />
          </div>

          {/* Owner Filter */}
          <div className="flex flex-wrap items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800 select-none gap-1">
            {(() => {
              const filterOptions = ["ALL", ...buckets];
              transactions.forEach((tx) => {
                if (tx.owner && !filterOptions.includes(tx.owner)) {
                  filterOptions.push(tx.owner);
                }
              });
              return filterOptions.map((opt) => {
                const isSelected = ownerFilter === opt;
                const colors = opt === "ALL" 
                  ? { solid: "bg-blue-500" } 
                  : getBucketColor(opt);
                return (
                  <button
                    key={opt}
                    onClick={() => setOwnerFilter(opt)}
                    className={cn(
                      "px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer",
                      isSelected
                        ? `${colors.solid} text-black shadow`
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                    )}
                  >
                    {opt}
                  </button>
                );
              });
            })()}
          </div>

          {/* Cycle Filter */}
          <div className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800 select-none">
            <button
              onClick={() => setCycleFilter("CURRENT")}
              className={cn(
                "px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer",
                cycleFilter === "CURRENT"
                  ? "bg-blue-500 text-black shadow"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              Current Cycle
            </button>
            <button
              onClick={() => setCycleFilter("ALL")}
              className={cn(
                "px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer",
                cycleFilter === "ALL"
                  ? "bg-blue-500 text-black shadow"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              All Cycles
            </button>
          </div>
        </div>

        {/* Filter Summary Stats Banner */}
        <div className="flex flex-wrap items-center justify-between border-t border-zinc-800/50 pt-3 text-xs text-zinc-400 gap-2">
          <div>
            Showing <span className="font-semibold text-zinc-200">{filteredTransactions.length}</span> transaction(s)
          </div>
          <div className="flex items-center gap-4">
            <div>
              Total: <span className="font-semibold text-zinc-200">₹{filteredTotalSpend.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
            <div>
              Deposits: <span className="font-semibold text-green-500">₹{filteredTotalDeposits.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-800" />
            <div>
              Outstanding: <span className="font-bold text-blue-400">₹{filteredTotalOutstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Ledger Transactions list */}
      {filteredTransactions.length === 0 ? (
        <div className="bg-[#111113] border border-zinc-800 border-dashed rounded-2xl p-12 text-center text-zinc-500 text-sm">
          No transactions match the selected filters.
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTransactions.map((tx) => {
            const isClosed = cycles[tx.cycleId]?.status === "CLOSED";
            const outstandingAmt = Math.max(0, tx.amount - tx.deposit);
            const cycleTitle = cycles[tx.cycleId]?.title || "Calculating Cycle...";
            const badgeColors = getBucketColor(tx.owner);

            return (
              <div
                key={tx.id}
                className={cn(
                  "bg-[#111113] border border-zinc-800 hover:border-zinc-700/80 p-4 rounded-xl flex items-center justify-between gap-4 transition-all",
                  isClosed && "opacity-80 border-dashed"
                )}
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
                    {isClosed && (
                      <span className="flex items-center gap-0.5 rounded bg-zinc-800 px-1 py-0.5 text-[9px] font-medium text-zinc-400 border border-zinc-700">
                        <Lock className="h-2.5 w-2.5" /> locked
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                    <span>
                      {tx.transactionDate.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-zinc-800" />
                    <span>{cycleTitle}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Financial stats */}
                  <div className="text-right">
                    <p className="text-sm font-semibold text-zinc-200">
                      ₹{tx.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                    {tx.deposit > 0 ? (
                      <p className="text-[10px] text-zinc-500 mt-0.5">
                        Col: ₹{tx.deposit.toLocaleString("en-IN")} | Out: ₹{outstandingAmt.toLocaleString("en-IN")}
                      </p>
                    ) : (
                      <p className="text-[10px] text-zinc-500 mt-0.5">No deposit</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 border-l border-zinc-800 pl-3">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleEditClick(tx)}
                      disabled={isClosed}
                      className={cn(
                        "h-8 w-8 text-zinc-400 hover:text-white",
                        isClosed ? "opacity-30 cursor-not-allowed" : "hover:bg-zinc-800"
                      )}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDeleteClick(tx)}
                      disabled={isClosed}
                      className={cn(
                        "h-8 w-8 text-zinc-400 hover:text-red-400",
                        isClosed ? "opacity-30 cursor-not-allowed" : "hover:bg-red-500/10"
                      )}
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
  );
}
