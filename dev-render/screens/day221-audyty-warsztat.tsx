import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, ChevronRight, Circle, FileText, Link2, MoreHorizontal, ShieldCheck, UserRound } from 'lucide-react';

type Step = { id: number; title: string; state: 'done' | 'active' | 'next'; note: string };
type Phase = { name: string; range: string; steps: Step[] };

const phases: Phase[] = [
  { name: '01 · Przygotowanie', range: '1–4', steps: [
    { id: 1, title: 'Mandat i zakres audytu', state: 'done', note: 'Zakład Produkcyjny Poznań · proces od przyjęcia zamówienia do wysyłki.' },
    { id: 2, title: 'Zespół i role', state: 'done', note: 'Audytor wiodący: Anna Kowalska · ekspert procesu: Michał Nowak.' },
    { id: 3, title: 'Kryteria i źródła', state: 'active', note: '42 kryteria z procedury QMS Elmax, wydanie 4; 38 ma potwierdzone źródło.' },
    { id: 4, title: 'Plan sesji', state: 'next', note: '6 bloków roboczych, łącznie 11 h rozmów i obserwacji.' },
  ]},
  { name: '02 · Badanie', range: '5–10', steps: [
    { id: 5, title: 'Otwarcie audytu', state: 'done', note: 'Spotkanie otwierające zakończone 28.08.2026.' },
    { id: 6, title: 'Wywiady z właścicielami', state: 'active', note: '3 z 5 rozmów zakończone; logistyka i jakość czekają.' },
    { id: 7, title: 'Obserwacja procesu', state: 'next', note: 'Przejście Gemba na zmianie porannej.' },
    { id: 8, title: 'Przegląd dokumentów', state: 'next', note: 'Instrukcje stanowiskowe, rejestr reklamacji, raport braków.' },
    { id: 9, title: 'Próba dowodowa', state: 'next', note: '12 zleceń produkcyjnych z ostatnich 90 dni.' },
    { id: 10, title: 'Ocena kryteriów', state: 'next', note: 'Ocena zgodności dopiero po przypięciu dowodów.' },
  ]},
  { name: '03 · Synteza', range: '11–14', steps: [
    { id: 11, title: 'Ustalenia', state: 'next', note: '2 obserwacje robocze; klasyfikacja wymaga przeglądu.' },
    { id: 12, title: 'Analiza przyczyn', state: 'next', note: '5 × dlaczego dla ustaleń istotnych i krytycznych.' },
    { id: 13, title: 'Działania korygujące', state: 'next', note: 'Właściciel, termin i dowód domknięcia dla każdego CAPA.' },
    { id: 14, title: 'Przegląd jakości', state: 'next', note: 'Niezależna kontrola kompletności dowodów.' },
  ]},
  { name: '04 · Domknięcie', range: '15–18', steps: [
    { id: 15, title: 'Raport roboczy', state: 'next', note: 'Synteza zakresu, ustaleń i rekomendacji.' },
    { id: 16, title: 'Spotkanie zamykające', state: 'next', note: 'Potwierdzenie faktów przed publikacją.' },
    { id: 17, title: 'Publikacja raportu', state: 'next', note: 'PDF i dokument audytu po zatwierdzeniu.' },
    { id: 18, title: 'Monitoring działań', state: 'next', note: 'Readback statusu CAPA i dowodów skuteczności.' },
  ]},
];

