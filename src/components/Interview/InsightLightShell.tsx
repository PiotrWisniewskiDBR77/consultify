/**
 * InsightLightShell — lightweight, dense redesign of the Insight artifact
 * surface (companion to `FinanceLightShell` / `DRDLightShell` — same
 * doctrine, same shell shape: `docs/ui-standards/DOKTRYNA_GESTOSCI.md`).
 *
 * NEW component; `InsightViewer.tsx` (the real N-mode artifact, V6 engine
 * `InterviewInsightService.generateInsight`) is untouched. Gated OFF by
 * default behind `insightLightFlag.ts` (`?ff_insightLight=1`) — real wiring
 * into the Insight route happens in a later step, only after Piotr signs off
 * on the harness screenshot (CLAUDE.md rule #7: no flag-flip as a first look).
 *
 * Composition mirrors FinanceLightShell / DRDLightShell:
 *   1. Compact header strip (breadcrumb · insight title · analysis-type chip
 *      · status pill · source-session chip · CTA). Owner note #54 (header →
 *      right panel): identity chips stay in the strip, but the DEEP metadata
 *      (tokens, generation time, review status, evidence coverage) lives in
 *      the right rail "Właściwości" block, not stacked in the header.
 *   2. Left rail: 5 sections — Tematy · Problemy i ryzyka · Szanse ·
 *      Sygnały · Mapa dowodów — the same five V6 engine outputs
 *      (`insight.themes/issues/opportunities/signals/evidenceMap`,
 *      `InsightViewer.tsx` INSIGHT_SECTIONS ids: themes / issues-risks /
 *      opportunities / signals / evidence-map).
 *   3. Center: real engine OUTPUT SHAPES rendered as McKinsey-grade cards —
 *      thesis (title + description) + evidence (refs/source count) + a
 *      single status badge (strength/severity/impact/type), never a wall of
 *      raw JSON. Owner note #57 (content quality): every card states a
 *      finding in one sentence, backed by evidence, not a bare label.
 *   4. Right rail: Właściwości (analysis type, sessions, tokens, generated)
 *      · Źródła (source interview sessions) · Pewność (confidence mix across
 *      all findings) — mirrors DRDLightShell's "Źródła i założenia" /
 *      "Aktywność" accordion-of-cards pattern.
 *
 * COLOR DOCTRINE (hard, identical to FinanceLightShell/DRDLightShell):
 *   - `c-accent` (Harvard Crimson) is reserved for critical semantics only —
 *     NOT used here. Active nav item / primary numbers = the blue focus
 *     token (`--c-focus-solid`). Strong/high/pass = `c-success`, moderate/
 *     medium/warning = `c-warning`, weak/low/hypothesis = `c-text-muted`,
 *     insufficient/contradicted/high-severity = `c-danger`. Primary CTA is
 *     neutral (`bg-c-text text-c-surface`).
 *   - All colors via c-* tokens (Tailwind classes or `var(--c-*)` /
 *     `rgb(var(--c-*-rgb) / a)`), never raw hex/slate/navy — both themes
 *     adapt. (InsightViewer.tsx itself still carries slate/navy/emerald kit
 *     debt — this NEW component does not inherit it.)
 *
 * This component is presentational only (props in, JSX out) — no store, no
 * API calls, no context — exactly like FinanceLightShell. Mock data for the
 * dev-render harness lives in `dev-render/screens/insight-light.tsx`, not
 * here (same split as `finance-light.tsx` vs `FinanceLightShell.tsx`).
 */
