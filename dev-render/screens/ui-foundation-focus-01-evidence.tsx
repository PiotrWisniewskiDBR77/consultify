/**
 * UI-FOUNDATION-FOCUS-01 — dev-render evidence harness (Etap 2 Visual QA).
 *
 * Mounts:
 *  1. The REAL `<TabeleLeftRail>` component (src/components/AIChat/KimiWorkspace/
 *     tabeleShell/TabeleLeftRail.tsx) — zero required props, genuinely exercises
 *     the focus-visible fix applied to its outline-item button.
 *  2. A "class swatch" section — plain buttons using the EXACT className string
 *     now present in the four triada-gate-closure files (DocumentInlineAIMenu
 *     trigger, KpiOverviewView "Open", KpiQueueView AI-generate action,
 *     PortfolioInsightsPanel "Go to Outputs"). These are NOT the live components
 *     (which self-fetch data / need a TipTap editor instance and are not cheaply
 *     mountable standalone) — they are literal copies of the fixed className so
 *     the rendered color + focus ring can be visually confirmed against the
 *     real surrounding surface tokens. Labelled clearly, not presented as the
 *     live component.
 *
 * URL: ?screen=ui-foundation-focus-01-evidence[&theme=light|dark]
 */
import React from 'react';

import { TabeleLeftRail } from '../../src/components/AIChat/KimiWorkspace/tabeleShell/TabeleLeftRail';

const Swatch: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.03] p-4 mb-4">
    <div className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">
      {title}
    </div>
    {children}
  </div>
);

export default function UiFoundationFocus01EvidenceScreen() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-950 p-8 text-slate-900 dark:text-white">
      <h1 className="text-lg font-semibold mb-1">UI-FOUNDATION-FOCUS-01 — Visual QA evidence</h1>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
        Tab przez kontrolki poniżej, żeby zobaczyć pierścień fokusa (niebieski, --c-focus). Klik
        myszą NIE powinien pokazać pierścienia (focus-visible).
      </p>

      <Swatch title="Materials — TabeleLeftRail (REAL component)">
        <div className="max-w-xs">
          <TabeleLeftRail activeItemId="kpi" />
        </div>
      </Swatch>

      <Swatch title="DocumentStudio/inline-ai/DocumentInlineAIMenu.tsx — trigger button (class swatch, exact className)">
        <button
          type="button"
          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised/[0.06] transition-colors w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          <span>Popraw z Teresa</span>
        </button>
      </Swatch>

      <Swatch title="Results/KpiOverviewView.tsx — &quot;Open&quot; button (class swatch, exact className)">
        <button
          type="button"
          className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          Open
        </button>
      </Swatch>

      <Swatch title="Results/KpiQueueView.tsx — AI-generate secondary action (class swatch, exact className)">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.03] px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          Generate AI package
        </button>
      </Swatch>

      <Swatch title="Results/PortfolioInsightsPanel.tsx — &quot;Go to Outputs&quot; (class swatch, exact className)">
        <button
          type="button"
          className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          Go to Outputs →
        </button>
      </Swatch>
    </div>
  );
}
