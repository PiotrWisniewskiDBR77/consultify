/**
 * Dev-render host dla #87a — canvas "+" New Canvas menu, 3 jawne opcje startu
 * (Czysty / Z szablonu / Z canvasa) → docked Teresa.
 *
 * Ten story ODTWARZA 1:1 markup + klasy z realnego dropdownu w
 * `WorkCanvasDocumentPanel.tsx` (blok `data-testid="canvas-new-menu-v2"`,
 * flaga `ff_canvasNewDocOptions`), zamontowany OTWARTY ze statycznym mockiem
 * (bez logowania/store/API — real component ciągnie Api.workCanvasListDrafts +
 * cały canvas draft store i nie zmontuje się tu). Celem story jest ODBIÓR
 * WYGLĄDU powłoki menu (3 sekcje + separator + badge REAL/PARTIAL + stany
 * "Z canvasa": populated/empty/loading) w świetle i ciemnym, PRZED tym jak
 * Piotr zobaczy cokolwiek za flagą (CLAUDE.md #7).
 *
 * URL params: ?screen=canvas-new-doc&theme=light|dark&lang=pl|en
 *             &fromCanvasState=populated|empty|loading (default populated)
 */
import { FileText, Gavel, Lightbulb, Plus, Rocket } from 'lucide-react';
import React from 'react';

type Capability = 'real' | 'partial';

