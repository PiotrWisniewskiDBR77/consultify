/**
 * ExecutionLightShell — lightweight, dense redesign of the Execution /
 * Program Management module surface (companion to `DRDLightShell` /
 * `FinanceLightShell` / `ResultsLightShell` — same doctrine, same shell
 * shape). NEW component; `ExecutionHub.tsx` is untouched. Gated OFF by
 * default behind `executionLightFlag.ts` (`?ff_executionLight=1`) — real
 * wiring into `ExecutionHub` happens in a later step, only after Piotr signs
 * off on the harness screenshot (CLAUDE.md rule #7: no flag-flip as a first
 * look).
 *
 * IA per owner review #80a/#80b (2026-07-10, `_PRZEGLAD_DOMOWY_WYNIKI_2026-07-10.md`):
 * Execution = PROGRAM MANAGEMENT (doctrine #28). Piotr's own IA — 4 tabs,
 * a redefinition of function, not just a re-skin of the old
 * Summary/Rollout/Reporting/Management tabs:
 *   1. SUMMARY   — all the NUMBERS (program dashboard: engagement / on-time /
 *      people, plus the McKinsey 3-axis progress pattern below).
 *   2. ALERTY    — problem & risk alert management (was "Rollout" — a
 *      redefinition of sense, not a rename).
 *   3. REPORTING — building reports for different audiences.
 *   4. MANAGEMENT — management + decision support based on identified risks.
 *
 * McKinsey 3-axis report pattern (Piotr's own recollection of a real McKinsey
 * program, #80b): "ile UPŁYNĘŁO CZASU × w jakim stopniu zrealizowane ZADANIA
 * × w jakim stopniu osiągnięty zakładany PARAMETR FINANSOWY/OPERACYJNY" —
 * this shell renders EXACTLY that shape, already computed server-side by
 * `server/src/services/execution/threeAxisReportService.ts`:
 *   - T (czas)    = time-elapsed fraction vs. baseline schedule.
 *   - Z (zadania) = EV/BAC (task/cost completion).
 *   - W (wartość) = realized value vs. target (value_ledger banked amounts).
 *   - scheduleHealth (Z-vs-T) = SPI, impactGap (W-vs-Z), deliveryPromise
 *     (W-vs-T) — the "postępy i problemy" derived signals the report exists
 *     for. RAG thresholds mirror the engine 1:1 (>=0.95 GREEN, >=0.85 AMBER,
 *     else RED).
 * Program-level rollup (project→program hierarchy, "ludzie"/portfolio scope)
 * mirrors `server/src/services/pmo/programRollupService.ts`. Alerts mirror
 * `server/src/services/executionTriageService.ts` (deterministic, grounded
 * severity triage — no LLM invention). Reports mirror the report catalog
 * shape in `src/components/Execution/executionReports.ts` (the existing
 * "11 raportów" — #80 — audience/cadence/RAG, not reimplemented here).
 *
 * This component is presentational only (props in, JSX out) — no store, no
 * API calls, no context — exactly like `EvBasketFootballField` /
 * `FinanceLightShell`. Mock data for the dev-render harness lives in
 * `dev-render/screens/execution-light.tsx`, not here.
 *
 * TABLE CANON (2026-07-12, CLAUDE.md rule #9 / `scripts/check-list-canon.sh`):
 * every record list here (initiatives, alerts, reports, decisions) embeds the
 * REAL `<StandardTable>` facade (import, not reimplementation) — mirrors
 * `InitiativesLightShell.tsx` ListTab. No hand-rolled `grid` + `.map()`
 * tables; that regression ("tabelki jak dla trzylatka") is exactly what this
 * rebuild fixes.
 *
 * COLOR DOCTRINE (hard, identical to DRDLightShell/FinanceLightShell):
 *   - `c-accent` (Harvard Crimson) is reserved for critical semantics only —
 *     NOT used here. Active tab / primary numbers = the blue focus token
 *     (`--c-focus-solid`). RAG: GREEN = `c-success`, AMBER = `c-warning`,
 *     RED = `c-danger`, NA = muted text. Primary CTA is neutral
 *     (`bg-c-text text-c-surface`). No `primary-*` tokens anywhere (those are
 *     crimson) — see `check-triada.sh`/`check-artefakt.sh`.
 *   - All colors via c-* tokens (Tailwind classes or `var(--c-*)` /
 *     `rgb(var(--c-*-rgb) / a)`), never raw hex — both themes adapt.
 */
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  FolderOpen,
  Gauge,
  ListChecks,
  MessageSquare,
  MinusCircle,
  ShieldAlert,
  Target,
  Users,
  XCircle,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import StandardTable, {
  type StandardRowMenu,
  type TableColumn,
  type TableRow,
} from '../standard/StandardTable';

// ---------------------------------------------------------------------------
// Types — lightweight mirrors of the real engine output shapes
// (threeAxisReportService.ts / programRollupService.ts /
// executionTriageService.ts / executionReports.ts). Kept local to the
// frontend bundle (src/ never imports server/ directly in this codebase).
// ---------------------------------------------------------------------------

export type ExecutionRag = 'GREEN' | 'AMBER' | 'RED' | 'NA';

export interface ExecutionAxisReadingLite {
  /** 0..100 (W may exceed 100 — over-delivery vs. target). null = no data. */
  pct: number | null;
  dataQuality: 'ok' | 'missing';
}

export interface ExecutionAxisRatioLite {
  ratio: number | null;
  rag: ExecutionRag;
}