import {
  AlertCircle,
  AlertTriangle,
  Clock,
  FileText,
  FolderOpen,
  Gauge,
  Layers,
  Link2,
  ListChecks,
  Map as MapIcon,
  MessageSquare,
  Radio,
  ShieldAlert,
  Target,
  TrendingUp,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Types — lightweight mirrors of the V6 engine output shapes
// (InsightViewer.tsx: InsightTheme / InsightIssue / InsightOpportunity /
// InsightSignal / InsightEvidenceMapEntry). Kept local to the frontend bundle.
// ---------------------------------------------------------------------------

export type InsightConfidenceLite = 'high' | 'medium' | 'low' | 'insufficient' | 'contradicted';
export type InsightStatusLite = 'generating' | 'draft' | 'in_review' | 'published' | 'failed';

export interface InsightThemeLite {
  title: string;
  description: string;
  strength: 'strong' | 'moderate' | 'weak';
  confidence?: InsightConfidenceLite;
  evidenceCount: number;
  sourceLabel?: string;
}

export interface InsightIssueLite {
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  confidence?: InsightConfidenceLite;
  evidenceCount: number;
  sourceLabel?: string;
}

export interface InsightOpportunityLite {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence?: InsightConfidenceLite;
  evidenceCount: number;
  sourceLabel?: string;
}

export interface InsightSignalLite {
  title: string;
  description: string;
  type: 'tension' | 'gap' | 'contradiction' | 'emerging_pattern';
}

export interface InsightEvidenceMapEntryLite {
  questionText: string;
  answerSnippet: string;
  linkedThemes: string[];
  linkedIssues: string[];
}

export interface InsightPropertyLite {
  label: string;
  value: string;
}

export interface InsightSourceLite {
  label: string;
  detail: string;
}

interface InsightLightShellProps {
  insightTitle?: string;
  analysisTypeLabel?: string;
  status?: InsightStatusLite;
  sourceSessionCount?: number;
  themes?: InsightThemeLite[];
  issues?: InsightIssueLite[];
  opportunities?: InsightOpportunityLite[];
  signals?: InsightSignalLite[];
  evidenceMap?: InsightEvidenceMapEntryLite[];
  properties?: InsightPropertyLite[];
  sources?: InsightSourceLite[];
  lastUpdatedLabel?: string;
  onExportReport?: () => void;
  onOpenChat?: () => void;
}

type LightTab = 'themes' | 'issues' | 'opportunities' | 'signals' | 'evidence';

const BLUE = 'rgb(var(--c-focus-solid-rgb))';
const BLUE_SOFT = 'rgb(var(--c-focus-solid-rgb) / 0.10)';

const TAB_ICON: Record<LightTab, React.ReactNode> = {
  themes: <Layers className="h-[13px] w-[13px]" />,
  issues: <ShieldAlert className="h-[13px] w-[13px]" />,
  opportunities: <TrendingUp className="h-[13px] w-[13px]" />,
  signals: <Radio className="h-[13px] w-[13px]" />,
  evidence: <MapIcon className="h-[13px] w-[13px]" />,
};

const STATUS_META: Record<InsightStatusLite, { labelPl: string; labelEn: string; colorClass: string }> = {
  generating: { labelPl: 'Generowanie', labelEn: 'Generating', colorClass: 'text-c-info' },
  draft: { labelPl: 'Szkic AI', labelEn: 'AI draft', colorClass: 'text-c-text-secondary' },
  in_review: { labelPl: 'W przeglądzie', labelEn: 'In review', colorClass: 'text-c-warning' },
  published: { labelPl: 'Opublikowany', labelEn: 'Published', colorClass: 'text-c-success' },
  failed: { labelPl: 'Błąd', labelEn: 'Failed', colorClass: 'text-c-danger' },
};

const CONFIDENCE_META: Record<InsightConfidenceLite, { labelPl: string; labelEn: string; colorClass: string }> = {
  high: { labelPl: 'Wysoka pewność', labelEn: 'High confidence', colorClass: 'text-c-success' },
  medium: { labelPl: 'Średnia pewność', labelEn: 'Medium confidence', colorClass: 'text-c-warning' },
  low: { labelPl: 'Hipoteza', labelEn: 'Hypothesis', colorClass: 'text-c-text-muted' },
  insufficient: { labelPl: 'Niewystarczające dane', labelEn: 'Insufficient data', colorClass: 'text-c-danger' },
  contradicted: { labelPl: 'Sprzeczność', labelEn: 'Contradiction', colorClass: 'text-c-danger' },
};

function badgeClass(colorClass: string): string {
  return `inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${colorClass} bg-current/10`;
}

function EvidenceChip({ count, sourceLabel, t }: { count: number; sourceLabel?: string; t: (pl: string, en: string) => string }): React.ReactElement {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-c-border px-1.5 py-0.5 text-[10.5px] text-c-text-muted">
      <Link2 className="h-3 w-3" />
      {count} {t('dowodów', 'evidence')}
      {sourceLabel ? <span className="text-c-text-secondary">· {sourceLabel}</span> : null}
    </span>
  );
}

