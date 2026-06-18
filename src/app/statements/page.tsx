"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../context/auth-context";
import { db } from "../../lib/firebase";
import { getYearOptions } from "../../lib/cycle-utils";
import { StatementCycleData, TransactionData } from "../../lib/db-helpers";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { ChevronRight, Calendar, Lock, Unlock} from "lucide-react";
import { cn } from "../../lib/utils";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

export default function StatementsPage() {
  const { user } = useAuth();
  const [cycles, setCycles] = useState<StatementCycleData[]>([]);
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>(
    new Date().getFullYear().toString()
  );

  const years = getYearOptions();

  // Load database streams
  useEffect(() => {
    if (!user) return;

    // 1. Listen to Cycles
    const cyclesQuery = query(
      collection(db, "statementCycles"),
      where("userId", "==", user.uid)
    );

    const unsubscribeCycles = onSnapshot(
      cyclesQuery,
      (snap) => {
        const list: StatementCycleData[] = [];
        snap.forEach((doc) => {
          const data = doc.data();
          list.push({
            id: data.id,
            userId: data.userId,
            startDate: data.startDate.toDate(),
            endDate: data.endDate.toDate(),
            title: data.title,
            year: Number(data.year),
            status: data.status,
          });
        });
        
        // Sort desc by start date
        list.sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
        setCycles(list);
      },
      (err) => {
        console.error("Statement cycles load error:", err);
        setLoading(false);
      }
    );

    // 2. Listen to Transactions to compute metrics
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
        setTransactions(list);
        setLoading(false);
      },
      (err) => {
        console.error("Statement transactions load error:", err);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeCycles();
      unsubscribeTx();
    };
  }, [user]);

  // Group transactions by cycleId in memory
  const txByCycle = React.useMemo(() => {
    const map: Record<string, TransactionData[]> = {};
    transactions.forEach((tx) => {
      if (!map[tx.cycleId]) {
        map[tx.cycleId] = [];
      }
      map[tx.cycleId].push(tx);
    });
    return map;
  }, [transactions]);

  // Compute metrics for each cycle
  const computedCycles = React.useMemo(() => {
    return cycles.map((cycle) => {
      const cycleTx = txByCycle[cycle.id] || [];
      const txCount = cycleTx.length;
      
      let totalSpend = 0;
      let totalDeposits = 0;
      cycleTx.forEach((tx) => {
        totalSpend += tx.amount;
        totalDeposits += tx.deposit;
      });

      const outstanding = Math.max(0, totalSpend - totalDeposits);
      
      return {
        ...cycle,
        txCount,
        outstanding,
      };
    });
  }, [cycles, txByCycle]);

  // Filter cycles by selected year
  const filteredCycles = computedCycles.filter(
    (c) => c.year.toString() === selectedYear
  );

  if (loading) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center min-h-[50vh] text-zinc-400 gap-2">
        <div className="h-8 w-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Loading statement archive...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Year Selector */}
      <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Statement Archive</h2>
          <p className="text-xs text-zinc-500 mt-1">
            Browse outstanding metrics and transaction histories by billing cycle.
          </p>
        </div>

        {/* Year Dropdown */}
        <div className="w-32">
          <Select value={selectedYear} onValueChange={(val) => val && setSelectedYear(val)}>
            <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100 rounded-xl h-10 font-semibold cursor-pointer">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100 rounded-lg">
              {years.map((y) => (
                <SelectItem key={y} value={y.toString()} className="hover:bg-zinc-800 text-xs">
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Statement Cycles List */}
      {filteredCycles.length === 0 ? (
        <div className="bg-[#111113] border border-zinc-800 border-dashed rounded-2xl p-12 text-center text-zinc-500 text-sm">
          No billing statements recorded for year {selectedYear}.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredCycles.map((c) => {
            const isClosed = c.status === "CLOSED";

            return (
              <Link
                key={c.id}
                href={`/statements/${c.id}`}
                className={cn(
                  "bg-[#111113] border border-zinc-800 hover:border-zinc-700/80 p-5 rounded-2xl flex items-center justify-between gap-6 transition-all group relative overflow-hidden",
                  isClosed && "opacity-90 border-dashed"
                )}
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2.5">
                    {/* Calendar icon */}
                    <div className="h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-zinc-100 group-hover:text-blue-400 transition-colors">
                        {c.title}
                      </h3>
                      <p className="text-xs text-zinc-500">
                        {c.startDate.toLocaleDateString("en-US", { year: "numeric" })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status & outstanding */}
                <div className="flex items-center gap-6">
                  {/* Status Indicator */}
                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-400">
                    {isClosed ? (
                      <span className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-1 text-[10px] font-semibold text-zinc-400 border border-zinc-700">
                        <Lock className="h-3 w-3" /> Locked
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded bg-green-500/10 px-2 py-1 text-[10px] font-semibold text-green-400 border border-green-500/20">
                        <Unlock className="h-3 w-3 animate-pulse" /> Open
                      </span>
                    )}
                  </div>

                  {/* Calculations summary */}
                  <div className="text-right">
                    <p className="text-xs text-zinc-500 font-medium mb-0.5">Outstanding</p>
                    <p className="text-base font-bold text-zinc-100">
                      ₹{c.outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      {c.txCount} transaction(s)
                    </p>
                  </div>

                  <ChevronRight className="h-5 w-5 text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