export interface ExecutionInitiativeRowLite {
  id: string;
  name: string;
  ownerName?: string;
  T: ExecutionAxisReadingLite;
  Z: ExecutionAxisReadingLite;
  W: ExecutionAxisReadingLite;
  rag: ExecutionRag;
}

export interface ExecutionProgramSummaryLite {
  initiativeCount: number;
  T: ExecutionAxisReadingLite;
  Z: ExecutionAxisReadingLite;
  W: ExecutionAxisReadingLite;
  scheduleHealth: ExecutionAxisRatioLite;
  impactGap: ExecutionAxisRatioLite;
  deliveryPromise: ExecutionAxisRatioLite;
  rag: ExecutionRag;
  /** "zaangażowanie" — % of assigned people with an active update this period. */
  engagementPct: number | null;
  /** % of tasks/milestones delivered on or before their planned date. */
  onTimePct: number | null;
  peopleAssigned: number;
  peopleCapacity: number;
  overdueCount: number;
}

export type ExecutionAlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ExecutionAlertLite {
  id: string;
  type: string;
  severity: ExecutionAlertSeverity;
  title: string;
  initiativeName?: string;
  rationale: string;
  suggestedAction: string;
}

export type ExecutionReportRag = 'green' | 'amber' | 'red';

export interface ExecutionReportLite {
  id: string;
  title: string;
  audience: string;
  cadence: string;
  rag: ExecutionReportRag;
  lastRefreshLabel?: string;
}

export type ExecutionDecisionPriority = 'high' | 'medium' | 'low';
export type ExecutionDecisionStatus = 'pending' | 'overdue' | 'done';

export interface ExecutionDecisionLite {
  id: string;
  title: string;
  ownerName?: string;
  dueLabel?: string;
  priority: ExecutionDecisionPriority;
  status: ExecutionDecisionStatus;
  linkedRiskTitle?: string;
}

export interface ExecutionLineageSourceLite {
  label: string;
  detail: string;
}

interface ExecutionLightShellProps {
  programName?: string;
  periodLabel?: string;
  status?: string;
  program: ExecutionProgramSummaryLite;
  initiatives?: ExecutionInitiativeRowLite[];
  alerts?: ExecutionAlertLite[];
  reports?: ExecutionReportLite[];
  decisions?: ExecutionDecisionLite[];
  topActions?: string[];
  lineageSources?: ExecutionLineageSourceLite[];
  lastUpdatedLabel?: string;
  onOpenChat?: () => void;
  onPublishSnapshot?: () => void;
  onOpenInitiative?: (id: string) => void;
  onOpenReport?: (id: string) => void;
  onOpenDecision?: (id: string) => void;
}

type LightTab = 'summary' | 'alerts' | 'reporting' | 'management';

const BLUE = 'rgb(var(--c-focus-solid-rgb))';
const BLUE_SOFT = 'rgb(var(--c-focus-solid-rgb) / 0.10)';

const TAB_ICON: Record<LightTab, React.ReactNode> = {
  summary: <Gauge className="h-[13px] w-[13px]" />,
  alerts: <ShieldAlert className="h-[13px] w-[13px]" />,
  reporting: <FileText className="h-[13px] w-[13px]" />,
  management: <ListChecks className="h-[13px] w-[13px]" />,
};

const RAG_META: Record<ExecutionRag, { icon: React.ReactNode; colorClass: string; barColor: string; labelPl: string }> = {
  GREEN: { icon: <CheckCircle2 className="h-3.5 w-3.5" />, colorClass: 'text-c-success', barColor: 'rgb(var(--c-success-rgb))', labelPl: 'na torze' },
  AMBER: { icon: <AlertTriangle className="h-3.5 w-3.5" />, colorClass: 'text-c-warning', barColor: 'rgb(var(--c-warning-rgb))', labelPl: 'zagrożone' },
  RED: { icon: <XCircle className="h-3.5 w-3.5" />, colorClass: 'text-c-danger', barColor: 'rgb(var(--c-danger-rgb))', labelPl: 'poza torem' },
  NA: { icon: <MinusCircle className="h-3.5 w-3.5" />, colorClass: 'text-c-text-muted', barColor: 'rgb(var(--c-border-strong-rgb))', labelPl: 'brak danych' },
};

const SEVERITY_META: Record<ExecutionAlertSeverity, { colorClass: string; bgClass: string; labelPl: string }> = {
  CRITICAL: { colorClass: 'text-c-danger', bgClass: 'bg-c-danger/10', labelPl: 'Krytyczne' },
  HIGH: { colorClass: 'text-c-danger', bgClass: 'bg-c-danger/10', labelPl: 'Wysokie' },
  MEDIUM: { colorClass: 'text-c-warning', bgClass: 'bg-c-warning/10', labelPl: 'Średnie' },
  LOW: { colorClass: 'text-c-text-muted', bgClass: 'bg-c-surface-raised', labelPl: 'Niskie' },
};

const REPORT_RAG_META: Record<ExecutionReportRag, { colorClass: string; labelPl: string }> = {
  green: { colorClass: 'text-c-success', labelPl: 'OK' },
  amber: { colorClass: 'text-c-warning', labelPl: 'Uwaga' },
  red: { colorClass: 'text-c-danger', labelPl: 'Ryzyko' },
};

const PRIORITY_META: Record<ExecutionDecisionPriority, { colorClass: string; labelPl: string }> = {
  high: { colorClass: 'text-c-danger', labelPl: 'wysoki' },
  medium: { colorClass: 'text-c-warning', labelPl: 'średni' },
  low: { colorClass: 'text-c-text-muted', labelPl: 'niski' },
};

function fmtPct(pct: number | null): string {
  return pct === null ? '—' : `${Math.round(pct)}%`;
}

