"use client";

import { CreditCard } from "lucide-react";
import { useAuth } from "../context/auth-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export function CardSwitcher({ className = "" }: { className?: string }) {
  const { cards, activeCard, selectCard } = useAuth();

  if (!activeCard) return null;

  return (
    <Select value={activeCard.id} onValueChange={(cardId) => { if (cardId) void selectCard(cardId); }}>
      <SelectTrigger aria-label="Active card" className={`h-12 w-full rounded-xl border-zinc-800 bg-zinc-900 px-3 text-sm font-semibold text-zinc-100 hover:bg-zinc-800 ${className}`}>
        <CreditCard className="size-4 shrink-0 text-blue-400" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="start" className="rounded-xl border-zinc-800 bg-zinc-950 p-1 text-zinc-100 shadow-2xl">
        {cards.map((card) => (
          <SelectItem key={card.id} value={card.id} className="min-h-11 rounded-lg px-3 text-sm">
            {card.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