export default function Day221AudytyWarsztat(): React.ReactElement {
  const [selected, setSelected] = useState<Step>(phases[0].steps[2]);
  const completed = phases.flatMap((p) => p.steps).filter((s) => s.state === 'done').length;
  return <main className="flex h-screen w-screen flex-col overflow-hidden bg-c-bg text-c-text">
    <header className="flex h-16 items-center justify-between border-b border-c-border-subtle px-6">
      <div className="flex min-w-0 items-center gap-3"><button className="rounded-full border border-c-border p-2 focus-visible:ring-2 focus-visible:ring-c-focus" aria-label="Powrót"><ArrowLeft size={16}/></button><div><div className="text-[11px] uppercase tracking-[.16em] text-c-text-muted">Audyty › Program audytowy</div><h1 className="truncate text-lg font-semibold">Audyt procesu realizacji zamówień · Q3 2026</h1></div><span className="rounded-full border border-c-border bg-c-surface-raised px-2.5 py-1 text-xs">W toku</span></div>
      <div className="flex items-center gap-3"><span className="text-xs text-c-text-muted">Zapisano 09:42</span><button className="h-9 rounded-full bg-c-text px-4 text-sm font-semibold text-c-bg">Przejdź do sesji <ChevronRight className="inline" size={16}/></button></div>
    </header>
    <section className="flex h-12 items-center justify-between border-b border-c-border-subtle px-6 text-sm"><div className="flex items-center gap-5"><span><b>4</b> / 18 zakończone</span><span className="text-c-text-muted">42 kryteria</span><span className="text-c-text-muted">38 dowodów</span><span className="text-amber-600 dark:text-amber-300">2 ustalenia robocze</span></div><div className="h-1.5 w-56 overflow-hidden rounded-full bg-c-surface-raised"><div className="h-full w-[22%] rounded-full bg-blue-600"/></div></section>
    <div className="flex min-h-0 flex-1">
      <section className="min-w-0 flex-1 overflow-auto p-6">
        <div className="mb-5"><h2 className="text-xl font-semibold">Mapa warsztatu</h2><p className="mt-1 text-sm text-c-text-muted">Jedna powierzchnia prowadzi zespół od zakresu do monitoringu działań. Wybierz ogniwo, aby zobaczyć kontekst.</p></div>
        <div className="grid grid-cols-4 gap-3">
          {phases.map((phase) => <section key={phase.name} className="rounded-2xl border border-c-border bg-c-surface p-3 shadow-sm"><div className="mb-3 flex items-center justify-between"><div><div className="text-xs font-semibold uppercase tracking-wide">{phase.name}</div><div className="text-[11px] text-c-text-muted">Ogniwa {phase.range}</div></div><span className="rounded-full bg-c-surface-raised px-2 py-1 text-[11px]">{phase.steps.filter(s=>s.state==='done').length}/{phase.steps.length}</span></div><div className="space-y-2">{phase.steps.map((step) => <button key={step.id} onClick={()=>setSelected(step)} className={`flex w-full items-start gap-2 rounded-xl border p-3 text-left transition focus-visible:ring-2 focus-visible:ring-c-focus ${selected.id===step.id?'border-blue-500 bg-blue-500/10':'border-c-border-subtle bg-c-bg hover:border-c-border-strong'}`}>{step.state==='done'?<CheckCircle2 className="mt-0.5 text-emerald-500" size={16}/>:step.state==='active'?<Circle className="mt-0.5 fill-blue-500 text-blue-500" size={16}/>:<Circle className="mt-0.5 text-c-text-muted" size={16}/>}<span><span className="block text-[10px] text-c-text-muted">{String(step.id).padStart(2,'0')}</span><span className="block text-sm font-medium leading-5">{step.title}</span></span></button>)}</div></section>)}
        </div>
      </section>
      <aside className="w-[360px] shrink-0 overflow-auto border-l border-c-border-subtle bg-c-surface p-5">
        <div className="mb-5 flex items-start justify-between"><div><div className="text-[11px] uppercase tracking-[.16em] text-c-text-muted">Ogniwo {String(selected.id).padStart(2,'0')}</div><h2 className="mt-1 text-lg font-semibold">{selected.title}</h2></div><button className="rounded-full p-2 hover:bg-c-surface-raised" aria-label="Więcej"><MoreHorizontal size={18}/></button></div>
        <div className="space-y-3"><div className="rounded-xl border border-c-border p-4"><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-c-text-muted"><ShieldCheck size={15}/> Stan</div><span className="rounded-full border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 text-xs">Do uzupełnienia</span></div><div className="rounded-xl border border-c-border p-4"><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-c-text-muted"><FileText size={15}/> Kontekst</div><p className="text-sm leading-6">{selected.note}</p></div><div className="rounded-xl border border-c-border p-4"><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-c-text-muted"><UserRound size={15}/> Odpowiedzialność</div><div className="flex items-center justify-between text-sm"><span>Anna Kowalska</span><span className="text-c-text-muted">Audytor wiodący</span></div></div><div className="rounded-xl border border-c-border p-4"><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-c-text-muted"><Link2 size={15}/> Powiązania</div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-c-surface-raised px-2.5 py-1 text-xs">Procedura QMS</span><span className="rounded-full bg-c-surface-raised px-2.5 py-1 text-xs">38 dowodów</span><span className="rounded-full bg-c-surface-raised px-2.5 py-1 text-xs">2 ustalenia</span></div></div></div>
      </aside>
    </div>
  </main>;
}
