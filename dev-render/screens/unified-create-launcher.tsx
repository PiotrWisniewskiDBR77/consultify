/**
 * Dev-render host dla I1-I3 Faza 0/Faza 1 — UnifiedCreateLauncher ("+ Nowy" chooser).
 *
 * Mounts the REAL `UnifiedCreateLauncher` component (Krok 0 — wybór typu),
 * not a mock reproduction — unlike canvas-new-doc.tsx, this step has ZERO
 * Api/store dependencies (only useTranslation), so it mounts cleanly here.
 *
 * NOTE: clicking one of the 3 cards advances the component to render the real
 * generator (InsightCreatorModal / InitiativeCharterWizard / NewDecisionModal)
 * — those DO pull Api/store data and are NOT expected to mount cleanly in this
 * harness (no backend, no logged-in store). This story exists to review the
 * Krok 0 chooser's own look (CLAUDE.md #7) — don't click through for the
 * screenshot pass.
 *
 * I1-I3 Faza 1 — `context` param simulates the host module's `defaultType`
 * wiring (see UnifiedCreateLauncher.tsx's `defaultType` prop):
 *   - `mywork` / `interview` (or omitted) → no defaultType, full Krok 0
 *     chooser — matches how MyWorkHub.tsx and InterviewHub.tsx wire the
 *     launcher (global "+ Nowy", context is ambiguous).
 *   - `initiatives` → defaultType="initiative", Krok 0 is skipped and the
 *     Krok 1 generator (InitiativeCharterWizard) renders directly — matches
 *     InitiativesHub.tsx's Menu 3 wiring. Note the caveat above: this variant
 *     WILL attempt to mount InitiativeCharterWizard's own Api/store-touching
 *     effects; expect it to render its chrome/fields but not real data.
 *
 * URL params: ?screen=unified-create-launcher&theme=light|dark&lang=pl|en
 *             &context=mywork|interview|initiatives (default: mywork)
 */
import React from 'react';

import { UnifiedCreateLauncher } from '../../src/components/shared/UnifiedCreateLauncher';

type HostContext = 'mywork' | 'interview' | 'initiatives';

function readContext(): HostContext {
  if (typeof window === 'undefined') return 'mywork';
  const raw = new URLSearchParams(window.location.search).get('context');
  return raw === 'initiatives' || raw === 'interview' ? raw : 'mywork';
}

const CONTEXT_LABEL: Record<HostContext, { pl: string; en: string }> = {
  mywork: {
    pl: 'My Work — "+ Nowy" (bez kontekstu, pełny Krok 0)',
    en: 'My Work — "+ New" (no context, full Krok 0)',
  },
  interview: {
    pl: 'Interview Hub — "+ Nowy" (bez kontekstu, pełny Krok 0)',
    en: 'Interview Hub — "+ New" (no context, full Krok 0)',
  },
  initiatives: {
    pl: 'Initiatives Hub — Menu 3 "Nowy" (defaultType=initiative, Krok 0 pominięty)',
    en: 'Initiatives Hub — Menu 3 "New" (defaultType=initiative, Krok 0 skipped)',
  },
};

export default function UnifiedCreateLauncherScreen(): React.ReactElement {
  const context = readContext();
  const isPolish = (new URLSearchParams(window.location.search).get('lang') || 'pl') === 'pl';
  const label = isPolish ? CONTEXT_LABEL[context].pl : CONTEXT_LABEL[context].en;

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-slate-50 dark:bg-navy-950">
      <div className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-600 shadow-sm dark:border-white/[0.08] dark:bg-navy-900 dark:text-slate-300">
        {label}
      </div>
      <UnifiedCreateLauncher
        isOpen
        onClose={() => {}}
        defaultType={context === 'initiatives' ? 'initiative' : undefined}
      />
    </div>
  );
}
