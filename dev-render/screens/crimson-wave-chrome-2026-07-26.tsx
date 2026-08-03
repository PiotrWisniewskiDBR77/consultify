/**
 * Dev-render host for the crimson purge wave 2026-07-26 (audyt TRIADA).
 *
 * Screenshot-only PRZED/PO gallery, wzorem `crimson-mywork-wave2.tsx` — te
 * same klasy (real c-* tokeny z ../src/index.css), pełny live mount tych
 * komponentów wymagałby org context / heavy data providers.
 *
 * Zakres: 6 plików shared/ModuleHub (search toggle, filtr kolumny, dropdown
 * statusu, "Clear all", spinner ładowania, statusy/kategorie DynamicTabs)
 * + MyWorkHub (search toggle, view-mode toggle, focus ring) + InboxContent
 * (Apply recommended action, ikony AI).
 */
import { Check, ChevronDown, Loader2, Rocket, Search, Sparkles, Star } from 'lucide-react';
import React from 'react';

type Row = {
  file: string;
  label: string;
  oldCls: string;
  newCls: string;
  content: React.ReactNode;
};

const ROWS: Row[] = [
  {
    file: 'ModuleNavBar.tsx:362',
    label: 'Search toggle — aktywny',
    oldCls:
      'h-9 w-9 inline-flex items-center justify-center rounded-full border bg-white/70 dark:bg-white/[0.06] text-slate-900 dark:text-slate-100 border-primary-500/40',
    newCls:
      'h-9 w-9 inline-flex items-center justify-center rounded-full border bg-white/70 dark:bg-white/[0.06] text-slate-900 dark:text-slate-100 border-slate-300 dark:border-white/25',
    content: <Search size={18} />,
  },
  {
    file: 'FilterableTable.tsx:199',
    label: 'Aktywna ikona filtra kolumny',
    oldCls: 'p-1 rounded-md text-primary-400',
    newCls: 'p-1 rounded-md text-slate-900 dark:text-slate-100',
    content: <ChevronDown size={14} />,
  },
  {
    file: 'StatusDropdown.tsx:549/559',
    label: 'Wybrana pozycja dropdownu',
    oldCls:
      'w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-primary-500/10 text-slate-900 dark:text-slate-100',
    newCls:
      'w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-900/[0.07] dark:bg-white/10 text-slate-900 dark:text-slate-100',
    content: (
      <>
        <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
        <span className="flex-1 text-sm">On track</span>
        <Check size={14} className="text-slate-900 dark:text-slate-100" />
      </>
    ),
  },
  {
    file: 'ActiveFilters.tsx:60',
    label: '"Clear all" hover',
    oldCls: 'text-[11px] text-slate-500 hover:text-primary-400',
    newCls: 'text-[11px] text-slate-500 hover:text-slate-900 dark:hover:text-white',
    content: <>Clear all</>,
  },
  {
    file: 'HubWorkAreaLoading.tsx:11',
    label: 'Spinner ładowania',
    oldCls: 'w-8 h-8 animate-spin text-primary-500',
    newCls: 'w-8 h-8 animate-spin text-slate-400 dark:text-slate-500',
    content: <Loader2 />,
  },
  {
    file: 'DynamicTabs.tsx — SCHEDULED dot',
    label: 'Status SCHEDULED (=info, C1 SSOT)',
    oldCls: 'w-2 h-2 rounded-full bg-primary-400',
    newCls: 'w-2 h-2 rounded-full bg-blue-400',
    content: null,
  },
  {
    file: 'DynamicTabs.tsx — TYPE_BORDER_COLORS',
    label: 'Akcent kategorii "Digital"/DRD/assessment',
    oldCls: 'border-l-4 border-l-primary-500 pl-2',
    newCls: 'border-l-4 border-l-indigo-500 pl-2',
    content: <>ROB</>,
  },
  {
    file: 'MyWorkHub.tsx:3785 — search toggle aktywny',
    label: 'My Work search toggle',
    oldCls:
      'h-9 w-9 inline-flex items-center justify-center rounded-full border bg-primary-50 dark:bg-primary-500/10 border-primary-200 dark:border-primary-500/30 text-primary-700 dark:text-primary-200',
    newCls:
      'h-9 w-9 inline-flex items-center justify-center rounded-full border bg-slate-900/[0.07] dark:bg-white/10 border-slate-300 dark:border-white/25 text-slate-900 dark:text-slate-100',
    content: <Search size={18} />,
  },
  {
    file: 'MyWorkHub.tsx:3912+ — view-mode toggle aktywny (×5)',
    label: 'Tasks/Decisions/Inbox/Ideas list-card toggle',
    oldCls:
      'h-8 w-8 inline-flex items-center justify-center rounded-md bg-white/80 dark:bg-navy-800 text-primary-700 dark:text-primary-300 shadow-sm border border-slate-200/70 dark:border-white/[0.06]',
    newCls:
      'h-8 w-8 inline-flex items-center justify-center rounded-md bg-white/80 dark:bg-navy-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200/70 dark:border-white/[0.06]',
    content: <Search size={16} />,
  },
  {
    file: 'MyWorkHub.tsx:3217 — Rocket "promoted" bucket',
    label: 'Ikona bucketu Ideas — promoted',
    oldCls: 'text-primary-600 dark:text-primary-300',
    newCls: 'text-blue-600 dark:text-blue-300',
    content: <Rocket size={14} />,
  },
  {
    file: 'InboxContent.tsx:1679 — Apply recommended action',
    label: 'CTA pozytywne (akceptacja rekomendacji AI)',
    oldCls:
      'inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-medium border border-primary-400/30 dark:border-primary-500/20 bg-transparent text-primary-600 dark:text-primary-300',
    newCls:
      'inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-medium border border-green-300/40 dark:border-green-500/30 bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-200',
    content: (
      <>
        <Check size={11} /> Focus this week
      </>
    ),
  },
  {
    file: 'InboxContent.tsx:1736/2461/3119 — AI Sparkles/Star',
    label: 'Źródło = AI (token c-ai, "jeden fiolet AI")',
    oldCls: 'text-primary-400/80',
    newCls: 'text-c-ai/80',
    content: <Sparkles size={12} />,
  },
];

