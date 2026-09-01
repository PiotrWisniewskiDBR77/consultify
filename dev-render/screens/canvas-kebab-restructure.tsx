/**
 * Dev-render host dla #87d — „Kebab przeładowany" (restrukturyzacja).
 *
 * Odtwarza kebab „⋯" (canvas-diagnostics-menu) z `WorkCanvasDocumentPanel.tsx`
 * PO restrukturyzacji: 8 nazwanych, ZWIJALNYCH grup-akordeonów (chevron),
 * domyślnie otwarte tylko Widok + Edycja i AI; reszta zwinięta. Zero utraty
 * funkcji — każda dawna pozycja ma nowe miejsce w grupie. Duplikat „Versions"
 * (prymitywny stepper) USUNIĘTY; jedyny podgląd = CanvasVersionHistory. Real
 * component nie montuje się tu (ciągnie cały canvas draft store + API), więc
 * — jak istniejący story #87c — ODTWARZA 1:1 markup + klasy z realnego pliku.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ★ 2026-09-01 — USUNIĘTY stan PRZED + ramka „Mapowanie" (audyt przyrządu,
 * Kategoria 3).
 *
 * Ten ekran był dokumentem projektowym (PRZED mega-kebaba + PO + tabela
 * mapowania pozycji) zamiast pojedynczym ekranem produktu — właściciel
 * oceniał trzy rzeczy naraz w jednym kadrze, z czego produkcja renderuje
 * TYLKO stan PO. Stan PRZED (opisujący coś, co już nie istnieje w kodzie po
 * #87d) i tabela mapowania były materiałem uzasadniającym decyzję, nie
 * ekranem do odbioru wizualnego — usunięte stąd. Zostaje wyłącznie kebab
 * PO, żeby zrzut pokazywał to, co użytkownik faktycznie zobaczy.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * URL: ?screen=canvas-kebab-restructure&theme=light|dark&lang=pl|en
 */
import { ChevronDown, History } from 'lucide-react';
import React from 'react';

// ── wspólne atomy (klasy 1:1 z realnego pliku) ─────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-slate-700 dark:text-slate-200">
      {children}
    </div>
  );
}

function GroupSummary({ label }: { label: string }): React.ReactElement {
  return (
    <summary className="flex cursor-pointer select-none items-center justify-between rounded-xl px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10">
      <span>{label}</span>
      <ChevronDown
        size={14}
        className="shrink-0 text-slate-400 transition-transform group-open:rotate-180"
      />
    </summary>
  );
}

// ── kebab PO: 8 nazwanych, zwijalnych grup ─────────────────────────────────

