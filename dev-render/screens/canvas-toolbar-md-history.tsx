/**
 * Dev-render host dla #87c/#87d (rewizja 07-13) — luka po skasowaniu V2
 * toolbara (light-shell sweep e5ade82b66): "import/export MD + usuń Historię"
 * i "kebab przeładowany", zweryfikowane i naprawione w kanonicznym
 * `WorkCanvasDocumentPanel.tsx`.
 *
 * Ten story ODTWARZA 1:1 markup + klasy z realnego pliku (bez logowania/
 * store/API — real component ciągnie cały canvas draft store i nie zmontuje
 * się tu), zamontowany w DWÓCH stanach obok siebie, żeby było widać DIFF:
 *
 *   (A) Główny pasek — PO: bez ikony "Historia" (usunięta z widoku głównego,
 *       jak chciało zgłoszenie #87c), tylko New/output/promote/file-actions/⋯.
 *   (B) Kebab "⋯" otwarty, przewinięty do sekcji "Manual editing" (z nową
 *       pozycją "Historia wersji") i "Markdown actions" (z nowym "Import
 *       Markdown (.md)" nad "Download Markdown") — oba oznaczone badge'em
 *       NOWE. Reszta mega-kebaba (Widok canvas, Most common actions, Add
 *       element, AI on selection, Starter templates, Workspace actions,
 *       Capabilities/workflow…) jest ŚWIADOMIE pominięta w tym story — to
 *       osobny, nienaprawiony problem (patrz notatka #87d na dole ekranu),
 *       nie część tej naprawy.
 *
 * URL params: ?screen=canvas-toolbar-md-history&theme=light|dark&lang=pl|en
 */
import {
  ChevronLeft,
  Copy,
  Download,
  FileText,
  History,
  MoreHorizontal,
  Plus,
  Save,
  Share2,
  Table2,
  Upload,
  X,
} from 'lucide-react';
import React from 'react';

function NewBadge({ isPl }: { isPl: boolean }): React.ReactElement {
  return (
    <span className="ml-1.5 inline-flex items-center rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-emerald-700 dark:text-emerald-300">
      {isPl ? 'NOWE' : 'NEW'}
    </span>
  );
}

function ToolbarGroup({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex items-center gap-1 rounded-full border border-slate-200 px-1.5 py-1 dark:border-white/10">
      {children}
    </div>
  );
}

