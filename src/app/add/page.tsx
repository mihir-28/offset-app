"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { doc, getDoc, Timestamp } from "firebase/firestore";
import { Calendar as CalendarIcon, ChevronLeft, Trash2 } from "lucide-react";
import { useAuth } from "../../context/auth-context";
import { db } from "../../lib/firebase";
import { addTransaction, updateTransaction, deleteTransaction, TransactionData } from "../../lib/db-helpers";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Calendar } from "../../components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";
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

const transactionSchema = z.object({
  transactionName: z.string().min(1, "Transaction name is required"),
  transactionDate: z.date(),
  amount: z.number({ message: "Amount is required" }).min(0.01, "Amount must be greater than 0"),
  deposit: z.number({ message: "Deposit must be a number" }).or(z.nan()).transform((val) => isNaN(val) ? 0 : val),
  owner: z.string().min(1, "Owner is required"),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

export default function AddTransactionPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  const [editData, setEditData] = useState<TransactionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingTx, setLoadingTx] = useState(!!editId);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const buckets = useMemo(() => profile?.buckets || ["HOME", "MINE"], [profile?.buckets]);
  const cycleStartDay = profile?.cycleStartDay || 17;

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      transactionName: "",
      transactionDate: new Date(),
      amount: 0,
      deposit: 0,
      owner: "",
    },
  });

  const { register, handleSubmit, setValue, reset, control, formState: { errors } } = form;

  // Watch fields for Outstanding Preview
  const amount = useWatch({ control, name: "amount" }) || 0;
  const deposit = useWatch({ control, name: "deposit" }) || 0;
  const transactionDate = useWatch({ control, name: "transactionDate" });
  const owner = useWatch({ control, name: "owner" });

  const outstanding = Math.max(0, amount - deposit);

  const selectOptions = [...buckets];
  if (owner && !selectOptions.includes(owner)) {
    selectOptions.push(owner);
  }

  // Set default owner value when buckets load and not editing
  useEffect(() => {
    if (!editId && buckets.length > 0 && !owner) {
      setValue("owner", buckets[0]);
    }
  }, [buckets, editId, setValue, owner]);

  // Fetch edit data if editId is provided
  useEffect(() => {
    if (!editId || !user) return;

    const fetchTx = async () => {
      try {
        const txRef = doc(db, "transactions", editId);
        const snap = await getDoc(txRef);
        if (snap.exists()) {
          const data = snap.data() as TransactionData;
          if (data.deleted) {
            console.error("Transaction is deleted");
            router.replace("/add");
            return;
          }
          const txDate = data.transactionDate instanceof Timestamp 
            ? data.transactionDate.toDate() 
            : (data.transactionDate && typeof data.transactionDate === "object" && "seconds" in data.transactionDate)
              ? new Date((data.transactionDate as { seconds: number }).seconds * 1000)
              : new Date();

          const formattedTx = {
            ...data,
            transactionDate: txDate,
          };
          setEditData(formattedTx);

          reset({
            transactionName: formattedTx.transactionName,
            transactionDate: formattedTx.transactionDate,
            amount: formattedTx.amount,
            deposit: formattedTx.deposit,
            owner: formattedTx.owner,
          });
        } else {
          console.error("Transaction not found");
          router.replace("/add");
        }
      } catch (err) {
        console.error("Failed to load transaction:", err);
      } finally {
        setLoadingTx(false);
      }
    };

    fetchTx();
  }, [editId, user, reset, router]);

  const onSubmit = async (values: TransactionFormValues) => {
    if (!user) return;
    setLoading(true);

    try {
      if (editId && editData) {
        await updateTransaction(user.uid, editId, values, cycleStartDay);
      } else {
        await addTransaction(user.uid, values, cycleStartDay);
      }
      router.push("/");
    } catch (error) {
      const err = error as { message?: string };
      alert(err?.message || "Failed to save transaction.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!editId || !confirm("Are you sure you want to delete this transaction?")) return;
    setDeleteLoading(true);

    try {
      await deleteTransaction(editId);
      router.push("/");
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Delete failed: " + (error as { message?: string }).message);
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loadingTx) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-xs tracking-wider uppercase">Loading Transaction...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 pb-6 relative z-10">
      
      {/* Header with back navigation */}
      <div className="flex items-center space-x-3">
        <button
          onClick={() => router.back()}
          className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/40 text-zinc-400 hover:text-white cursor-pointer transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-extrabold tracking-tight text-white font-sans">
          {editId ? "Edit Transaction" : "New Transaction"}
        </h1>
      </div>

      {/* Form Card */}
      <form onSubmit={handleSubmit(onSubmit)} className="p-6 rounded-2xl glass-panel border border-zinc-800 space-y-5 bg-[#111113]/40">
        
        {/* Transaction Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Transaction Name
          </label>
          <Input
            placeholder="e.g., Grocery Store"
            {...register("transactionName")}
            className="bg-zinc-900/50 border-zinc-850 focus:border-blue-500/30 text-zinc-100 placeholder:text-zinc-600 rounded-xl h-11"
          />
          {errors.transactionName && (
            <p className="text-xs text-red-400">{errors.transactionName.message}</p>
          )}
        </div>

        {/* Transaction Date */}
        <div className="space-y-1.5 flex flex-col">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Transaction Date
          </label>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full h-11 bg-zinc-900/50 border-zinc-850 justify-start text-left font-normal rounded-xl cursor-pointer text-zinc-100 hover:bg-zinc-800 hover:text-white transition-colors",
                    !transactionDate && "text-zinc-500"
                  )}
                />
              }
            >
              <CalendarIcon className="mr-2.5 h-4.5 w-4.5 text-zinc-500" />
              {transactionDate ? (
                transactionDate.toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              ) : (
                <span>Pick a date</span>
              )}
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-zinc-950 border-zinc-850 z-50 rounded-xl shadow-2xl" align="start">
              <Calendar
                mode="single"
                selected={transactionDate}
                onSelect={(date) => {
                  if (date) {
                    setValue("transactionDate", date);
                    setCalendarOpen(false);
                  }
                }}
                className="bg-zinc-950 border border-zinc-850 text-zinc-100 rounded-xl"
              />
            </PopoverContent>
          </Popover>
          {errors.transactionDate && (
            <p className="text-xs text-red-400">{errors.transactionDate.message}</p>
          )}
        </div>

        {/* Amount & Deposit */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Amount (₹)
            </label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register("amount", { valueAsNumber: true })}
              className="bg-zinc-900/50 border-zinc-850 focus:border-blue-500/30 text-zinc-100 placeholder:text-zinc-600 rounded-xl h-11"
            />
            {errors.amount && (
              <p className="text-xs text-red-400">{errors.amount.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Deposit (₹)
            </label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register("deposit", { valueAsNumber: true })}
              className="bg-zinc-900/50 border-zinc-850 focus:border-blue-500/30 text-zinc-100 placeholder:text-zinc-600 rounded-xl h-11"
            />
            {errors.deposit && (
              <p className="text-xs text-red-400">{errors.deposit.message}</p>
            )}
          </div>
        </div>

        {/* Owner Toggle */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Allocate to Bucket
          </label>
          <div className="flex flex-wrap gap-2 bg-zinc-900 p-1.5 rounded-xl border border-zinc-850">
            {selectOptions.map((opt) => {
              const isSelected = owner === opt;
              const colors = getBucketColor(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setValue("owner", opt)}
                  className={cn(
                    "flex-1 min-w-[100px] py-2.5 px-4 text-xs font-bold rounded-lg transition-all cursor-pointer text-center truncate",
                    isSelected
                      ? `${colors.solid} text-black font-extrabold shadow-md`
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850/40"
                  )}
                  title={opt}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {/* Outstanding Preview Card */}
        <div className="mt-4 p-4 rounded-xl border border-zinc-850 bg-[#161619]/60 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Outstanding Preview
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              Amount (₹{amount}) - Deposit (₹{deposit})
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-extrabold text-blue-400">
              ₹{outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-zinc-800">
          
          {/* Delete Button (only if editing) */}
          {editId && (
            <Button
              type="button"
              disabled={deleteLoading}
              onClick={handleDelete}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl h-11 px-5 font-semibold text-xs transition-colors shrink-0 cursor-pointer w-full sm:w-auto"
            >
              {deleteLoading ? (
                <div className="h-4 w-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-1.5" /> Delete
                </>
              )}
            </Button>
          )}

          <div className="flex gap-3 w-full justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="flex-1 sm:flex-none bg-transparent hover:bg-zinc-800 border-zinc-850 text-zinc-300 rounded-xl h-11 px-6 font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 sm:flex-none bg-blue-500 hover:bg-blue-600 text-black font-semibold rounded-xl h-11 px-8"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                editId ? "Save Changes" : "Save Transaction"
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
