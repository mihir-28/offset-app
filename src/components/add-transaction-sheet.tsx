"use client";

import React, { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Calendar as CalendarIcon } from "lucide-react";
import { useAuth } from "../context/auth-context";
import { addTransaction, updateTransaction, TransactionData } from "../lib/db-helpers";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "./ui/sheet";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { cn } from "../lib/utils";

const transactionSchema = z.object({
  transactionName: z.string().min(1, "Name is required"),
  transactionDate: z.date(),
  amount: z.number({ message: "Amount is required" }).min(0.01, "Amount must be greater than 0"),
  deposit: z.number({ message: "Deposit must be a number" }).or(z.nan()).transform((val) => isNaN(val) ? 0 : val),
  owner: z.enum(["HOME", "MINE"]),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

interface AddTransactionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  editData?: TransactionData | null;
}

export function AddTransactionSheet({
  open,
  onOpenChange,
  onSuccess,
  editData = null,
}: AddTransactionSheetProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Responsive Drawer Position
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      transactionName: "",
      transactionDate: new Date(),
      amount: 0,
      deposit: 0,
      owner: "MINE",
    },
  });

  const { register, handleSubmit, setValue, reset, control, formState: { errors } } = form;

  // Watch fields for Outstanding Preview
  const amount = useWatch({ control, name: "amount" }) || 0;
  const deposit = useWatch({ control, name: "deposit" }) || 0;
  const transactionDate = useWatch({ control, name: "transactionDate" });
  const owner = useWatch({ control, name: "owner" });

  const outstanding = Math.max(0, amount - deposit);

  // Sync editData values when sheet opens
  useEffect(() => {
    if (open) {
      if (editData) {
        reset({
          transactionName: editData.transactionName,
          transactionDate: editData.transactionDate instanceof Date 
            ? editData.transactionDate 
            : (typeof editData.transactionDate === "object" && editData.transactionDate && "seconds" in editData.transactionDate)
              ? new Date((editData.transactionDate as { seconds: number }).seconds * 1000)
              : new Date(),
          amount: editData.amount,
          deposit: editData.deposit,
          owner: editData.owner,
        });
      } else {
        reset({
          transactionName: "",
          transactionDate: new Date(),
          amount: 0,
          deposit: 0,
          owner: "MINE",
        });
      }
    }
  }, [open, editData, reset]);

  const onSubmit = async (values: TransactionFormValues) => {
    if (!user) return;
    setLoading(true);

    try {
      if (editData && editData.id) {
        await updateTransaction(user.uid, editData.id, values);
      } else {
        await addTransaction(user.uid, values);
      }
      onOpenChange(false);
      reset();
      if (onSuccess) onSuccess();
    } catch (error) {
      const err = error as { message?: string };
      alert(err?.message || "Failed to save transaction.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className="w-full sm:max-w-md bg-[#111113] border-zinc-800 text-zinc-100 flex flex-col h-[90vh] md:h-full rounded-t-2xl md:rounded-t-none"
      >
        <SheetHeader className="pb-4 border-b border-zinc-800">
          <SheetTitle className="text-xl font-bold text-white">
            {editData ? "Edit Transaction" : "Add Transaction"}
          </SheetTitle>
          <SheetDescription className="text-zinc-400">
            {editData 
              ? "Update details of this transaction." 
              : "Enter transaction details. Cycle will be assigned automatically."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col gap-5 py-4 overflow-y-auto pr-1">
          {/* Transaction Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Transaction Name
            </label>
            <Input
              placeholder="e.g., Grocery Store"
              {...register("transactionName")}
              className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 rounded-lg h-10"
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
                      "w-full h-10 bg-zinc-900 border-zinc-800 justify-start text-left font-normal rounded-lg cursor-pointer text-zinc-100 hover:bg-zinc-800 hover:text-white",
                      !transactionDate && "text-zinc-500"
                    )}
                  />
                }
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-zinc-500" />
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
              <PopoverContent className="w-auto p-0 bg-zinc-900 border-zinc-800 z-50" align="start">
                <Calendar
                  mode="single"
                  selected={transactionDate}
                  onSelect={(date) => {
                    if (date) {
                      setValue("transactionDate", date);
                      setCalendarOpen(false);
                    }
                  }}
                  className="bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-lg"
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
                className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 rounded-lg h-10"
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
                className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 rounded-lg h-10"
              />
              {errors.deposit && (
                <p className="text-xs text-red-400">{errors.deposit.message}</p>
              )}
            </div>
          </div>

          {/* Owner Toggle */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Owner
            </label>
            <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
              <button
                type="button"
                onClick={() => setValue("owner", "HOME")}
                className={cn(
                  "flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer",
                  owner === "HOME"
                    ? "bg-blue-500 text-black shadow-md"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                HOME
              </button>
              <button
                type="button"
                onClick={() => setValue("owner", "MINE")}
                className={cn(
                  "flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer",
                  owner === "MINE"
                    ? "bg-blue-500 text-black shadow-md"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                MINE
              </button>
            </div>
          </div>

          {/* Live Preview Outstanding Card */}
          <div className="mt-4 p-4 rounded-xl border border-zinc-800 bg-[#161619] flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Outstanding Preview
              </p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Amount (₹{amount}) - Deposit (₹{deposit})
              </p>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-blue-400">
                ₹{outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex gap-3 mt-auto pt-6 border-t border-zinc-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 bg-transparent hover:bg-zinc-800 border-zinc-800 text-zinc-300 rounded-xl h-11"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-black font-semibold rounded-xl h-11"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                editData ? "Save Changes" : "Save Transaction"
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