function KebabAfter({ isPl }: { isPl: boolean }): React.ReactElement {
  return (
    <div>
      <div className="max-h-[560px] w-[360px] overflow-auto rounded-2xl border border-slate-200 bg-white p-3 text-xs shadow-xl dark:border-white/10 dark:bg-navy-800">
        {/* 1. WIDOK (open) */}
        <details
          className="group space-y-1.5 border-b border-slate-200 pb-3 dark:border-white/10"
          open
        >
          <GroupSummary label={isPl ? 'Widok' : 'View'} />
          <div className="mx-2.5 mt-1 inline-flex rounded-full bg-slate-100 p-1 dark:bg-white/10">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-950 shadow-sm dark:text-slate-950">
              Dock
            </span>
            <span className="px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              MD
            </span>
          </div>
        </details>

        {/* 2. Most common actions (closed) */}
        <details className="group mt-3 space-y-1.5 border-b border-slate-200 pb-3 dark:border-white/10">
          <GroupSummary label="Most common actions" />
          <Row>Expand · Rewrite · Add element · New template · …</Row>
        </details>

        {/* 3. Add element (closed) */}
        <details className="group mt-3 space-y-1.5 border-b border-slate-200 pb-3 dark:border-white/10">
          <GroupSummary label="Add element" />
          <Row>Text · Heading · Table · Diagram · List · Summary</Row>
        </details>

        {/* 4. Edycja i AI (open) — AI on selection + Manual editing */}
        <details className="group mt-3 border-b border-slate-200 dark:border-white/10" open>
          <GroupSummary label={isPl ? 'Edycja i AI' : 'Edit & AI'} />
          <div className="mt-1 space-y-1.5 pb-3">
            <SectionHeader>AI on selection</SectionHeader>
            <div className="grid grid-cols-2 gap-1.5 px-2.5">
              {['Expand idea', 'Shorten', 'Rewrite', 'Suggest'].map((x) => (
                <span
                  key={x}
                  className="rounded-lg bg-slate-100 px-2 py-1.5 text-center text-[11px] font-semibold text-slate-700 dark:bg-white/10 dark:text-slate-300"
                >
                  {x}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-1.5 border-b border-slate-200 pb-3 dark:border-white/10">
            <SectionHeader>{isPl ? 'Manual editing' : 'Manual editing'}</SectionHeader>
            <Row>{isPl ? 'Edytuj Markdown ręcznie' : 'Edit Markdown manually'}</Row>
            <Row>{isPl ? 'Wróć do widoku dokumentu' : 'Back to document view'}</Row>
            <Row>
              <History size={14} />
              <span>{isPl ? 'Historia wersji' : 'Version history'}</span>
            </Row>
          </div>
        </details>

        {/* 5. Starter templates (closed) */}
        <details className="group mt-3 space-y-1.5 border-b border-slate-200 pb-3 dark:border-white/10">
          <GroupSummary label="Starter templates" />
          <div className="mt-1 flex items-center justify-end px-2.5">
            <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:border-white/15 dark:text-slate-300">
              ＋ {isPl ? 'Nowy szablon' : 'New template'}
            </span>
          </div>
        </details>

        {/* 6. Plik, eksport i workspace (closed) */}
        <details className="group mt-3 border-b border-slate-200 dark:border-white/10">
          <GroupSummary label={isPl ? 'Plik, eksport i workspace' : 'File, export & workspace'} />
          <div className="mt-1 space-y-1 px-2.5 pb-3 text-[11px] text-slate-500 dark:text-slate-400">
            Workspace actions · provenance · dataset · Markdown/CSV/PDF/Word/Excel/PPTX · Studia
          </div>
        </details>

        {/* 7. Diagnostyka i workflow (closed) */}
        <details className="group mt-3 border-b border-slate-200 pb-1 dark:border-white/10">
          <GroupSummary label={isPl ? 'Diagnostyka i workflow' : 'Diagnostics & workflow'} />
          <div className="mt-1 space-y-1 px-2.5 pb-3 text-[11px] text-slate-500 dark:text-slate-400">
            MD file properties · Capabilities/workflow · workflow ledger
          </div>
        </details>

        {/* 8. Zaawansowane (closed) */}
        <details className="group mt-3 border-t border-slate-200 pt-3 dark:border-white/10">
          <GroupSummary label={isPl ? 'Zaawansowane' : 'Advanced'} />
          <div className="mt-2 flex flex-wrap gap-2 px-1">
            {['Reset', 'Version history', 'Show changes'].map((x) => (
              <span
                key={x}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-white/10 dark:text-slate-300"
              >
                {x === 'Version history' ? <History size={12} /> : null}
                {x}
              </span>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}

export default function CanvasKebabRestructureScreen(): React.ReactElement {
  const params = new URLSearchParams(window.location.search);
  const isPl =
    (params.get('lang') || 'pl') === 'pl' ||
    (document.documentElement.lang || 'pl').startsWith('pl');

  return (
    <div className="min-h-screen w-full bg-slate-50 p-8 dark:bg-navy-950">
      <div className="mx-auto max-w-[820px] space-y-6">
        <div className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
          #87d — {isPl ? 'Restrukturyzacja kebaba „⋯" (Canvas)' : 'Canvas “⋯” kebab restructure'}
        </div>
        <KebabAfter isPl={isPl} />
      </div>
    </div>
  );
}