function fmtRatio(ratio: number | null): string {
  return ratio === null ? '—' : ratio.toFixed(2);
}

export const ExecutionLightShell: React.FC<ExecutionLightShellProps> = ({
  programName,
  periodLabel,
  status,
  program,
  initiatives = [],
  alerts = [],
  reports = [],
  decisions = [],
  topActions = [],
  lineageSources = [],
  lastUpdatedLabel,
  onOpenChat,
  onPublishSnapshot,
  onOpenInitiative,
  onOpenReport,
  onOpenDecision,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const t = (pl: string, en: string) => (isPolish ? pl : en);

  const [activeTab, setActiveTab] = useState<LightTab>('summary');

  const alertCounts = useMemo(() => {
    const counts: Record<ExecutionAlertSeverity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const a of alerts) counts[a.severity] += 1;
    return counts;
  }, [alerts]);

  const overdueDecisions = decisions.filter((d) => d.status === 'overdue').length;

  const TAB_LABEL: Record<LightTab, string> = {
    summary: t('Podsumowanie', 'Summary'),
    alerts: t('Alerty', 'Alerts'),
    reporting: t('Raportowanie', 'Reporting'),
    management: t('Zarządzanie', 'Management'),
  };
  const TAB_META: Record<LightTab, string> = {
    summary: `${program.initiativeCount} ${t('inicjatyw', 'initiatives')} · ${RAG_META[program.rag].labelPl}`,
    alerts: `${alertCounts.CRITICAL + alertCounts.HIGH} ${t('pilnych', 'urgent')}`,
    reporting: `${reports.length} ${t('raportów', 'reports')}`,
    management: `${overdueDecisions} ${t('po terminie', 'overdue')}`,
  };

  const statusLabel = (status || 'IN_REALIZATION').toUpperCase();
  const statusPill = isPolish
    ? statusLabel.includes('DONE') || statusLabel.includes('COMPLETE')
      ? 'Zamknięty'
      : statusLabel.includes('REALIZ')
        ? 'W realizacji'
        : 'Szkic'
    : statusLabel;

  return (
    <div className="flex h-full flex-col bg-c-bg text-c-text">
      {/* ─── Compact header strip ─── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-c-border bg-c-surface px-5 py-3">
        <span className="text-[12px] text-c-text-muted">
          {t('Realizacja', 'Execution')} <span className="mx-1 text-c-text-secondary">›</span> {TAB_LABEL[activeTab]}
        </span>
        <h1 className="m-0 text-[15px] font-semibold tracking-tight text-c-text">
          {programName || 'DBR77 Scale-Up'}
        </h1>
        <span className="rounded-full border border-c-border bg-c-surface-raised px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-c-text-secondary">
          {statusPill}
        </span>
        {periodLabel && (
          <span className="rounded-full border border-c-border bg-c-surface-raised px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-c-text-secondary">
            {periodLabel}
          </span>
        )}
        <span className="ml-1 flex items-center gap-1.5 text-[12px]">
          <span className="text-c-text-muted">{t('werdykt programu', 'program verdict')}</span>
          <span className={`flex items-center gap-1 font-semibold ${RAG_META[program.rag].colorClass}`}>
            {RAG_META[program.rag].icon}
            {RAG_META[program.rag].labelPl}
          </span>
        </span>

        <span className="flex-1" />

        {onOpenChat && (
          <button
            type="button"
            onClick={onOpenChat}
            className="inline-flex items-center gap-2 rounded-lg border border-transparent px-3 py-1.5 text-[13px] font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised"
          >
            <MessageSquare className="h-4 w-4" />
            {t('Zapytaj Teresę', 'Ask Teresa')}
          </button>
        )}
        <button
          type="button"
          onClick={onPublishSnapshot}
          disabled={!onPublishSnapshot}
          className="inline-flex items-center gap-2 rounded-lg bg-c-text px-3.5 py-1.5 text-[13px] font-semibold text-c-surface transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <FileText className="h-4 w-4" />
          {t('Publikuj snapshot', 'Publish snapshot')}
        </button>
      </div>

      {/* ─── 3-column work area ─── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[212px_1fr] lg:grid-cols-[212px_1fr_300px]">
        {/* NAV RAIL */}
        <nav className="hidden overflow-y-auto border-r border-c-border bg-c-surface px-3 py-4 md:block">
          <p className="mx-1.5 mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-c-text-muted">
            {t('Program', 'Program')}
          </p>
          <div className="flex flex-col gap-0.5">
            {(['summary', 'alerts', 'reporting', 'management'] as LightTab[]).map((tab) => {
              const on = tab === activeTab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors ${
                    on ? '' : 'hover:bg-c-surface-raised'
                  }`}
                  style={on ? { backgroundColor: BLUE_SOFT } : undefined}
                >
                  <span
                    className="grid h-[26px] w-[26px] flex-shrink-0 place-items-center rounded-full"
                    style={{ backgroundColor: 'var(--c-surface)', border: `1px solid ${on ? BLUE : 'var(--c-border)'}` }}
                  >
                    <span className="text-c-text-secondary" style={on ? { color: BLUE } : undefined}>
                      {TAB_ICON[tab]}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate text-[13px] leading-tight tracking-tight ${
                        on ? 'font-semibold' : 'text-c-text'
                      }`}
                      style={on ? { color: BLUE } : undefined}
                    >
                      {TAB_LABEL[tab]}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-c-text-muted tabular-nums">
                      {TAB_META[tab]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* CENTER */}
        <main className="min-w-0 overflow-y-auto px-6 py-5">
          {activeTab === 'summary' && (
            <SummaryTab program={program} initiatives={initiatives} onOpenInitiative={onOpenInitiative} t={t} />
          )}
          {activeTab === 'alerts' && <AlertsTab alerts={alerts} alertCounts={alertCounts} t={t} />}
          {activeTab === 'reporting' && <ReportingTab reports={reports} onOpenReport={onOpenReport} t={t} />}
          {activeTab === 'management' && (
            <ManagementTab
              decisions={decisions}
              topActions={topActions}
              onOpenDecision={onOpenDecision}
              t={t}
            />
          )}
        </main>

        {/* ASIDE */}
        <aside className="hidden overflow-y-auto border-l border-c-border bg-c-surface px-4 py-4 lg:block">
          <p className="mx-0.5 mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-c-text-muted">
            {t('Wsparcie', 'Support')}
          </p>

          <div className="mb-3 overflow-hidden rounded-xl border border-c-border">
            <div className="flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-semibold text-c-text">
              <FolderOpen className="h-[15px] w-[15px] text-c-text-muted" />
              {t('Metodyka i źródła', 'Methodology & sources')}
              <span
                className="ml-auto rounded-full px-1.5 py-px text-[10.5px] font-semibold"
                style={{ backgroundColor: BLUE_SOFT, color: BLUE }}
              >
                {lineageSources.length}
              </span>
            </div>
            <div className="flex flex-col gap-2.5 px-3.5 pb-3.5">
              {lineageSources.length === 0 && (
                <p className="m-0 text-[12.5px] leading-snug text-c-text-muted">
                  {t('Brak podpiętych źródeł.', 'No sources attached.')}
                </p>
              )}
              {lineageSources.map((src) => (
                <div key={src.label} className="flex items-start gap-2 text-[12.5px] leading-snug">
                  <Target className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-c-text-muted" />
                  <span>
                    <span className="font-semibold text-c-text">{src.label}</span>{' '}
                    <span className="text-c-text-secondary">{src.detail}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-3 overflow-hidden rounded-xl border border-c-border">
            <div className="flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-semibold text-c-text">
              <Clock className="h-[15px] w-[15px] text-c-text-muted" />
              {t('Aktywność', 'Activity')}
            </div>
            <div className="px-3.5 pb-3.5 text-[12.5px] leading-snug text-c-text-secondary">
              {lastUpdatedLabel || t('Zaktualizowano dziś.', 'Updated today.')}
            </div>
          </div>

          <div className="mt-2.5 border-t border-c-border pt-2.5 text-[11.5px] text-c-text-muted">
            {t(
              'Osie T/Z/W i SPI liczy silnik deterministycznie (threeAxisReportService) — czat tylko opisuje wynik, nie zmienia liczb.',
              'The T/Z/W axes and SPI are computed deterministically by the engine (threeAxisReportService) — chat only narrates the result, never changes the numbers.'
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-sections (kept in-file — presentational only, not reused elsewhere yet)
// ---------------------------------------------------------------------------

function AxisBar({ pct, color }: { pct: number | null; color: string }): React.ReactElement {
  return (
    <span className="h-1.5 w-full overflow-hidden rounded-full bg-c-surface-raised">
      <span
        className="block h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(100, pct ?? 0))}%`, backgroundColor: color }}
      />
    </span>
  );
}

function SummaryTab({
  program,
  initiatives,
  onOpenInitiative,
  t,
}: {
  program: ExecutionProgramSummaryLite;
  initiatives: ExecutionInitiativeRowLite[];
  onOpenInitiative?: (id: string) => void;
  t: (pl: string, en: string) => string;
}): React.ReactElement {
  return (
    <>
      <div className="mb-1 flex items-end justify-between gap-4">
        <div>
          <h2 className="m-0 text-[21px] font-semibold tracking-tight text-c-text">
            {t('Podsumowanie programu', 'Program summary')}
          </h2>
          <div className="mt-0.5 text-[12.5px] text-c-text-muted">
            {t(
              'Trzy osie: czas × zadania × wartość — wzorzec McKinsey',
              'Three axes: time × tasks × value — McKinsey pattern'
            )}
          </div>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="text-[20px] font-bold tracking-tight tabular-nums" style={{ color: BLUE }}>
              {fmtPct(program.T.pct)}
            </div>
            <div className="text-[10.5px] uppercase tracking-wide text-c-text-muted">{t('czas', 'time')}</div>
          </div>
          <div className="text-right">
            <div className="text-[20px] font-bold tracking-tight tabular-nums" style={{ color: BLUE }}>
              {fmtPct(program.Z.pct)}
            </div>
            <div className="text-[10.5px] uppercase tracking-wide text-c-text-muted">{t('zadania', 'tasks')}</div>
          </div>
          <div className="text-right">
            <div className="text-[20px] font-bold tracking-tight tabular-nums" style={{ color: BLUE }}>
              {fmtPct(program.W.pct)}
            </div>
            <div className="text-[10.5px] uppercase tracking-wide text-c-text-muted">{t('wartość', 'value')}</div>
          </div>
        </div>
      </div>

      {/* derived signals — the "postępy i problemy" the report exists for */}
      <div className="mt-3 overflow-hidden rounded-xl border border-c-border">
        <div className="grid grid-cols-3 divide-x divide-c-border">
          <div className="px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-c-text-muted">
              {t('zdrowie harmonogramu (SPI)', 'schedule health (SPI)')}
            </div>
            <div className={`mt-1 flex items-center gap-1.5 text-[15px] font-semibold tabular-nums ${RAG_META[program.scheduleHealth.rag].colorClass}`}>
              {RAG_META[program.scheduleHealth.rag].icon}
              {fmtRatio(program.scheduleHealth.ratio)}
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-c-text-muted">
              {t('luka wpływu (W/Z)', 'impact gap (W/Z)')}
            </div>
            <div className={`mt-1 flex items-center gap-1.5 text-[15px] font-semibold tabular-nums ${RAG_META[program.impactGap.rag].colorClass}`}>
              {RAG_META[program.impactGap.rag].icon}
              {fmtRatio(program.impactGap.ratio)}
            </div>
          </div>
          <div className="px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-c-text-muted">
              {t('obietnica dowozu (W/T)', 'delivery promise (W/T)')}
            </div>
            <div className={`mt-1 flex items-center gap-1.5 text-[15px] font-semibold tabular-nums ${RAG_META[program.deliveryPromise.rag].colorClass}`}>
              {RAG_META[program.deliveryPromise.rag].icon}
              {fmtRatio(program.deliveryPromise.ratio)}
            </div>
          </div>
        </div>
      </div>

      {/* engagement / on-time / people — one compact chip strip, not 4 big cards */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-lg border border-c-border bg-c-surface px-3.5 py-2.5 text-[12px] text-c-text-muted">
        <span className="flex items-center gap-1.5">
          <Gauge className="h-3.5 w-3.5" />
          {t('zaangażowanie', 'engagement')}:{' '}
          <span className="font-semibold text-c-text-secondary tabular-nums">{fmtPct(program.engagementPct)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {t('na czas', 'on-time')}:{' '}
          <span className="font-semibold text-c-text-secondary tabular-nums">{fmtPct(program.onTimePct)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {t('ludzie', 'people')}:{' '}
          <span className="font-semibold text-c-text-secondary tabular-nums">
            {program.peopleAssigned}/{program.peopleCapacity}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          {t('opóźnienia', 'overdue')}:{' '}
          <span className={`font-semibold tabular-nums ${program.overdueCount > 0 ? 'text-c-danger' : 'text-c-text-secondary'}`}>
            {program.overdueCount}
          </span>
        </span>
      </div>

      {/* per-initiative T/Z/W rows — REAL <StandardTable> (2026-07-12 rule #9) */}
      <div className="mt-5 mb-2.5 flex items-center justify-between">
        <h3 className="m-0 text-[13px] font-semibold uppercase tracking-[0.08em] text-c-text-muted">
          {t('Inicjatywy', 'Initiatives')}
        </h3>
        <span className="text-[11.5px] text-c-text-muted">{initiatives.length}</span>
      </div>
      <InitiativesTable initiatives={initiatives} onOpenInitiative={onOpenInitiative} t={t} />
    </>
  );
}

/** avg() over the available T/Z/W readings — the "Postęp %" blended figure;
 * derived deterministically from the same axis data the bars render, never
 * invented. null when no axis has data (mirrors AxisBar's null handling). */
function avgAxisPct(ini: ExecutionInitiativeRowLite): number | null {
  const vals = [ini.T.pct, ini.Z.pct, ini.W.pct].filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function InitiativesTable({
  initiatives,
  onOpenInitiative,
  t,
}: {
  initiatives: ExecutionInitiativeRowLite[];
  onOpenInitiative?: (id: string) => void;
  t: (pl: string, en: string) => string;
}): React.ReactElement {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const RAG_ORDER: ExecutionRag[] = ['GREEN', 'AMBER', 'RED', 'NA'];

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'name',
        label: t('Inicjatywa', 'Initiative'),
        sortable: true,
        filterable: true,
        render: (row: ExecutionInitiativeRowLite) => (
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-c-text">{row.name}</span>
            {row.ownerName && (
              <span className="block truncate text-[11px] text-c-text-muted">{row.ownerName}</span>
            )}
          </span>
        ),
      },
      {
        id: 'T',
        label: 'T',
        width: '110px',
        align: 'right',
        sortable: true,
        sortAccessor: (row: ExecutionInitiativeRowLite) => row.T.pct ?? -1,
        render: (row: ExecutionInitiativeRowLite) => (
          <span className="flex items-center justify-end gap-2">
            <span className="flex w-10 flex-shrink-0 overflow-hidden">
              <AxisBar pct={row.T.pct} color={BLUE} />
            </span>
            <span className="w-8 text-right text-[10.5px] tabular-nums text-c-text-muted">{fmtPct(row.T.pct)}</span>
          </span>
        ),
      },
      {
        id: 'Z',
        label: 'Z',
        width: '110px',
        align: 'right',
        sortable: true,
        sortAccessor: (row: ExecutionInitiativeRowLite) => row.Z.pct ?? -1,
        render: (row: ExecutionInitiativeRowLite) => (
          <span className="flex items-center justify-end gap-2">
            <span className="flex w-10 flex-shrink-0 overflow-hidden">
              <AxisBar pct={row.Z.pct} color={BLUE} />
            </span>
            <span className="w-8 text-right text-[10.5px] tabular-nums text-c-text-muted">{fmtPct(row.Z.pct)}</span>
          </span>
        ),
      },
      {
        id: 'W',
        label: 'W',
        width: '110px',
        align: 'right',
        sortable: true,
        sortAccessor: (row: ExecutionInitiativeRowLite) => row.W.pct ?? -1,
        render: (row: ExecutionInitiativeRowLite) => (
          <span className="flex items-center justify-end gap-2">
            <span className="flex w-10 flex-shrink-0 overflow-hidden">
              <AxisBar pct={row.W.pct} color={RAG_META[row.rag].barColor} />
            </span>
            <span className="w-8 text-right text-[10.5px] tabular-nums text-c-text-muted">{fmtPct(row.W.pct)}</span>
          </span>
        ),
      },
      {
        id: 'progress',
        label: t('Postęp %', 'Progress %'),
        width: '90px',
        align: 'right',
        sortable: true,
        sortAccessor: (row: ExecutionInitiativeRowLite) => avgAxisPct(row) ?? -1,
        render: (row: ExecutionInitiativeRowLite) => (
          <span className="text-[12px] font-semibold tabular-nums text-c-text">{fmtPct(avgAxisPct(row))}</span>
        ),
      },
      {
        id: 'rag',
        label: t('Status', 'Status'),
        width: '130px',
        sortable: true,
        filterable: true,
        filterOptions: RAG_ORDER.map((rag) => ({
          value: rag,
          label: RAG_META[rag].labelPl,
          color: rag === 'GREEN' ? 'bg-c-success' : rag === 'AMBER' ? 'bg-c-warning' : rag === 'RED' ? 'bg-c-danger' : 'bg-c-text-muted',
        })),
        render: (row: ExecutionInitiativeRowLite) => (
          <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-medium ${RAG_META[row.rag].colorClass}`}>
            <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: RAG_META[row.rag].barColor }} />
            {RAG_META[row.rag].labelPl}
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t]
  );

  const rowMenu = (row: TableRow): StandardRowMenu => ({
    primary: [
      {
        id: 'open',
        label: t('Otwórz', 'Open'),
        icon: Eye,
        onClick: onOpenInitiative ? () => onOpenInitiative(String(row.id)) : undefined,
        disabled: !onOpenInitiative,
      },
    ],
    universalHandlers: {
      preview: onOpenInitiative ? () => onOpenInitiative(String(row.id)) : undefined,
      previewNote: t('Podgląd z poziomu Initiatives', 'Preview from the Initiatives module'),
    },
  });

  return (
    <StandardTable
      columns={columns}
      data={initiatives}
      onRowClick={onOpenInitiative ? (row) => onOpenInitiative(String(row.id)) : undefined}
      onRowDoubleClick={onOpenInitiative ? (row) => onOpenInitiative(String(row.id)) : undefined}
      rowMenu={rowMenu}
      selection={{ selectedIds, onChange: setSelectedIds }}
      persistKey="execution-light.summary-initiatives"
      defaultSort={{ columnId: 'name', direction: 'asc' }}
      canvasClassName="p-0"
      empty={{
        title: t('Brak inicjatyw w tym programie', 'No initiatives in this program'),
      }}
    />
  );
}

function AlertsTab({
  alerts,
  alertCounts,
  t,
}: {
  alerts: ExecutionAlertLite[];
  alertCounts: Record<ExecutionAlertSeverity, number>;
  t: (pl: string, en: string) => string;
}): React.ReactElement {
  return (
    <>
      <div className="mb-1 flex items-end justify-between gap-4">
        <div>
          <h2 className="m-0 text-[21px] font-semibold tracking-tight text-c-text">
            {t('Alerty', 'Alerts')}
          </h2>
          <div className="mt-0.5 text-[12.5px] text-c-text-muted">
            {t(
              'Problemy i zagrożenia — priorytet deterministyczny, bez zgadywania AI',
              'Problems and risks — deterministic priority, no AI guessing'
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 text-[11.5px]">
          <span className="flex items-center gap-1 text-c-danger">
            <AlertTriangle className="h-3.5 w-3.5" /> {alertCounts.CRITICAL + alertCounts.HIGH}{' '}
            {t('pilne', 'urgent')}
          </span>
          <span className="flex items-center gap-1 text-c-warning">
            <AlertTriangle className="h-3.5 w-3.5" /> {alertCounts.MEDIUM} {t('średnie', 'medium')}
          </span>
          <span className="flex items-center gap-1 text-c-text-muted">
            <MinusCircle className="h-3.5 w-3.5" /> {alertCounts.LOW} {t('niskie', 'low')}
          </span>
        </div>
      </div>

      <div className="mt-4">
        <AlertsTable alerts={alerts} t={t} />
      </div>
    </>
  );
}

/** REAL <StandardTable> for the alerts list (2026-07-12 rule #9) — replaces
 * the previous hand-rolled `.map()` card list. */
function AlertsTable({
  alerts,
  t,
}: {
  alerts: ExecutionAlertLite[];
  t: (pl: string, en: string) => string;
}): React.ReactElement {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const SEVERITY_ORDER: ExecutionAlertSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const SEVERITY_DOT_CLASS: Record<ExecutionAlertSeverity, string> = {
    CRITICAL: 'bg-c-danger',
    HIGH: 'bg-c-danger',
    MEDIUM: 'bg-c-warning',
    LOW: 'bg-c-text-muted',
  };

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'title',
        label: t('Alert', 'Alert'),
        sortable: true,
        filterable: true,
        render: (row: ExecutionAlertLite) => (
          <span className="flex min-w-0 items-start gap-2">
            <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${SEVERITY_DOT_CLASS[row.severity]}`} />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-c-text">{row.title}</span>
              <span className="block truncate text-[11px] text-c-text-muted">{row.rationale}</span>
            </span>
          </span>
        ),
      },
      {
        id: 'initiativeName',
        label: t('Inicjatywa', 'Initiative'),
        width: '190px',
        sortable: true,
        filterable: true,
        render: (row: ExecutionAlertLite) => (
          <span className="truncate text-[11.5px] text-c-text-secondary">{row.initiativeName || '—'}</span>
        ),
      },
      {
        id: 'suggestedAction',
        label: t('Sugerowana akcja', 'Suggested action'),
        width: '220px',
        render: (row: ExecutionAlertLite) => (
          <span className="truncate text-[11.5px] text-c-text-secondary">{row.suggestedAction}</span>
        ),
      },
      {
        id: 'severity',
        label: t('Priorytet', 'Priority'),
        width: '120px',
        sortable: true,
        sortAccessor: (row: ExecutionAlertLite) => SEVERITY_ORDER.indexOf(row.severity),
        filterable: true,
        filterOptions: SEVERITY_ORDER.map((s) => ({
          value: s,
          label: SEVERITY_META[s].labelPl,
          color: SEVERITY_DOT_CLASS[s],
        })),
        render: (row: ExecutionAlertLite) => (
          <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-medium ${SEVERITY_META[row.severity].colorClass}`}>
            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${SEVERITY_DOT_CLASS[row.severity]}`} />
            {SEVERITY_META[row.severity].labelPl}
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t]
  );

  return (
    <StandardTable
      columns={columns}
      data={alerts}
      selection={{ selectedIds, onChange: setSelectedIds }}
      persistKey="execution-light.alerts"
      defaultSort={{ columnId: 'severity', direction: 'asc' }}
      canvasClassName="p-0"
      empty={{
        title: t('Brak aktywnych alertów', 'No active alerts'),
        description: t('Program bez sygnałów ryzyka.', 'Program has no risk signals.'),
      }}
    />
  );
}

function ReportingTab({
  reports,
  onOpenReport,
  t,
}: {
  reports: ExecutionReportLite[];
  onOpenReport?: (id: string) => void;
  t: (pl: string, en: string) => string;
}): React.ReactElement {
  return (
    <>
      <div className="mb-1 flex items-end justify-between gap-4">
        <div>
          <h2 className="m-0 text-[21px] font-semibold tracking-tight text-c-text">
            {t('Raportowanie', 'Reporting')}
          </h2>
          <div className="mt-0.5 text-[12.5px] text-c-text-muted">
            {t('Raporty dla różnych odbiorców — sponsor, zespół, zarząd', 'Reports for different audiences — sponsor, team, board')}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <ReportsTable reports={reports} onOpenReport={onOpenReport} t={t} />
      </div>
    </>
  );
}

/** REAL <StandardTable> for the report catalog list (2026-07-12 rule #9) —
 * replaces the previous hand-rolled `grid-cols-[...]` button list. */
function ReportsTable({
  reports,
  onOpenReport,
  t,
}: {
  reports: ExecutionReportLite[];
  onOpenReport?: (id: string) => void;
  t: (pl: string, en: string) => string;
}): React.ReactElement {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const RAG_ORDER: ExecutionReportRag[] = ['red', 'amber', 'green'];
  const RAG_DOT_CLASS: Record<ExecutionReportRag, string> = {
    green: 'bg-c-success',
    amber: 'bg-c-warning',
    red: 'bg-c-danger',
  };

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'title',
        label: t('Raport', 'Report'),
        sortable: true,
        filterable: true,
        render: (row: ExecutionReportLite) => (
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-c-text">{row.title}</span>
            {row.lastRefreshLabel && (
              <span className="block truncate text-[11px] text-c-text-muted">{row.lastRefreshLabel}</span>
            )}
          </span>
        ),
      },
      {
        id: 'audience',
        label: t('Odbiorca', 'Audience'),
        width: '170px',
        sortable: true,
        filterable: true,
        render: (row: ExecutionReportLite) => (
          <span className="truncate text-[11.5px] text-c-text-secondary">{row.audience}</span>
        ),
      },
      {
        id: 'cadence',
        label: t('Cykl', 'Cadence'),
        width: '130px',
        sortable: true,
        filterable: true,
        render: (row: ExecutionReportLite) => (
          <span className="truncate text-[11.5px] text-c-text-muted">{row.cadence}</span>
        ),
      },
      {
        id: 'rag',
        label: t('Status', 'Status'),
        width: '110px',
        sortable: true,
        sortAccessor: (row: ExecutionReportLite) => RAG_ORDER.indexOf(row.rag),
        filterable: true,
        filterOptions: RAG_ORDER.map((r) => ({
          value: r,
          label: REPORT_RAG_META[r].labelPl,
          color: RAG_DOT_CLASS[r],
        })),
        render: (row: ExecutionReportLite) => (
          <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-medium ${REPORT_RAG_META[row.rag].colorClass}`}>
            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${RAG_DOT_CLASS[row.rag]}`} />
            {REPORT_RAG_META[row.rag].labelPl}
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t]
  );

  const rowMenu = (row: TableRow): StandardRowMenu => ({
    primary: [
      {
        id: 'open',
        label: t('Otwórz', 'Open'),
        icon: Eye,
        onClick: onOpenReport ? () => onOpenReport(String(row.id)) : undefined,
        disabled: !onOpenReport,
      },
    ],
    universalHandlers: {
      preview: onOpenReport ? () => onOpenReport(String(row.id)) : undefined,
    },
  });

  return (
    <StandardTable
      columns={columns}
      data={reports}
      onRowClick={onOpenReport ? (row) => onOpenReport(String(row.id)) : undefined}
      onRowDoubleClick={onOpenReport ? (row) => onOpenReport(String(row.id)) : undefined}
      rowMenu={rowMenu}
      selection={{ selectedIds, onChange: setSelectedIds }}
      persistKey="execution-light.reports"
      defaultSort={{ columnId: 'title', direction: 'asc' }}
      canvasClassName="p-0"
      empty={{
        title: t('Brak zdefiniowanych raportów', 'No reports defined yet'),
      }}
    />
  );
}

function ManagementTab({
  decisions,
  topActions,
  onOpenDecision,
  t,
}: {
  decisions: ExecutionDecisionLite[];
  topActions: string[];
  onOpenDecision?: (id: string) => void;
  t: (pl: string, en: string) => string;
}): React.ReactElement {
  return (
    <>
      <div className="mb-1 flex items-end justify-between gap-4">
        <div>
          <h2 className="m-0 text-[21px] font-semibold tracking-tight text-c-text">
            {t('Zarządzanie', 'Management')}
          </h2>
          <div className="mt-0.5 text-[12.5px] text-c-text-muted">
            {t('Wsparcie decyzji na bazie zidentyfikowanych zagrożeń', 'Decision support based on identified risks')}
          </div>
        </div>
      </div>

      {topActions.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-xl border border-c-border">
          <div className="border-b border-c-border bg-c-surface-raised px-4 py-2.5 text-[12.5px] font-semibold text-c-text">
            {t('Priorytetowe działania', 'Top actions')}
          </div>
          <div className="flex flex-col">
            {topActions.map((action, idx) => (
              <div
                key={action}
                className={`flex items-center gap-2.5 px-4 py-2.5 text-[12.5px] text-c-text-secondary ${
                  idx > 0 ? 'border-t border-c-border' : ''
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-c-text-muted" />
                {action}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 mb-2.5 flex items-center justify-between">
        <h3 className="m-0 text-[13px] font-semibold uppercase tracking-[0.08em] text-c-text-muted">
          {t('Decyzje', 'Decisions')}
        </h3>
        <span className="text-[11.5px] text-c-text-muted">{decisions.length}</span>
      </div>
      <DecisionsTable decisions={decisions} onOpenDecision={onOpenDecision} t={t} />
    </>
  );
}

/** REAL <StandardTable> for the decisions list (2026-07-12 rule #9) —
 * replaces the previous hand-rolled `grid-cols-[...]` button list. */
function DecisionsTable({
  decisions,
  onOpenDecision,
  t,
}: {
  decisions: ExecutionDecisionLite[];
  onOpenDecision?: (id: string) => void;
  t: (pl: string, en: string) => string;
}): React.ReactElement {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const PRIORITY_ORDER: ExecutionDecisionPriority[] = ['high', 'medium', 'low'];
  const PRIORITY_DOT_CLASS: Record<ExecutionDecisionPriority, string> = {
    high: 'bg-c-danger',
    medium: 'bg-c-warning',
    low: 'bg-c-text-muted',
  };

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'title',
        label: t('Decyzja', 'Decision'),
        sortable: true,
        filterable: true,
        render: (row: ExecutionDecisionLite) => (
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-medium text-c-text">{row.title}</span>
            {row.linkedRiskTitle && (
              <span className="block truncate text-[11px] text-c-text-muted">
                {t('powiązane ryzyko', 'linked risk')}: {row.linkedRiskTitle}
              </span>
            )}
          </span>
        ),
      },
      {
        id: 'ownerName',
        label: t('Właściciel', 'Owner'),
        width: '140px',
        sortable: true,
        filterable: true,
        render: (row: ExecutionDecisionLite) => (
          <span className="truncate text-[11.5px] text-c-text-secondary">{row.ownerName || '—'}</span>
        ),
      },
      {
        id: 'dueLabel',
        label: t('Termin', 'Due'),
        width: '140px',
        align: 'right',
        sortable: true,
        render: (row: ExecutionDecisionLite) => (
          <span className={`text-[11.5px] ${row.status === 'overdue' ? 'font-semibold text-c-danger' : 'text-c-text-muted'}`}>
            {row.dueLabel || '—'}
          </span>
        ),
      },
      {
        id: 'priority',
        label: t('Priorytet', 'Priority'),
        width: '110px',
        sortable: true,
        sortAccessor: (row: ExecutionDecisionLite) => PRIORITY_ORDER.indexOf(row.priority),
        filterable: true,
        filterOptions: PRIORITY_ORDER.map((p) => ({
          value: p,
          label: PRIORITY_META[p].labelPl,
          color: PRIORITY_DOT_CLASS[p],
        })),
        render: (row: ExecutionDecisionLite) => (
          <span className={`inline-flex items-center gap-1.5 text-[11.5px] font-medium ${PRIORITY_META[row.priority].colorClass}`}>
            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${PRIORITY_DOT_CLASS[row.priority]}`} />
            {PRIORITY_META[row.priority].labelPl}
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t]
  );

  const rowMenu = (row: TableRow): StandardRowMenu => ({
    primary: [
      {
        id: 'open',
        label: t('Otwórz', 'Open'),
        icon: Eye,
        onClick: onOpenDecision ? () => onOpenDecision(String(row.id)) : undefined,
        disabled: !onOpenDecision,
      },
    ],
    universalHandlers: {
      preview: onOpenDecision ? () => onOpenDecision(String(row.id)) : undefined,
    },
  });

  return (
    <StandardTable
      columns={columns}
      data={decisions}
      onRowClick={onOpenDecision ? (row) => onOpenDecision(String(row.id)) : undefined}
      onRowDoubleClick={onOpenDecision ? (row) => onOpenDecision(String(row.id)) : undefined}
      rowMenu={rowMenu}
      selection={{ selectedIds, onChange: setSelectedIds }}
      persistKey="execution-light.decisions"
      defaultSort={{ columnId: 'priority', direction: 'asc' }}
      canvasClassName="p-0"
      empty={{
        title: t('Brak decyzji oczekujących', 'No pending decisions'),
      }}
    />
  );
}

export default ExecutionLightShell;
