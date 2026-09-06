import { Check, Sparkles, X } from 'lucide-react';
import React, { useState } from 'react';

export type PlanGenerationMode = 'DEPENDENCIES' | 'CAPACITY' | 'MIXED';

export function GeneratorPlanuModal({ open, initiatives, busy, hasProposal, onClose, onGenerate, onReview }: {
  open: boolean;
  initiatives: Array<{ id: string; name: string }>;
  busy?: boolean;
  hasProposal?: boolean;
  onClose: () => void;
  onGenerate: (input: { initiativeIds: string[]; start: string; periods: number; unit: 'WEEK' | 'MONTH'; mode: PlanGenerationMode }) => void;
  onReview: (outcome: 'ACCEPT' | 'REJECT') => void;
}) {
  const [selected, setSelected] = useState(() => new Set(initiatives.map((item) => item.id)));
  const [start, setStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [periods, setPeriods] = useState(12);
  const [unit, setUnit] = useState<'WEEK' | 'MONTH'>('WEEK');
  const [mode, setMode] = useState<PlanGenerationMode>('MIXED');
  if (!open) return null;
  const stepClass = 'rounded-xl border border-c-border-subtle bg-c-surface p-4';
  return <div role="dialog" aria-modal="true" aria-label="Generator planu" className="fixed inset-0 z-modal flex items-center justify-center bg-c-overlay/60 p-6">
    <div className="max-h-[92vh] w-full max-w-4xl overflow-auto rounded-2xl border border-c-border bg-c-background p-5 text-c-text shadow-2xl">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Generator planu</h2><button className="rounded-lg p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus" onClick={onClose} aria-label="Zamknij"><X size={18}/></button></div>
      <div className="grid gap-3">
        <section className={stepClass}><h3 className="font-semibold">1. Źródło</h3><p className="text-sm text-c-text-muted">Bieżący portfel i jego opublikowana wersja.</p></section>
        <section className={stepClass}><h3 className="font-semibold">2. Wybór inicjatyw</h3><div className="mt-2 grid gap-2 sm:grid-cols-2">{initiatives.map((item) => <label key={item.id} className="flex gap-2 text-sm"><input type="checkbox" checked={selected.has(item.id)} onChange={(event) => setSelected((current) => { const next = new Set(current); event.target.checked ? next.add(item.id) : next.delete(item.id); return next; })}/>{item.name}</label>)}</div></section>
        <section className={stepClass}><h3 className="font-semibold">3. Parametry</h3><div className="mt-2 flex flex-wrap gap-3"><input aria-label="Początek horyzontu" type="date" value={start} onChange={(event) => setStart(event.target.value)}/><input aria-label="Liczba okresów" type="number" min={1} max={104} value={periods} onChange={(event) => setPeriods(Number(event.target.value))}/><select aria-label="Jednostka" value={unit} onChange={(event) => setUnit(event.target.value as 'WEEK'|'MONTH')}><option value="WEEK">Tydzień</option><option value="MONTH">Miesiąc</option></select><select aria-label="Tryb analizy" value={mode} onChange={(event) => setMode(event.target.value as PlanGenerationMode)}><option value="DEPENDENCIES">Według zależności</option><option value="CAPACITY">Według obciążenia ról</option><option value="MIXED">Mieszany</option></select></div></section>
        <section className={stepClass}><h3 className="font-semibold">4. Generuj</h3><button disabled={busy || !selected.size} className="mt-2 inline-flex items-center gap-2 rounded-lg border border-c-border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-50" onClick={() => onGenerate({ initiativeIds: [...selected], start, periods, unit, mode })}><Sparkles size={16}/>Generuj propozycję</button></section>
        <section className={stepClass}><h3 className="font-semibold">5. Zatwierdź</h3><p className="text-sm text-c-text-muted">Propozycja nie zmienia planu bez decyzji człowieka.</p>{hasProposal && <div className="mt-2 flex gap-2"><button className="inline-flex items-center gap-2 rounded-lg border border-c-border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus" onClick={() => onReview('ACCEPT')}><Check size={16}/>Zatwierdź</button><button className="rounded-lg border border-c-border px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus" onClick={() => onReview('REJECT')}>Odrzuć</button></div>}</section>
      </div>
    </div>
  </div>;
}