function CapabilityBadge({ status }: { status: Capability }): React.ReactElement {
  const cls =
    status === 'real'
      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      : 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${cls}`}
    >
      {status === 'real' ? 'REAL' : 'PARTIAL'}
    </span>
  );
}

const TEMPLATES: Array<{
  id: string;
  icon: React.ReactNode;
  label: string;
  labelEn: string;
  description: string;
  descriptionEn: string;
  capability: Capability;
}> = [
  {
    id: 'thoughts',
    icon: <Lightbulb size={13} />,
    label: 'Zbierz myśli',
    labelEn: 'Collect thoughts',
    description: 'Notatki robocze — surowe pomysły, uporządkowane potem.',
    descriptionEn: 'Working notes — capture raw ideas, sort them later.',
    capability: 'real',
  },
  {
    id: 'document',
    icon: <FileText size={13} />,
    label: 'Napisz dokument',
    labelEn: 'Write a document',
    description: 'Czysty dokument Markdown do pracy firmowej.',
    descriptionEn: 'Clean Markdown-canonical document for business work.',
    capability: 'real',
  },
  {
    id: 'decision',
    icon: <Gavel size={13} />,
    label: 'Przygotuj decyzję',
    labelEn: 'Prepare a decision',
    description: 'Opcje, kompromisy, ryzyka i rekomendacja.',
    descriptionEn: 'Options, trade-offs, risks, recommended choice.',
    capability: 'partial',
  },
  {
    id: 'plan',
    icon: <Rocket size={13} />,
    label: 'Rozpisz plan',
    labelEn: 'Draft a plan',
    description: 'Zamień rozmowę w strumienie prac i kolejne kroki.',
    descriptionEn: 'Turn the conversation into workstreams and next steps.',
    capability: 'real',
  },
];

const OTHER_CANVASES: Array<{ id: string; title: string; titleEn: string }> = [
  { id: 'c1', title: 'Ekspansja DE — mapa hipotez', titleEn: 'DE expansion — hypothesis map' },
  { id: 'c2', title: 'Brief researchu rynkowego Q3', titleEn: 'Q3 market research brief' },
  { id: 'c3', title: 'Notatka: warsztat z klientem', titleEn: 'Note: client workshop' },
];

function DropdownMenu({
  isPl,
  fromCanvasState,
}: {
  isPl: boolean;
  fromCanvasState: 'populated' | 'empty' | 'loading';
}): React.ReactElement {
  return (
    <div
      data-testid="canvas-new-menu-v2"
      className="absolute right-0 z-20 mt-2 w-[300px] rounded-2xl border border-slate-200 bg-white p-2 text-xs shadow-xl dark:border-white/10 dark:bg-navy-800"
    >
      {/* (a) Czysty */}
      <button
        type="button"
        data-testid="canvas-new-menu-blank"
        className="w-full rounded-xl px-2.5 py-2 text-left text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <span className="font-semibold">{isPl ? 'Czysty dokument' : 'Blank document'}</span>
        <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
          {isPl ? 'Puste — zaczynasz od zera z Teresą.' : 'Empty — start from scratch with Teresa.'}
        </div>
      </button>

      <div className="my-1.5 border-t border-slate-100 dark:border-white/[0.06]" />

      {/* (b) Z szablonu */}
      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        {isPl ? 'Z szablonu' : 'From template'}
      </div>
      <div className="mt-1 space-y-1">
        {TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            className="w-full rounded-xl px-2.5 py-2 text-left text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{isPl ? template.label : template.labelEn}</span>
              <CapabilityBadge status={template.capability} />
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {isPl ? template.description : template.descriptionEn}
            </div>
          </button>
        ))}
      </div>

      <div className="my-1.5 border-t border-slate-100 dark:border-white/[0.06]" />

      {/* (c) Z canvasa */}
      <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        {isPl ? 'Z canvasa' : 'From canvas'}
      </div>
      <div className="mt-1 max-h-[180px] space-y-1 overflow-y-auto">
        {fromCanvasState === 'loading' ? (
          <div className="px-2.5 py-2 text-[11px] text-slate-500 dark:text-slate-400">
            {isPl ? 'Wczytuję Twoje canvasy…' : 'Loading your canvases…'}
          </div>
        ) : fromCanvasState === 'empty' ? (
          <div className="px-2.5 py-2 text-[11px] text-slate-500 dark:text-slate-400">
            {isPl ? 'Brak innych canvasów.' : 'No other canvases yet.'}
          </div>
        ) : (
          OTHER_CANVASES.map((draft) => (
            <button
              key={draft.id}
              type="button"
              data-testid="canvas-new-menu-from-canvas-item"
              className="w-full truncate rounded-xl px-2.5 py-2 text-left text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <span className="truncate font-semibold">{isPl ? draft.title : draft.titleEn}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default function CanvasNewDocScreen(): React.ReactElement {
  const params = new URLSearchParams(window.location.search);
  const isPl =
    (params.get('lang') || 'pl') === 'pl' ||
    (document.documentElement.lang || 'pl').startsWith('pl');
  const fromCanvasState =
    (params.get('fromCanvasState') as 'populated' | 'empty' | 'loading') || 'populated';

  return (
    <div className="flex h-screen w-full flex-col bg-slate-50 dark:bg-navy-950">
      {/* Mock canvas toolbar header (parity with WorkCanvasDocumentPanel header) */}
      <div className="relative z-30 flex h-[42px] shrink-0 items-center justify-between gap-3 border-b border-slate-200/70 bg-white/70 px-4 backdrop-blur dark:border-white/[0.06] dark:bg-navy-950/60">
        <div className="min-w-0 flex-1">
          <span className="truncate text-[15px] font-semibold text-slate-950 dark:text-white">
            {isPl ? 'Notatka: warsztat z klientem' : 'Note: client workshop'}
          </span>
        </div>
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <div className="relative" data-testid="canvas-new-menu-root">
            <button
              type="button"
              aria-label={isPl ? 'Nowy Canvas' : 'New Canvas'}
              title={isPl ? 'Nowy Canvas' : 'New Canvas'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-slate-950 dark:border-white/20 dark:bg-white/10 dark:text-white"
            >
              <Plus size={15} />
            </button>
            <DropdownMenu isPl={isPl} fromCanvasState={fromCanvasState} />
          </div>
        </div>
      </div>

      {/* Mock canvas body (context behind the open menu) */}
      <div className="relative flex-1 overflow-hidden bg-slate-50 dark:bg-navy-950">
        <div className="flex h-full items-start justify-center pt-24">
          <div className="w-[560px] rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-400 shadow-sm dark:border-white/10 dark:bg-navy-900 dark:text-slate-500">
            {isPl
              ? 'Dokument (kontekst pod menu — celem story jest wygląd dropdownu "+").'
              : 'Document (context behind the menu — this story is about the "+" dropdown look).'}
          </div>
        </div>
      </div>
    </div>
  );
}
