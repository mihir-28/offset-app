"use client";

import { CreditCard } from "lucide-react";
import { useAuth } from "../context/auth-context";
import { Select, SelectContent, SelectItem, SelectTrigger } from "./ui/select";

export function CardSwitcher({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const { cards, activeCard, selectCard } = useAuth();

  if (!activeCard) return null;

  return (
    <Select value={activeCard.id} onValueChange={(cardId) => { if (cardId) void selectCard(cardId); }}>
      <SelectTrigger aria-label={`Switch card. Current card: ${activeCard.name}`} className={`h-12 w-full rounded-xl border-zinc-800 bg-zinc-900 px-3 text-sm font-semibold text-zinc-100 hover:bg-zinc-800 ${compact ? "w-11 justify-center gap-0 border-transparent bg-transparent px-0 hover:bg-zinc-900 data-[size=default]:h-11 dark:!bg-transparent dark:hover:!bg-zinc-900 [&>svg:last-child]:hidden" : ""} ${className}`}>
        <CreditCard className="size-4 shrink-0 text-blue-400" />
        {!compact && <span className="min-w-0 flex-1 whitespace-normal text-left leading-tight">{activeCard.name}</span>}
      </SelectTrigger>
      <SelectContent align="end" className="w-auto min-w-64 rounded-xl border-zinc-800 bg-zinc-950 p-1 text-zinc-100 shadow-2xl">
        {cards.map((card) => (
          <SelectItem key={card.id} value={card.id} className="min-h-11 rounded-lg px-3 text-sm">
            {card.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