export const InsightLightShell: React.FC<InsightLightShellProps> = ({
  insightTitle,
  analysisTypeLabel,
  status = 'draft',
  sourceSessionCount = 0,
  themes = [],
  issues = [],
  opportunities = [],
  signals = [],
  evidenceMap = [],
  properties = [],
  sources = [],
  lastUpdatedLabel,
  onExportReport,
  onOpenChat,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const t = (pl: string, en: string) => (isPolish ? pl : en);

  const [activeTab, setActiveTab] = useState<LightTab>('themes');

  const confidenceMix = useMemo(() => {
    const all: (InsightConfidenceLite | undefined)[] = [
      ...themes.map((x) => x.confidence),
      ...issues.map((x) => x.confidence),
      ...opportunities.map((x) => x.confidence),
    ];
    const counts: Record<InsightConfidenceLite, number> = {
      high: 0,
      medium: 0,
      low: 0,
      insufficient: 0,
      contradicted: 0,
    };
    for (const c of all) if (c) counts[c] += 1;
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return { counts, total };
  }, [themes, issues, opportunities]);

  const TAB_LABEL: Record<LightTab, string> = {
    themes: t('Tematy', 'Themes'),
    issues: t('Problemy i ryzyka', 'Issues & risks'),
    opportunities: t('Szanse', 'Opportunities'),
    signals: t('Sygnały', 'Signals'),
    evidence: t('Mapa dowodów', 'Evidence map'),
  };
  const TAB_META: Record<LightTab, string> = {
    themes: `${themes.length} ${t('pozycji', 'items')}`,
    issues: `${issues.length} ${t('pozycji', 'items')}`,
    opportunities: `${opportunities.length} ${t('pozycji', 'items')}`,
    signals: `${signals.length} ${t('pozycji', 'items')}`,
    evidence: `${evidenceMap.length} ${t('wpisów', 'entries')}`,
  };

  const statusMeta = STATUS_META[status];

  return (
    <div className="flex h-full flex-col bg-c-bg text-c-text">
      {/* ─── Compact header strip ─── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-c-border bg-c-surface px-5 py-3">
        <span className="text-[12px] text-c-text-muted">
          Interview <span className="mx-1 text-c-text-secondary">›</span> Insight
        </span>
        <h1 className="m-0 text-[15px] font-semibold tracking-tight text-c-text">
          {insightTitle || t('Diagnoza cyfrowej gotowości — DBR77', 'Digital readiness diagnosis — DBR77')}
        </h1>
        {analysisTypeLabel && (
          <span className="rounded-full border border-c-border bg-c-surface-raised px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-c-text-secondary">
            {analysisTypeLabel}
          </span>
        )}
        <span className={`text-[12px] font-semibold ${statusMeta.colorClass}`}>
          {isPolish ? statusMeta.labelPl : statusMeta.labelEn}
        </span>
        <span className="flex items-center gap-1.5 text-[12px] text-c-text-muted">
          <Layers className="h-3.5 w-3.5" />
          {sourceSessionCount} {t('sesji źródłowych', 'source sessions')}
        </span>

        <span className="flex-1" />

        {onOpenChat && (
          <button
            type="button"
            onClick={onOpenChat}
            className="inline-flex items-center gap-2 rounded-lg border border-transparent px-3 py-1.5 text-[13px] font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised"
          >
            <MessageSquare className="h-4 w-4" />
            {t('Zapytaj', 'Ask')}
          </button>
        )}
        <button
          type="button"
          onClick={onExportReport}
          disabled={!onExportReport}
          className="inline-flex items-center gap-2 rounded-lg bg-c-text px-3.5 py-1.5 text-[13px] font-semibold text-c-surface transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <FileText className="h-4 w-4" />
          {t('Eksportuj insight', 'Export insight')}
        </button>
      </div>

      {/* ─── 3-column work area ─── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[212px_1fr] lg:grid-cols-[212px_1fr_300px]">
        {/* NAV RAIL */}
        <nav className="hidden overflow-y-auto border-r border-c-border bg-c-surface px-3 py-4 md:block">
          <p className="mx-1.5 mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-c-text-muted">
            {t('Sekcje analizy', 'Analysis sections')}
          </p>
          <div className="flex flex-col gap-0.5">
            {(['themes', 'issues', 'opportunities', 'signals', 'evidence'] as LightTab[]).map((tab) => {
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
          {activeTab === 'themes' && <ThemesTab themes={themes} t={t} />}
          {activeTab === 'issues' && <IssuesTab issues={issues} t={t} />}
          {activeTab === 'opportunities' && <OpportunitiesTab opportunities={opportunities} t={t} />}
          {activeTab === 'signals' && <SignalsTab signals={signals} t={t} />}
          {activeTab === 'evidence' && <EvidenceMapTab evidenceMap={evidenceMap} t={t} />}
        </main>

        {/* ASIDE */}
        <aside className="hidden overflow-y-auto border-l border-c-border bg-c-surface px-4 py-4 lg:block">
          <p className="mx-0.5 mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-c-text-muted">
            {t('Szczegóły', 'Details')}
          </p>

          {/* Właściwości */}
          <div className="mb-3 overflow-hidden rounded-xl border border-c-border">
            <div className="flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-semibold text-c-text">
              <ListChecks className="h-[15px] w-[15px] text-c-text-muted" />
              {t('Właściwości', 'Properties')}
            </div>
            <div className="flex flex-col gap-2 px-3.5 pb-3.5">
              {properties.length === 0 && (
                <p className="m-0 text-[12.5px] leading-snug text-c-text-muted">
                  {t('Brak dodatkowych właściwości.', 'No additional properties.')}
                </p>
              )}
              {properties.map((p) => (
                <div key={p.label} className="flex items-baseline justify-between gap-3 text-[12.5px]">
                  <span className="text-c-text-muted">{p.label}</span>
                  <span className="text-right font-medium tabular-nums text-c-text-secondary">{p.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Źródła */}
          <div className="mb-3 overflow-hidden rounded-xl border border-c-border">
            <div className="flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-semibold text-c-text">
              <FolderOpen className="h-[15px] w-[15px] text-c-text-muted" />
              {t('Źródła', 'Sources')}
              <span
                className="ml-auto rounded-full px-1.5 py-px text-[10.5px] font-semibold"
                style={{ backgroundColor: BLUE_SOFT, color: BLUE }}
              >
                {sources.length}
              </span>
            </div>
            <div className="flex flex-col gap-2.5 px-3.5 pb-3.5">
              {sources.length === 0 && (
                <p className="m-0 text-[12.5px] leading-snug text-c-text-muted">
                  {t('Brak podpiętych sesji źródłowych.', 'No source sessions attached.')}
                </p>
              )}
              {sources.map((src) => (
                <div key={src.label} className="flex items-start gap-2 text-[12.5px] leading-snug">
                  <FileText className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-c-text-muted" />
                  <span>
                    <span className="font-semibold text-c-text">{src.label}</span>{' '}
                    <span className="text-c-text-secondary">{src.detail}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Pewność */}
          <div className="mb-3 overflow-hidden rounded-xl border border-c-border">
            <div className="flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-semibold text-c-text">
              <Gauge className="h-[15px] w-[15px] text-c-text-muted" />
              {t('Pewność ustaleń', 'Confidence mix')}
            </div>
            <div className="flex flex-col gap-1.5 px-3.5 pb-3.5">
              {confidenceMix.total === 0 && (
                <p className="m-0 text-[12.5px] leading-snug text-c-text-muted">
                  {t('Brak ustaleń do oceny pewności.', 'No findings to assess confidence.')}
                </p>
              )}
              {(Object.keys(confidenceMix.counts) as InsightConfidenceLite[])
                .filter((k) => confidenceMix.counts[k] > 0)
                .map((k) => {
                  const meta = CONFIDENCE_META[k];
                  const pct = confidenceMix.total > 0 ? Math.round((confidenceMix.counts[k] / confidenceMix.total) * 100) : 0;
                  return (
                    <div key={k} className="flex items-center gap-2 text-[12px]">
                      <span className={`w-[112px] flex-shrink-0 font-medium ${meta.colorClass}`}>
                        {isPolish ? meta.labelPl : meta.labelEn}
                      </span>
                      <span className="h-[5px] flex-1 overflow-hidden rounded-full bg-c-surface-raised">
                        <span className={`block h-full rounded-full bg-current ${meta.colorClass}`} style={{ width: `${pct}%` }} />
                      </span>
                      <span className="w-6 text-right text-[11px] font-semibold tabular-nums text-c-text-muted">
                        {confidenceMix.counts[k]}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          <div className="mt-2.5 border-t border-c-border pt-2.5 text-[11.5px] text-c-text-muted">
            <Clock className="mr-1 inline h-3 w-3" />
            {lastUpdatedLabel || t('Zaktualizowano dziś.', 'Updated today.')}
          </div>
        </aside>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-sections (kept in-file — presentational only, not reused elsewhere yet)
// ---------------------------------------------------------------------------

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}): React.ReactElement {
  return (
    <div className="mb-1 flex items-end justify-between gap-4">
      <div>
        <h2 className="m-0 text-[21px] font-semibold tracking-tight text-c-text">{title}</h2>
        <div className="mt-0.5 text-[12.5px] text-c-text-muted">{subtitle}</div>
      </div>
    </div>
  );
}

function EmptyCard({ message }: { message: string }): React.ReactElement {
  return (
    <div className="col-span-full rounded-xl border border-dashed border-c-border px-4 py-6 text-center text-[12.5px] text-c-text-muted">
      {message}
    </div>
  );
}

function ThemesTab({
  themes,
  t,
}: {
  themes: InsightThemeLite[];
  t: (pl: string, en: string) => string;
}): React.ReactElement {
  const STRENGTH_META: Record<InsightThemeLite['strength'], { labelPl: string; labelEn: string; colorClass: string }> = {
    strong: { labelPl: 'Silny', labelEn: 'Strong', colorClass: 'text-c-success' },
    moderate: { labelPl: 'Umiarkowany', labelEn: 'Moderate', colorClass: 'text-c-warning' },
    weak: { labelPl: 'Słaby', labelEn: 'Weak', colorClass: 'text-c-text-muted' },
  };
  return (
    <>
      <SectionHeader
        title={t('Tematy', 'Themes')}
        subtitle={t('Powtarzające się wątki z rozmów, uszeregowane wg siły dowodów', 'Recurring interview threads, ranked by evidence strength')}
      />
      <div className="mt-4 flex flex-col gap-3">
        {themes.length === 0 && <EmptyCard message={t('Brak zidentyfikowanych tematów.', 'No themes identified yet.')} />}
        {themes.map((theme, idx) => {
          const strengthMeta = STRENGTH_META[theme.strength];
          const confMeta = theme.confidence ? CONFIDENCE_META[theme.confidence] : undefined;
          return (
            <div key={idx} className="rounded-xl border border-c-border bg-c-surface px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <span className="text-[14px] font-semibold text-c-text">{theme.title}</span>
                <span className="flex flex-shrink-0 items-center gap-1.5">
                  <span className={badgeClass(strengthMeta.colorClass)}>{t(strengthMeta.labelPl, strengthMeta.labelEn)}</span>
                  {confMeta && <span className={badgeClass(confMeta.colorClass)}>{t(confMeta.labelPl, confMeta.labelEn)}</span>}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-c-text-secondary">{theme.description}</p>
              <div className="mt-2.5">
                <EvidenceChip count={theme.evidenceCount} sourceLabel={theme.sourceLabel} t={t} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function IssuesTab({
  issues,
  t,
}: {
  issues: InsightIssueLite[];
  t: (pl: string, en: string) => string;
}): React.ReactElement {
  const SEVERITY_META: Record<InsightIssueLite['severity'], { labelPl: string; labelEn: string; colorClass: string; borderColor: string }> = {
    high: { labelPl: 'Wysoki', labelEn: 'High', colorClass: 'text-c-danger', borderColor: 'var(--c-danger)' },
    medium: { labelPl: 'Średni', labelEn: 'Medium', colorClass: 'text-c-warning', borderColor: 'var(--c-warning)' },
    low: { labelPl: 'Niski', labelEn: 'Low', colorClass: 'text-c-text-muted', borderColor: 'var(--c-border-strong)' },
  };
  return (
    <>
      <SectionHeader
        title={t('Problemy i ryzyka', 'Issues & risks')}
        subtitle={t('Ryzyka wskazane przez rozmówców, z priorytetem wg dotkliwości', 'Risks raised by respondents, prioritized by severity')}
      />
      <div className="mt-4 flex flex-col gap-3">
        {issues.length === 0 && <EmptyCard message={t('Brak zidentyfikowanych problemów.', 'No issues identified yet.')} />}
        {issues.map((issue, idx) => {
          const sev = SEVERITY_META[issue.severity];
          const confMeta = issue.confidence ? CONFIDENCE_META[issue.confidence] : undefined;
          return (
            <div
              key={idx}
              className="rounded-xl border border-c-border bg-c-surface px-4 py-3.5"
              style={{ borderLeft: `3px solid ${sev.borderColor}` }}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-[14px] font-semibold text-c-text">{issue.title}</span>
                <span className="flex flex-shrink-0 items-center gap-1.5">
                  <span className={badgeClass(sev.colorClass)}>{t(sev.labelPl, sev.labelEn)}</span>
                  {confMeta && <span className={badgeClass(confMeta.colorClass)}>{t(confMeta.labelPl, confMeta.labelEn)}</span>}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-c-text-secondary">{issue.description}</p>
              <div className="mt-2.5">
                <EvidenceChip count={issue.evidenceCount} sourceLabel={issue.sourceLabel} t={t} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function OpportunitiesTab({
  opportunities,
  t,
}: {
  opportunities: InsightOpportunityLite[];
  t: (pl: string, en: string) => string;
}): React.ReactElement {
  const IMPACT_META: Record<InsightOpportunityLite['impact'], { labelPl: string; labelEn: string; colorClass: string }> = {
    high: { labelPl: 'Wysoki wpływ', labelEn: 'High impact', colorClass: 'text-c-success' },
    medium: { labelPl: 'Średni wpływ', labelEn: 'Medium impact', colorClass: 'text-c-warning' },
    low: { labelPl: 'Niski wpływ', labelEn: 'Low impact', colorClass: 'text-c-text-muted' },
  };
  return (
    <>
      <SectionHeader
        title={t('Przestrzenie szans', 'Opportunity spaces')}
        subtitle={t('Kierunki wartości wskazane przez rozmowy, z szacunkiem wpływu', 'Value directions surfaced by interviews, with impact estimate')}
      />
      <div className="mt-4 flex flex-col gap-3">
        {opportunities.length === 0 && <EmptyCard message={t('Brak zidentyfikowanych szans.', 'No opportunities identified yet.')} />}
        {opportunities.map((opp, idx) => {
          const impactMeta = IMPACT_META[opp.impact];
          const confMeta = opp.confidence ? CONFIDENCE_META[opp.confidence] : undefined;
          return (
            <div key={idx} className="rounded-xl border border-c-border bg-c-surface px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <span className="text-[14px] font-semibold text-c-text">{opp.title}</span>
                <span className="flex flex-shrink-0 items-center gap-1.5">
                  <span className={badgeClass(impactMeta.colorClass)}>{t(impactMeta.labelPl, impactMeta.labelEn)}</span>
                  {confMeta && <span className={badgeClass(confMeta.colorClass)}>{t(confMeta.labelPl, confMeta.labelEn)}</span>}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-c-text-secondary">{opp.description}</p>
              <div className="mt-2.5">
                <EvidenceChip count={opp.evidenceCount} sourceLabel={opp.sourceLabel} t={t} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function SignalsTab({
  signals,
  t,
}: {
  signals: InsightSignalLite[];
  t: (pl: string, en: string) => string;
}): React.ReactElement {
  const TYPE_META: Record<InsightSignalLite['type'], { labelPl: string; labelEn: string; colorClass: string; icon: React.ReactNode }> = {
    tension: { labelPl: 'Napięcie', labelEn: 'Tension', colorClass: 'text-c-danger', icon: <AlertTriangle className="h-2.5 w-2.5" /> },
    gap: { labelPl: 'Luka', labelEn: 'Gap', colorClass: 'text-c-warning', icon: <Target className="h-2.5 w-2.5" /> },
    contradiction: { labelPl: 'Sprzeczność', labelEn: 'Contradiction', colorClass: 'text-c-info', icon: <AlertCircle className="h-2.5 w-2.5" /> },
    emerging_pattern: { labelPl: 'Wzorzec', labelEn: 'Emerging pattern', colorClass: 'text-c-focus', icon: <TrendingUp className="h-2.5 w-2.5" /> },
  };
  return (
    <>
      <SectionHeader
        title={t('Sygnały', 'Signals')}
        subtitle={t('Napięcia, luki i wzorce „między wierszami" wychwycone przez silnik', 'Tensions, gaps and "between the lines" patterns caught by the engine')}
      />
      <div className="mt-4 flex flex-col gap-3">
        {signals.length === 0 && <EmptyCard message={t('Brak wykrytych sygnałów.', 'No signals detected yet.')} />}
        {signals.map((signal, idx) => {
          const meta = TYPE_META[signal.type];
          return (
            <div key={idx} className="rounded-xl border border-c-border bg-c-surface px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <span className="text-[14px] font-semibold text-c-text">{signal.title}</span>
                <span className={badgeClass(meta.colorClass)}>
                  {meta.icon}
                  {t(meta.labelPl, meta.labelEn)}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-c-text-secondary">{signal.description}</p>
            </div>
          );
        })}
      </div>
    </>
  );
}

function EvidenceMapTab({
  evidenceMap,
  t,
}: {
  evidenceMap: InsightEvidenceMapEntryLite[];
  t: (pl: string, en: string) => string;
}): React.ReactElement {
  return (
    <>
      <SectionHeader
        title={t('Mapa dowodów', 'Evidence map')}
        subtitle={t('Odpowiedzi źródłowe powiązane z tematami i problemami', 'Source answers linked to themes and issues')}
      />
      <div className="mt-4 overflow-hidden rounded-xl border border-c-border">
        {evidenceMap.length === 0 && (
          <div className="px-4 py-6 text-center text-[12.5px] text-c-text-muted">
            {t('Brak mapy dowodów dla tej analizy.', 'No evidence map for this analysis.')}
          </div>
        )}
        {evidenceMap.map((entry, idx) => (
          <div
            key={idx}
            className={`grid grid-cols-[1fr_1fr_auto] items-start gap-4 px-4 py-3 ${idx > 0 ? 'border-t border-c-border' : ''}`}
          >
            <span className="text-[12.5px] font-medium text-c-text">{entry.questionText}</span>
            <span className="text-[12.5px] italic text-c-text-secondary">{entry.answerSnippet}</span>
            <span className="flex flex-wrap justify-end gap-1">
              {entry.linkedThemes.map((th) => (
                <span key={`th-${th}`} className={badgeClass('text-c-success')}>
                  {th}
                </span>
              ))}
              {entry.linkedIssues.map((is) => (
                <span key={`is-${is}`} className={badgeClass('text-c-danger')}>
                  {is}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

export default InsightLightShell;