function IconBtn({
  icon,
  disabled,
}: {
  icon: React.ReactNode;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <button
      type="button"
      disabled={disabled}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
        disabled
          ? 'cursor-not-allowed text-slate-300 dark:text-slate-600'
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white'
      }`}
    >
      {icon}
    </button>
  );
}

function MainBarAfter({ isPl }: { isPl: boolean }): React.ReactElement {
  return (
    <div>
      <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
        (A) {isPl ? 'Główny pasek — PO' : 'Main bar — AFTER'}
      </div>
      <div className="flex h-[42px] shrink-0 items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white/70 px-4 dark:border-white/[0.06] dark:bg-navy-950/60">
        <div className="min-w-0 flex-1 text-[15px] font-semibold text-slate-950 dark:text-white">
          {isPl ? 'Brief researchu rynkowego Q3' : 'Q3 market research brief'}
        </div>
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <button
            type="button"
            aria-label={isPl ? 'Nowy Canvas' : 'New Canvas'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 dark:border-white/10 dark:text-slate-300"
          >
            <Plus size={15} />
          </button>
          <ToolbarGroup>
            <IconBtn icon={<FileText size={13} />} />
            <IconBtn icon={<Table2 size={13} />} />
          </ToolbarGroup>
          <div
            className="flex items-center gap-2 rounded-full border border-slate-200 px-2 py-0.5 dark:border-white/10"
            title="Promote"
          >
            <span className="select-none px-1 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              Promote
            </span>
            <div className="flex items-center gap-1">
              <IconBtn icon={<ChevronLeft size={13} className="rotate-180" />} />
              <IconBtn icon={<Save size={13} />} />
            </div>
          </div>
          <ToolbarGroup>
            <IconBtn icon={<Copy size={13} />} />
            <IconBtn icon={<Share2 size={13} />} />
            <IconBtn icon={<Save size={13} />} />
            <IconBtn icon={<X size={13} />} />
          </ToolbarGroup>
          {/* #87c — "Historia" ikona USUNIĘTA stąd; funkcja żyje w kebabie (B). */}
          <button
            type="button"
            aria-label={isPl ? 'Menu Canvas' : 'Canvas menu'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-950 dark:bg-white/10 dark:text-white"
          >
            <MoreHorizontal size={15} />
          </button>
        </div>
      </div>
      <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">
        {isPl
          ? '✓ Brak stałej ikony "Historia" — pasek odchudzony zgodnie ze zgłoszeniem #87c.'
          : '✓ No standing "History" icon — bar decluttered per report #87c.'}
      </div>
    </div>
  );
}

function KebabOpen({ isPl }: { isPl: boolean }): React.ReactElement {
  return (
    <div>
      <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
        (B) {isPl
          ? 'Kebab „⋯" — sekcje Manual editing + Markdown actions (skrót)'
          : 'Kebab "⋯" — Manual editing + Markdown actions sections (excerpt)'}
      </div>
      <div className="w-[360px] rounded-2xl border border-slate-200 bg-white p-3 text-xs shadow-xl dark:border-white/10 dark:bg-navy-800">
        <div className="px-1 pb-2 text-[10px] text-slate-400 dark:text-slate-500">
          {isPl ? '⋯ (pozostałe sekcje kebaba pominięte w tym story)' : '⋯ (rest of the kebab omitted in this story)'}
        </div>

        {/* Manual editing */}
        <div className="space-y-1.5 border-b border-slate-200 pb-3 dark:border-white/10">
          <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            {isPl ? 'Ręczna edycja' : 'Manual editing'}
          </div>
          <div className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-slate-700 dark:text-slate-200">
            <span>{isPl ? 'Edytuj Markdown ręcznie' : 'Edit Markdown manually'}</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">MD</span>
          </div>
          <div className="flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-slate-700 dark:text-slate-200">
            <span>{isPl ? 'Wróć do widoku dokumentu' : 'Back to document view'}</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Dock</span>
          </div>
          {/* #87c — nowa pozycja: trigger Historii przeniesiony tutaj. */}
          <div
            className="flex w-full items-center gap-2 rounded-xl bg-emerald-50/70 px-2.5 py-2 text-left text-slate-700 ring-1 ring-emerald-300/60 dark:bg-emerald-500/10 dark:text-slate-100 dark:ring-emerald-400/30"
            data-testid="canvas-history-menu-item-preview"
          >
            <History size={14} />
            <span className="flex-1">{isPl ? 'Historia wersji' : 'Version history'}</span>
            <NewBadge isPl={isPl} />
          </div>
        </div>

        {/* Markdown actions */}
        <div className="mt-3 space-y-1.5">
          <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            {isPl ? 'Akcje Markdown' : 'Markdown actions'}
          </div>
          {/* #87c — nowa pozycja: Import Markdown, nad Download Markdown. */}
          <div
            className="flex w-full items-center gap-2 rounded-xl bg-emerald-50/70 px-2.5 py-2 text-left text-slate-700 ring-1 ring-emerald-300/60 dark:bg-emerald-500/10 dark:text-slate-100 dark:ring-emerald-400/30"
            data-testid="canvas-import-markdown-preview"
          >
            <Upload size={14} />
            <span className="flex-1">{isPl ? 'Wgraj Markdown (.md)' : 'Import Markdown (.md)'}</span>
            <NewBadge isPl={isPl} />
          </div>
          <div className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-slate-700 dark:text-slate-200">
            <Save size={14} />
            <span>{isPl ? 'Zapisz Markdown' : 'Save Markdown'}</span>
          </div>
          <div className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-slate-700 dark:text-slate-200">
            <Download size={14} />
            <span>{isPl ? 'Pobierz Markdown' : 'Download Markdown'}</span>
          </div>
          <div className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-slate-700 dark:text-slate-200">
            <Table2 size={14} />
            <span>{isPl ? 'Pobierz CSV' : 'Download CSV'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CanvasToolbarMdHistoryScreen(): React.ReactElement {
  const params = new URLSearchParams(window.location.search);
  const isPl =
    (params.get('lang') || 'pl') === 'pl' ||
    (document.documentElement.lang || 'pl').startsWith('pl');

  return (
    <div className="min-h-screen w-full bg-slate-50 p-8 dark:bg-navy-950">
      <div className="mx-auto max-w-[820px] space-y-8">
        <MainBarAfter isPl={isPl} />
        <KebabOpen isPl={isPl} />

        <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4 text-[11px] leading-5 text-amber-900 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-200">
          <div className="mb-1 font-semibold uppercase tracking-[0.12em]">
            #87d — {isPl ? 'wciąż otwarte' : 'still open'}
          </div>
          {isPl ? (
            <>
              Kebab „⋯" ma płaskie ikony na głównym pasku (bez tradycyjnego
              overflow-menu) — ALE sam dropdown „⋯" (Canvas menu) jest wciąż
              mega-kebabem: Widok canvas, Most common actions, Add element, AI
              on selection, Ręczna edycja (+ nowa Historia), Starter templates
              + builder, Workspace actions, materializedTo, Markdown actions
              (+ nowy Import — 12+ pozycji), MD file properties, Capabilities i
              workflow, workflow ledger. #87d NIE jest rozwiązane — jest osobną
              robotą (restrukturyzacja kebaba na sekcje/karty), poza zakresem
              tej naprawy.
            </>
          ) : (
            <>
              The "⋯" trigger itself is a flat icon (no traditional overflow
              button) — but the dropdown it opens (Canvas menu) is still a
              mega-kebab with 10+ sections. #87d is NOT resolved; restructuring
              that dropdown is separate follow-up work, out of scope here.
            </>
          )}
        </div>
      </div>
    </div>
  );
}