function Cell({ row, variant }: { row: Row; variant: 'old' | 'new' }) {
  const cls = variant === 'old' ? row.oldCls : row.newCls;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-c-border-subtle bg-c-surface p-3">
      <div className={cls}>{row.content}</div>
      <code className="text-[10px] text-c-text-muted break-all">{cls}</code>
    </div>
  );
}

export function CrimsonWaveChromeScreen(): React.ReactElement {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }} className="space-y-6">
      <h1 className="text-lg font-semibold text-c-text">
        Crimson purge 2026-07-26 — PRZED / PO ({ROWS.length} miejsc)
      </h1>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-c-text-muted text-xs uppercase">
            <th className="pb-2">Plik</th>
            <th className="pb-2">PRZED (crimson)</th>
            <th className="pb-2">PO (neutralne/semantyczne)</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.file} className="border-t border-c-border-subtle align-top">
              <td className="py-3 pr-4 text-xs text-c-text-muted w-64">
                <div className="font-medium text-c-text">{row.label}</div>
                {row.file}
              </td>
              <td className="py-3 pr-4">
                <Cell row={row} variant="old" />
              </td>
              <td className="py-3">
                <Cell row={row} variant="new" />
              </td>
            </tr>
          ))}
          <tr key="ai-icon-2" className="border-t border-c-border-subtle align-top">
            <td className="py-3 pr-4 text-xs text-c-text-muted w-64">
              <div className="font-medium text-c-text">Źródło = AI (Star)</div>
              InboxContent.tsx:2461/3119
            </td>
            <td className="py-3 pr-4">
              <div className="flex items-center gap-2 rounded-lg border border-c-border-subtle bg-c-surface p-3">
                <Star size={14} className="text-primary-500" />
                <code className="text-[10px] text-c-text-muted">text-primary-500</code>
              </div>
            </td>
            <td className="py-3">
              <div className="flex items-center gap-2 rounded-lg border border-c-border-subtle bg-c-surface p-3">
                <Star size={14} className="text-c-ai" />
                <code className="text-[10px] text-c-text-muted">text-c-ai</code>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default CrimsonWaveChromeScreen;
