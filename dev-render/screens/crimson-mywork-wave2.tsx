/**
 * Dev-render host for CRIMSON WAVE #2 (MyWork).
 *
 * Screenshot-only PRZED/PO gallery for the ~36 `bg-c-accent` CTA/active-state
 * fixes across src/components/MyWork/**. The classNames below are copied 1:1
 * from the real production components (both the OLD crimson variant and the NEW
 * neutral variant), grouped by the 3 fix archetypes, so the owner can accept the
 * color change on a clean screenshot in BOTH light and dark themes.
 *
 * Why a className gallery (not the live components): the affected buttons live
 * inside heavy MyWork tools (IdeaTableTool, TableToolbar, ViewSwitcher, …) that
 * require org context / data providers to mount. For a pure color-token wave the
 * exact rendered classNames ARE the meaningful artifact — this reproduces them
 * faithfully with the real c-* token system loaded via ../src/index.css.
 */
import React from 'react';
import { Check, Plus, Save, Send } from 'lucide-react';

type Row = { file: string; label: string; oldCls: string; newCls: string; content: React.ReactNode };

// ── Archetype 1 — filled CTA (bg-c-accent text-white → bg-c-text text-c-surface) ──
const FILLED: Row[] = [
  {
    file: 'table/EmptyStateView.tsx:101',
    label: 'Pusty stan — główne CTA',
    oldCls:
      'inline-flex items-center justify-center gap-2 rounded-xl bg-c-accent px-3 py-2.5 text-xs font-semibold text-white shadow-sm hover:brightness-95 transition-colors',
    newCls:
      'inline-flex items-center justify-center gap-2 rounded-xl bg-c-text px-3 py-2.5 text-xs font-semibold text-c-surface shadow-sm hover:brightness-95 transition-colors',
    content: (
      <>
        <Plus size={14} /> Nowy rekord
      </>
    ),
  },
  {
    file: 'processflow/ProcessFlowToolbar.tsx:497',
    label: 'Zapis (najsilniejsza akcja)',
    oldCls:
      'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors bg-c-accent text-white hover:brightness-110',
    newCls:
      'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors bg-c-text text-c-surface hover:brightness-110',
    content: (
      <>
        <Save size={14} /> Zapisz
      </>
    ),
  },
  {
    file: 'table/ChatToSchemaPanel.tsx:705',
    label: 'Wyślij (przycisk ikonowy)',
    oldCls:
      'p-2.5 rounded-xl bg-c-accent text-white hover:bg-c-accent transition-colors shadow-sm',
    newCls:
      'p-2.5 rounded-xl bg-c-text text-c-surface hover:opacity-90 transition-colors shadow-sm',
    content: <Send size={16} />,
  },
];

// ── Archetype 2/3 — toggle / selected tab (neutralny fill) ──
const SELECTED: Row[] = [
  {
    file: 'table/RowDetailPanel.tsx:1118',
    label: 'Aktywny tab (pill)',
    oldCls:
      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-c-accent text-white shadow-sm',
    newCls:
      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-c-text text-c-surface shadow-sm',
    content: <>Szczegóły</>,
  },
  {
    file: 'NotebookContent.tsx:3017',
    label: 'Toggle panelu bocznego (ON)',
    oldCls:
      'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium border-c-accent bg-c-accent text-c-surface',
    newCls:
      'inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium border-c-text bg-c-text text-c-surface',
    content: <>Panel AI</>,
  },
];

// ── Checkbox selected (bg-c-accent border-c-accent → bg-c-text border-c-text) ──
function Checkbox({ neutral }: { neutral: boolean }): React.ReactElement {
  return (
    <span
      className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0 ${
        neutral ? 'bg-c-text border-c-text' : 'bg-c-accent border-c-accent'
      }`}
    >
      <Check size={9} className={neutral ? 'text-c-surface' : 'text-white'} />
    </span>
  );
}

// ── Progress meter (bg-c-accent → bg-c-info, spójność ze sliderem accent-c-info) ──
function Meter({ neutral }: { neutral: boolean }): React.ReactElement {
  return (
    <div className="w-40 h-2 rounded-full bg-c-border-subtle overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${neutral ? 'bg-c-info' : 'bg-c-accent'}`}
        style={{ width: '62%' }}
      />
    </div>
  );
}

function Cell({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-c-border-subtle bg-c-surface p-4">
      <span className="text-[10px] uppercase tracking-wide text-c-text-muted">{title}</span>
      <div className="flex min-h-[40px] items-center">{children}</div>
    </div>
  );
}

function Section({ heading, rows }: { heading: string; rows: Row[] }): React.ReactElement {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold text-c-text">{heading}</h2>
      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <div
            key={r.file}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-4 rounded-xl border border-c-border-subtle bg-c-surface p-4"
          >
            <div className="min-w-0">
              <div className="text-xs font-medium text-c-text">{r.label}</div>
              <code className="text-[10px] text-c-text-muted">{r.file}</code>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[9px] uppercase tracking-wide text-c-text-muted">PRZED</span>
              <button className={r.oldCls}>{r.content}</button>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[9px] uppercase tracking-wide text-c-text-muted">PO</span>
              <button className={r.newCls}>{r.content}</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function CrimsonMyWorkWave2Screen(): React.ReactElement {
  return (
    <div className="min-h-full w-full bg-c-bg p-10">
      <div className="mx-auto max-w-[860px]">
        <h1 className="mb-1 text-base font-bold text-c-text">
          Crimson Wave #2 — MyWork (CTA/aktywne → neutralne)
        </h1>
        <p className="mb-8 text-xs text-c-text-muted">
          Kanon: crimson tylko semantyka krytyczna; CTA/stany aktywne = neutralne. 36 miejsc
          naprawionych; 5 celowo zostawionych (awatary, kolor statusu „converted"). Definicja
          <code className="mx-1">--c-accent</code> (brandowalna) nietknięta.
        </p>

        <Section heading="Archetyp 1 — Filled CTA → bg-c-text / text-c-surface" rows={FILLED} />
        <Section heading="Archetyp 2/3 — Toggle · aktywny tab → neutralny fill" rows={SELECTED} />

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold text-c-text">
            Checkbox zaznaczony · Meter % (spójność ze sliderem)
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Cell title="Checkbox PRZED">
              <Checkbox neutral={false} />
            </Cell>
            <Cell title="Checkbox PO">
              <Checkbox neutral={true} />
            </Cell>
            <Cell title="Meter PRZED">
              <Meter neutral={false} />
            </Cell>
            <Cell title="Meter PO">
              <Meter neutral={true} />
            </Cell>
          </div>
          <p className="mt-2 text-[10px] text-c-text-muted">
            table/CellEditor.tsx:353 (checkbox) · table/CellExpandPopover.tsx:356 (meter → bg-c-info)
          </p>
        </section>
      </div>
    </div>
  );
}
