/**
 * DEV-RENDER: FAZA C modelu ról PM — `<CapabilityGate>` w 3 trybach.
 *
 * Pokazuje TE SAME przyciski (wzorowane 1:1 na realnych wpięciach:
 * InitiativeFullView / TaskDetailView / DecisionDetailView) w:
 *   1. SHADOW (dzisiejszy default)     → render identyczny jak bez bramki,
 *   2. SHADOW + ?debugCapabilities=1   → badge z werdyktem would-allow,
 *   3. ENFORCE (przyszłość po fladze)  → deny chowa (hide) / wygasza (disable).
 *
 * Hook zamockowany przez EffectiveAccessOverrideContext — zero sieci/logowania.
 * URL: ?screen=capability-gate-demo&theme=light|dark
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AlertTriangle, Check, CheckCircle2, Play, Share2 } from 'lucide-react';
import React from 'react';

import { CapabilityGate } from '@/components/shared/CapabilityGate';
import { EffectiveAccessOverrideContext } from '@/hooks/useEffectiveAccess';

// Hook używa React Query (jak cała appka — AppProviders); harness musi dać
// własny provider. Override-context i tak wyłącza fetch (enabled:false).
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

/** Rola demo: TEAM_MEMBER — może startować i kończyć, NIE może blokować,
 *  approve'ować decyzji ani reassignować zadań. */
const MEMBER_CAPABILITIES = ['initiative.start', 'initiative.complete', 'task.assign.own'];

function DemoButtons({ debug }: { debug?: boolean }): React.ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-3 py-1">
      {/* InitiativeFullView — akcje gate'ów */}
      <CapabilityGate capability="initiative.start" debugOverride={debug}>
        <button className="px-4 py-2 text-sm font-medium text-white rounded-lg flex items-center gap-2 bg-blue-600 hover:bg-blue-500">
          <Play size={16} /> Start Execution
        </button>
      </CapabilityGate>
      <CapabilityGate capability="initiative.complete" debugOverride={debug}>
        <button className="px-4 py-2 text-sm font-medium text-white rounded-lg flex items-center gap-2 bg-green-600 hover:bg-green-500">
          <CheckCircle2 size={16} /> Mark Complete
        </button>
      </CapabilityGate>
      <CapabilityGate capability="initiative.block" debugOverride={debug}>
        <button className="px-4 py-2 text-sm font-medium text-white rounded-lg flex items-center gap-2 bg-danger-600 hover:bg-danger-500">
          <AlertTriangle size={16} /> Block
        </button>
      </CapabilityGate>
      {/* TaskDetailView — Reassign */}
      <CapabilityGate capability="task.reassign" debugOverride={debug}>
        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600/60 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800">
          <Share2 size={13} /> Reassign
        </button>
      </CapabilityGate>
      {/* DecisionDetailView — Approve (gateMode=disable) */}
      <CapabilityGate capability="decision.approve" gateMode="disable" debugOverride={debug}>
        <button className="px-3 py-2 rounded-xl border border-emerald-400/50 text-emerald-500 hover:bg-emerald-500/10 text-sm font-medium inline-flex items-center gap-1.5">
          <Check size={14} /> Approve decision
        </button>
      </CapabilityGate>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-5">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{subtitle}</p>
      {children}
    </section>
  );
}

export default function CapabilityGateDemoScreen(): React.ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <CapabilityGateDemoBody />
    </QueryClientProvider>
  );
}

function CapabilityGateDemoBody(): React.ReactElement {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-950 p-8 space-y-5">
      <header>
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          Faza C — CapabilityGate (model ról PM)
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Rola demo: TEAM_MEMBER — capabilities: {MEMBER_CAPABILITIES.join(', ')} · te same
          przyciski w 3 trybach
        </p>
      </header>

      <EffectiveAccessOverrideContext.Provider
        value={{ mode: 'shadow', isLoading: false, error: null, capabilities: MEMBER_CAPABILITIES }}
      >
        <Section
          title="1 · SHADOW — dzisiejszy default (CAPABILITY_ENFORCE nieustawione)"
          subtitle="can() zawsze true → render 1:1 jak bez bramki; zero zmiany dzisiejszego UI"
        >
          <DemoButtons />
        </Section>

        <Section
          title="2 · SHADOW + ?debugCapabilities=1 — tryb diagnostyczny"
          subtitle="outline + badge: zielony = would-allow, pomarańczowy = DENY po włączeniu enforce (przycisk wciąż działa!)"
        >
          <DemoButtons debug />
        </Section>
      </EffectiveAccessOverrideContext.Provider>

      <EffectiveAccessOverrideContext.Provider
        value={{
          mode: 'enforce',
          isLoading: false,
          error: null,
          capabilities: MEMBER_CAPABILITIES,
        }}
      >
        <Section
          title="3 · ENFORCE — przyszłość (po fladze CAPABILITY_ENFORCE=enforce)"
          subtitle="Block + Reassign znikają (hide); Approve decision wygaszony (disable); Start/Complete zostają"
        >
          <DemoButtons />
        </Section>
      </EffectiveAccessOverrideContext.Provider>

      <footer className="text-[11px] text-slate-400 dark:text-slate-500">
        Kontrakt fail-open: loading/błąd/shadow → wszystko renderowane. Testy:
        tests/hooks/useEffectiveAccess.test.tsx (6✓).
      </footer>
    </div>
  );
}
