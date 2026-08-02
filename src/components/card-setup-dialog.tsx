"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { useAuth } from "../context/auth-context";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function CardSetupDialog() {
  const { completeCardSetup, profile } = useAuth();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await completeCardSetup(name);
    } catch (error) {
      console.error("Card setup failed:", error);
      alert("Could not set up your card. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
    <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-[#111113] p-6 shadow-2xl space-y-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400"><CreditCard className="h-5 w-5" /></div>
      <div><h2 className="text-xl font-bold text-white">Name your first card</h2><p className="mt-1 text-xs leading-relaxed text-zinc-400">{profile ? "We’ll attach transactions you’ve already tracked to this card." : "Add a card before recording transactions."}</p></div>
      <div className="space-y-1.5"><label className="text-xs font-semibold text-zinc-300">Card name</label><Input autoFocus required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. HDFC Regalia" className="h-11 rounded-xl border-zinc-800 bg-zinc-900 text-zinc-100" /></div>
      <Button type="submit" disabled={saving || !name.trim()} className="h-11 w-full rounded-xl bg-blue-500 font-semibold text-black hover:bg-blue-600">{saving ? "Setting up..." : "Continue"}</Button>
    </form>
  </div>;
}
