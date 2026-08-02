"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, CreditCard, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../../context/auth-context";
import { archiveCard, createCard } from "../../../lib/db-helpers";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";

export default function CardsSettingsPage() {
  const { user, cards, activeCard, selectCard, refreshCards } = useAuth();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const addCard = async (event: FormEvent) => { event.preventDefault(); if (!user || !name.trim()) return; setSaving(true); try { const card = await createCard(user.uid, name); await refreshCards(); await selectCard(card.id); setName(""); } catch { alert("Could not add card."); } finally { setSaving(false); } };
  const archive = async (id: string) => { if (cards.length < 2) return alert("Keep at least one active card."); if (!confirm("Archive this card? Its history will remain safe.")) return; await archiveCard(id); await refreshCards(); if (activeCard?.id === id) await selectCard(cards.find((card) => card.id !== id)!.id); };
  return <div className="mx-auto w-full max-w-md space-y-5"><Link href="/settings" className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Settings</Link><div><h2 className="text-2xl font-bold text-white">Cards</h2><p className="mt-1 text-xs text-zinc-500">Switch, add, and archive cards.</p></div><div className="overflow-hidden rounded-2xl border border-zinc-800 bg-[#111113]">{cards.map((card) => <div key={card.id} className="flex items-center gap-3 border-b border-zinc-800/70 px-4 py-3 last:border-b-0"><CreditCard className="h-4 w-4 text-blue-400" /><button onClick={() => void selectCard(card.id)} className="min-w-0 flex-1 text-left"><p className="truncate text-sm font-semibold text-zinc-100">{card.name}</p><p className="text-[10px] text-zinc-500">Cycle starts {card.cycleStartDay}</p></button>{activeCard?.id === card.id ? <span className="text-[10px] font-bold text-blue-400">ACTIVE</span> : <Button variant="ghost" size="icon-sm" onClick={() => void archive(card.id)} className="text-zinc-400 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></Button>}</div>)}</div><form onSubmit={addCard} className="flex gap-2"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="New card name" className="h-10 rounded-xl border-zinc-800 bg-zinc-900 text-zinc-100" /><Button disabled={saving || !name.trim()} className="h-10 rounded-xl bg-blue-500 text-black hover:bg-blue-600"><Plus className="mr-1 h-4 w-4" /> Add</Button></form></div>;
}
