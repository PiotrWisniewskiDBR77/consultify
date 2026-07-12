/**
 * InitiativesLightShell — lightweight, dense redesign of the Initiatives
 * module surface (companion to `DRDLightShell` / `FinanceLightShell` — same
 * doctrine, same shell shape). NEW component; `InitiativesHub.tsx` is
 * untouched. Gated OFF by default behind `initiativesLightFlag.ts`
 * (`?ff_initiativesLight=1`) — real wiring into InitiativesHub happens in a
 * later step, only after Piotr signs off on the harness screenshot
 * (CLAUDE.md rule #7: no flag-flip as a first look).
 *
 * Composition mirrors FinanceLightShell / DRDLightShell:
 *   1. Compact header strip (breadcrumb · portfolio name · status summary
 *      chips · CTA "Nowa inicjatywa").
 *   2. Left rail: 3 sections — Lista · Kanban · Kręgosłup. Matches the real
 *      InitiativesHub surface (ModuleHub tabs: Portfolio/Analysis/
 *      Observability/Candidates/Portfolio Health, viewModes: table/kanban/
 *      timeline/grid) but collapsed to the 3 that a solo consultant actually
 *      needs day-to-day (doctryna gęstości §5: governance/analytics-heavy
 *      tabs stay optional, not on by default).
 *   3. Center:
 *      - Lista: the REAL `<StandardTable>` facade (import, not
 *        reimplementation) — Inicjatywa (priority dot + name/axis) · Status
 *        (leading status dot, TRIADA kanon) · Źródło (Idea Workspace/
 *        Assessment/Interview Insight/Audit Readout — mirrors
 *        `InitiativeSourceLink.tsx` labels) · Rezultaty (on-target ratio,
 *        text-right) · Budżet (text-right) — sort/filter header, kebab
 *        5-block contract, row-select → bulk (2026-07-12 fix: this tab used
 *        to hand-roll its own `grid` + `.map()` table, which broke the
 *        frozen TRIADA canon — see `scripts/check-list-canon.sh`).
 *      - Kanban: 5 lanes (Draft/Planning/Executing/Blocked/Done — condensed
 *        from `InitiativeStatus`, mirrors `PortfolioKanbanView.tsx` lane
 *        logic) with dense cards.
 *      - Kręgosłup: portfolio-wide ŹRÓDŁO→INICJATYWA→REZULTATY backbone,
 *        grouped by source type, one dense row per initiative (never a
 *        decorative diagram — doctryna gęstości §2).
 *   4. Right rail: backbone chain for the SELECTED initiative (source →
 *      initiative → results) + stakeholders (RACI chips, mirrors
 *      `StakeholdersSection.tsx` role model) + last-activity line — mirrors
 *      DRDLightShell's "Źródła i założenia" / "Aktywność" pattern.
 *
 * COLOR DOCTRINE (hard, identical to DRDLightShell/FinanceLightShell):
 *   - `c-accent` (Harvard Crimson) is reserved for critical semantics only —
 *     NOT used here. Active tab / primary numbers = the blue focus token
 *     (`--c-focus-solid`). Blocked = `c-danger`, on-target results =
 *     `c-success`, at-risk = `c-warning`, done = `c-success`, draft/skipped =
 *     muted text. Primary CTA is neutral (`bg-c-text text-c-surface`).
 *   - All colors via c-* tokens (Tailwind classes or `var(--c-*)` /
 *     `rgb(var(--c-*-rgb) / a)`), never raw hex — both themes adapt.
 *
 * This component is presentational only (props in, JSX out) — no store, no
 * API calls, no context — exactly like `FinanceLightShell`. Mock data for
 * the dev-render harness lives in `dev-render/screens/initiatives-light.tsx`,
 * not here (same split as `finance-light.tsx` vs `FinanceLightShell.tsx`).
 */
import {
  AlertTriangle,
  Clock,
  ClipboardList,
  Eye,
  FileText,
  FolderOpen,
  GitBranch,
  KanbanSquare,
  Lightbulb,
  List,
  MessageSquare,
  Plus,
  Target,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import StandardTable, {
  type StandardRowMenu,
  type TableColumn,
  type TableRow,
} from '../standard/StandardTable';

// ---------------------------------------------------------------------------
// Types — lightweight mirrors of the real engine/store shapes
// (types/core.ts PortfolioInitiative, InitiativeStatus, InitiativeSourceLink,
// StakeholdersSection RACI model). Kept local to the frontend bundle.
// ---------------------------------------------------------------------------

export type InitiativeSourceTypeLite = 'idea' | 'assessment' | 'interview' | 'audit';

export type InitiativeStatusLite = 'draft' | 'planning' | 'executing' | 'blocked' | 'done';

export type InitiativePriorityLite = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type StakeholderRoleLite = 'responsible' | 'accountable' | 'consulted' | 'informed';

export interface InitiativeResultLite {
  name: string;
  unit: string;
  current: number;
  target: number;
  onTarget: boolean;
}

export interface StakeholderLite {
  name: string;
  role: StakeholderRoleLite;
}

export interface PortfolioInitiativeLite {
  id: string;
  name: string;
  axis: string;
  status: InitiativeStatusLite;
  priority: InitiativePriorityLite;
  progress: number;
  sourceType: InitiativeSourceTypeLite;
  sourceLabel: string;
  ownerName: string;
  budget: number;
  expectedRoi?: number;
  results: InitiativeResultLite[];
  stakeholders: StakeholderLite[];
}

interface InitiativesLightShellProps {
  portfolioName?: string;
  currency?: string;
  initiatives: PortfolioInitiativeLite[];
  lastUpdatedLabel?: string;
  onCreateInitiative?: () => void;
  onOpenChat?: () => void;
  // #57-pattern follow-up — row click / kanban card / backbone row only ever
  // called `onSelect` (local highlight driving the aside "Źródło → rezultat"
  // panel), with no path to the REAL initiative artifact (tasks/comments/
  // KPIs). Optional so the component still renders standalone in the
  // dev-render harness without a handler. Single click keeps selecting (real
  // working feature — aside panel), double-click / kebab "Otwórz" open the
  // full record — mirrors ExecutionLightShell's `onOpenInitiative` contract.
  onOpenInitiative?: (id: string) => void;
}

type LightTab = 'list' | 'kanban' | 'backbone';

const BLUE = 'rgb(var(--c-focus-solid-rgb))';
const BLUE_SOFT = 'rgb(var(--c-focus-solid-rgb) / 0.10)';

const TAB_ICON: Record<LightTab, React.ReactNode> = {
  list: <List className="h-[13px] w-[13px]" />,
  kanban: <KanbanSquare className="h-[13px] w-[13px]" />,
  backbone: <GitBranch className="h-[13px] w-[13px]" />,
};

const KANBAN_COLUMNS: InitiativeStatusLite[] = ['draft', 'planning', 'executing', 'blocked', 'done'];

const SOURCE_ICON: Record<InitiativeSourceTypeLite, React.ReactNode> = {
  idea: <Lightbulb className="h-3.5 w-3.5 text-c-warning" />,
  assessment: <FileText className="h-3.5 w-3.5" style={{ color: BLUE }} />,
  interview: <ClipboardList className="h-3.5 w-3.5 text-c-success" />,
  audit: <FileText className="h-3.5 w-3.5 text-c-text-muted" />,
};

/** Short category label for the dense list row — the full descriptive
 * `sourceLabel` (e.g. "Digital Readiness — Oś 5 (Ludzie)") is reserved for
 * the aside/backbone tab so the list row keeps space for the initiative
 * name (doctryna gęstości §2: primary content, not the row's ellipsis). */
const SOURCE_SHORT_LABEL_PL: Record<InitiativeSourceTypeLite, string> = {
  idea: 'Workspace pomysłu',
  assessment: 'Ocena',
  interview: 'Wywiad',
  audit: 'Audyt',
};
const SOURCE_SHORT_LABEL_EN: Record<InitiativeSourceTypeLite, string> = {
  idea: 'Idea Workspace',
  assessment: 'Assessment',
  interview: 'Interview',
  audit: 'Audit',
};

const RACI_META: Record<StakeholderRoleLite, { label: string; abbr: string }> = {
  responsible: { label: 'Odpowiedzialny', abbr: 'R' },
  accountable: { label: 'Rozliczalny', abbr: 'A' },
  consulted: { label: 'Konsultowany', abbr: 'C' },
  informed: { label: 'Informowany', abbr: 'I' },
};

function formatCurrencyValue(value: number, currency: string): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M ${currency}`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}k ${currency}`;
  return `${sign}${abs.toFixed(0)} ${currency}`;
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
}

export const InitiativesLightShell: React.FC<InitiativesLightShellProps> = ({
  portfolioName,
  currency = 'PLN',
  initiatives,
  lastUpdatedLabel,
  onCreateInitiative,
  onOpenChat,
  onOpenInitiative,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const t = (pl: string, en: string) => (isPolish ? pl : en);

  const [activeTab, setActiveTab] = useState<LightTab>('list');
  const [selectedId, setSelectedId] = useState<string | null>(initiatives[0]?.id || null);

  const selected = useMemo(
    () => initiatives.find((i) => i.id === selectedId) || initiatives[0] || null,
    [initiatives, selectedId]
  );

  const byStatus = useMemo(() => {
    const map: Record<InitiativeStatusLite, PortfolioInitiativeLite[]> = {
      draft: [],
      planning: [],
      executing: [],
      blocked: [],
      done: [],
    };
    for (const i of initiatives) map[i.status].push(i);
    return map;
  }, [initiatives]);

  const bySource = useMemo(() => {
    const map: Record<InitiativeSourceTypeLite, PortfolioInitiativeLite[]> = {
      idea: [],
      assessment: [],
      interview: [],
      audit: [],
    };
    for (const i of initiatives) map[i.sourceType].push(i);
    return map;
  }, [initiatives]);

  const blockedCount = byStatus.blocked.length;
  const activeCount = byStatus.planning.length + byStatus.executing.length;

  const STATUS_LABEL_PL: Record<InitiativeStatusLite, string> = {
    draft: 'Szkic',
    planning: 'Planowanie',
    executing: 'Realizacja',
    blocked: 'Zablokowana',
    done: 'Zakończona',
  };
  const STATUS_LABEL_EN: Record<InitiativeStatusLite, string> = {
    draft: 'Draft',
    planning: 'Planning',
    executing: 'Executing',
    blocked: 'Blocked',
    done: 'Done',
  };
  const STATUS_LABEL = isPolish ? STATUS_LABEL_PL : STATUS_LABEL_EN;

  const STATUS_COLOR_CLASS: Record<InitiativeStatusLite, string> = {
    draft: 'text-c-text-muted',
    planning: '',
    executing: '',
    blocked: 'text-c-danger',
    done: 'text-c-success',
  };

  // Leading status dot (StandardTable column render) — same tone mapping as
  // STATUS_COLOR_CLASS above, but as a `bg-*` for the dot instead of `text-*`
  // for the label (TRIADA kanon: dot + neutral-toned label, mirrors
  // InitiativesHub.tsx `statusDotClass`).
  const STATUS_DOT_CLASS: Record<InitiativeStatusLite, string> = {
    draft: 'bg-c-text-muted',
    planning: '',
    executing: '',
    blocked: 'bg-c-danger',
    done: 'bg-c-success',
  };

  const PRIORITY_DOT_CLASS: Record<InitiativePriorityLite, string> = {
    CRITICAL: 'bg-c-danger',
    HIGH: 'bg-c-warning',
    MEDIUM: '',
    LOW: 'bg-c-text-muted',
  };

  const TAB_LABEL: Record<LightTab, string> = {
    list: t('Lista', 'List'),
    kanban: t('Kanban', 'Kanban'),
    backbone: t('Kręgosłup', 'Backbone'),
  };
  const TAB_META: Record<LightTab, string> = {
    list: `${initiatives.length} ${t('inicjatyw', 'initiatives')}`,
    kanban: `${activeCount} ${t('w toku', 'in flight')}`,
    backbone: `${Object.values(bySource).filter((g) => g.length > 0).length} ${t('źródła', 'sources')}`,
  };

  return (
    <div className="flex h-full flex-col bg-c-bg text-c-text">
      {/* ─── Compact header strip ─── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-c-border bg-c-surface px-5 py-3">
        <span className="text-[12px] text-c-text-muted">
          {t('Inicjatywy', 'Initiatives')} <span className="mx-1 text-c-text-secondary">›</span> {TAB_LABEL[activeTab]}
        </span>
        <h1 className="m-0 text-[15px] font-semibold tracking-tight text-c-text">
          {portfolioName || 'DBR77 — Portfolio inicjatyw'}
        </h1>
        <span className="rounded-full border border-c-border bg-c-surface-raised px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-c-text-secondary">
          {initiatives.length} {t('inicjatyw', 'initiatives')}
        </span>

        <span className="ml-1 flex items-center gap-3 text-[12px]">
          <span className="flex items-center gap-1.5">
            <span className="text-c-text-muted">{t('w toku', 'active')}</span>
            <span className="font-semibold tabular-nums" style={{ color: BLUE }}>
              {activeCount}
            </span>
          </span>
          {blockedCount > 0 && (
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-c-danger" />
              <span className="font-semibold tabular-nums text-c-danger">{blockedCount}</span>
              <span className="text-c-text-muted">{t('zablokowane', 'blocked')}</span>
            </span>
          )}
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
          onClick={onCreateInitiative}
          disabled={!onCreateInitiative}
          className="inline-flex items-center gap-2 rounded-lg bg-c-text px-3.5 py-1.5 text-[13px] font-semibold text-c-surface transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          {t('Nowa inicjatywa', 'New initiative')}
        </button>
      </div>

      {/* ─── 3-column work area ─── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[212px_1fr] lg:grid-cols-[212px_1fr_300px]">
        {/* NAV RAIL */}
        <nav className="hidden overflow-y-auto border-r border-c-border bg-c-surface px-3 py-4 md:block">
          <p className="mx-1.5 mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-c-text-muted">
            {t('Inicjatywy', 'Initiatives')}
          </p>
          <div className="flex flex-col gap-0.5">
            {(['list', 'kanban', 'backbone'] as LightTab[]).map((tab) => {
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
          {activeTab === 'list' && (
            <ListTab
              initiatives={initiatives}
              selectedId={selected?.id || null}
              onSelect={setSelectedId}
              onOpenInitiative={onOpenInitiative}
              currency={currency}
              statusLabel={STATUS_LABEL}
              statusColorClass={STATUS_COLOR_CLASS}
              statusDotClass={STATUS_DOT_CLASS}
              priorityDotClass={PRIORITY_DOT_CLASS}
              isPolish={isPolish}
              t={t}
            />
          )}
          {activeTab === 'kanban' && (
            <KanbanTab
              byStatus={byStatus}
              selectedId={selected?.id || null}
              onSelect={setSelectedId}
              onOpenInitiative={onOpenInitiative}
              statusLabel={STATUS_LABEL}
              priorityDotClass={PRIORITY_DOT_CLASS}
              t={t}
            />
          )}
          {activeTab === 'backbone' && (
            <BackboneTab
              bySource={bySource}
              selectedId={selected?.id || null}
              onSelect={setSelectedId}
              onOpenInitiative={onOpenInitiative}
              t={t}
            />
          )}
        </main>

        {/* ASIDE */}
        <aside className="hidden overflow-y-auto border-l border-c-border bg-c-surface px-4 py-4 lg:block">
          <p className="mx-0.5 mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-c-text-muted">
            {t('Wsparcie', 'Support')}
          </p>

          {selected ? (
            <>
              {/* ŹRÓDŁO → INICJATYWA → REZULTATY chain */}
              <div className="mb-3 overflow-hidden rounded-xl border border-c-border">
                <div className="flex items-center gap-2 border-b border-c-border px-3.5 py-3">
                  <FolderOpen className="h-[15px] w-[15px] text-c-text-muted" />
                  <span className="text-[12.5px] font-semibold text-c-text">
                    {t('Źródło → rezultat', 'Source → result')}
                  </span>
                </div>
                <div className="flex flex-col gap-2.5 px-3.5 py-3.5 text-[12.5px] leading-snug">
                  <div className="flex items-center gap-2">
                    {SOURCE_ICON[selected.sourceType]}
                    <span className="font-semibold text-c-text">{selected.sourceLabel}</span>
                  </div>
                  <div className="ml-1.5 h-3 border-l border-dashed border-c-border" />
                  <div className="flex items-center gap-2 truncate">
                    <Target className="h-3.5 w-3.5 flex-shrink-0" style={{ color: BLUE }} />
                    <span className="truncate font-semibold text-c-text">{selected.name}</span>
                  </div>
                  <div className="ml-1.5 h-3 border-l border-dashed border-c-border" />
                  <div className="flex flex-col gap-1.5">
                    {selected.results.length === 0 && (
                      <span className="text-c-text-muted">
                        {t('Brak zdefiniowanych rezultatów.', 'No results defined yet.')}
                      </span>
                    )}
                    {selected.results.map((r) => (
                      <div key={r.name} className="flex items-center justify-between gap-2">
                        <span className="truncate text-c-text-secondary">{r.name}</span>
                        <span
                          className={`flex-shrink-0 font-semibold tabular-nums ${
                            r.onTarget ? 'text-c-success' : 'text-c-warning'
                          }`}
                        >
                          {r.current}
                          {r.unit === '%' ? '%' : ` ${r.unit}`} / {r.target}
                          {r.unit === '%' ? '%' : ` ${r.unit}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Stakeholders (RACI) */}
              <div className="mb-3 overflow-hidden rounded-xl border border-c-border">
                <div className="flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-semibold text-c-text">
                  {t('Stakeholderzy', 'Stakeholders')}
                  <span
                    className="ml-auto rounded-full px-1.5 py-px text-[10.5px] font-semibold"
                    style={{ backgroundColor: BLUE_SOFT, color: BLUE }}
                  >
                    {selected.stakeholders.length}
                  </span>
                </div>
                <div className="flex flex-col gap-2 px-3.5 pb-3.5">
                  {selected.stakeholders.length === 0 && (
                    <p className="m-0 text-[12.5px] leading-snug text-c-text-muted">
                      {t('Brak przypisanych stakeholderów.', 'No stakeholders assigned.')}
                    </p>
                  )}
                  {selected.stakeholders.map((s) => (
                    <div key={`${s.name}-${s.role}`} className="flex items-center gap-2.5 text-[12.5px]">
                      <span
                        className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full text-[10px] font-bold text-c-surface"
                        style={{ backgroundColor: BLUE }}
                        title={RACI_META[s.role].label}
                      >
                        {RACI_META[s.role].abbr}
                      </span>
                      <span className="truncate text-c-text">{s.name}</span>
                      <span className="ml-auto flex-shrink-0 text-[11px] text-c-text-muted">
                        {RACI_META[s.role].label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-c-border px-4 py-6 text-center text-[12.5px] text-c-text-muted">
              {t('Wybierz inicjatywę, aby zobaczyć kręgosłup.', 'Select an initiative to see its backbone.')}
            </div>
          )}

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
              'Kręgosłup łączy źródło (Idea Workspace / Assessment / Interview / Audit) z inicjatywą i jej rezultatami — bez ręcznego wpisywania, silnik wiąże rekordy.',
              'The backbone links source (Idea Workspace / Assessment / Interview / Audit) to the initiative and its results — the engine binds records, nothing is typed by hand.'
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

/**
 * ListTab — the "Lista" view of the Initiatives light shell, rebuilt
 * (2026-07-12) to embed the REAL `<StandardTable>` facade instead of a
 * hand-rolled `grid` + `.map()` table (that regression broke the frozen
 * TRIADA canon — `scripts/check-list-canon.sh`). Columns match the previous
 * layout 1:1 (Inicjatywa · Status · Źródło · Rezultaty · Budżet), now
 * rendered through StandardTable's sort/filter header + kebab 5-block
 * contract + row-select → bulk (mirrors MaterialsLightShell/ToolsLightShell).
 */
function ListTab({
  initiatives,
  selectedId,
  onSelect,
  onOpenInitiative,
  currency,
  statusLabel,
  statusColorClass,
  statusDotClass,
  priorityDotClass,
  isPolish,
  t,
}: {
  initiatives: PortfolioInitiativeLite[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenInitiative?: (id: string) => void;
  currency: string;
  statusLabel: Record<InitiativeStatusLite, string>;
  statusColorClass: Record<InitiativeStatusLite, string>;
  statusDotClass: Record<InitiativeStatusLite, string>;
  priorityDotClass: Record<InitiativePriorityLite, string>;
  isPolish: boolean;
  t: (pl: string, en: string) => string;
}): React.ReactElement {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const STATUS_ORDER: InitiativeStatusLite[] = ['draft', 'planning', 'executing', 'blocked', 'done'];
  const PRIORITY_LABEL: Record<InitiativePriorityLite, string> = {
    CRITICAL: t('Krytyczny', 'Critical'),
    HIGH: t('Wysoki', 'High'),
    MEDIUM: t('Średni', 'Medium'),
    LOW: t('Niski', 'Low'),
  };

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'name',
        label: t('Inicjatywa', 'Initiative'),
        sortable: true,
        filterable: true,
        render: (row: PortfolioInitiativeLite) => (
          <span className="flex min-w-0 items-center gap-2">
            <span
              className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${priorityDotClass[row.priority]}`}
              style={row.priority === 'MEDIUM' ? { backgroundColor: BLUE } : undefined}
              title={PRIORITY_LABEL[row.priority]}
            />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-medium text-c-text">{row.name}</span>
              <span className="block truncate text-[11px] text-c-text-muted">{row.axis}</span>
            </span>
          </span>
        ),
      },
      {
        id: 'status',
        label: t('Status', 'Status'),
        width: '130px',
        sortable: true,
        filterable: true,
        filterOptions: STATUS_ORDER.map((s) => ({
          value: s,
          label: statusLabel[s],
          color: statusDotClass[s] || 'bg-c-focus-solid',
        })),
        render: (row: PortfolioInitiativeLite) => (
          <span
            className={`inline-flex items-center gap-1.5 text-[11.5px] font-medium ${statusColorClass[row.status]}`}
            style={row.status === 'planning' || row.status === 'executing' ? { color: BLUE } : undefined}
          >
            <span
              className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${statusDotClass[row.status]}`}
              style={row.status === 'planning' || row.status === 'executing' ? { backgroundColor: BLUE } : undefined}
            />
            {statusLabel[row.status]}
          </span>
        ),
      },
      {
        id: 'sourceType',
        label: t('Źródło', 'Source'),
        width: '140px',
        sortable: true,
        filterable: true,
        filterOptions: (Object.keys(SOURCE_SHORT_LABEL_EN) as InitiativeSourceTypeLite[]).map((s) => ({
          value: s,
          label: isPolish ? SOURCE_SHORT_LABEL_PL[s] : SOURCE_SHORT_LABEL_EN[s],
        })),
        render: (row: PortfolioInitiativeLite) => (
          <span className="flex items-center gap-1.5 truncate text-[11.5px] text-c-text-secondary" title={row.sourceLabel}>
            {SOURCE_ICON[row.sourceType]}
            <span className="truncate">{isPolish ? SOURCE_SHORT_LABEL_PL[row.sourceType] : SOURCE_SHORT_LABEL_EN[row.sourceType]}</span>
          </span>
        ),
      },
      {
        id: 'results',
        label: t('Rezultaty', 'Results'),
        width: '130px',
        align: 'right',
        sortAccessor: (row: PortfolioInitiativeLite) =>
          row.results.length === 0 ? -1 : row.results.filter((r) => r.onTarget).length / row.results.length,
        sortable: true,
        render: (row: PortfolioInitiativeLite) => {
          const onTarget = row.results.filter((r) => r.onTarget).length;
          return row.results.length === 0 ? (
            <span className="text-[11.5px] text-c-text-muted">{t('brak', 'none')}</span>
          ) : (
            <span
              className={`text-[11.5px] tabular-nums ${
                onTarget === row.results.length ? 'text-c-success' : 'text-c-warning'
              }`}
            >
              {onTarget}/{row.results.length} {t('na celu', 'on target')}
            </span>
          );
        },
      },
      {
        id: 'budget',
        label: t('Budżet', 'Budget'),
        width: '110px',
        align: 'right',
        sortable: true,
        sortAccessor: (row: PortfolioInitiativeLite) => row.budget,
        render: (row: PortfolioInitiativeLite) => (
          <span className="text-[11.5px] tabular-nums text-c-text-secondary">
            {formatCurrencyValue(row.budget, currency)}
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, isPolish, currency, priorityDotClass, statusColorClass, statusDotClass, statusLabel]
  );

  // Kebab "Otwórz" (MUST — same gap class as InterviewLightShell's Insighty
  // fix): previously called `onSelect` only, which just re-highlights the row
  // that's already selected by the click that opened the menu — no way to
  // reach the real initiative artifact. Routes through `onOpenInitiative`
  // (hub wires it to `handleOpenInitiativeDocument`, same activeDocumentId
  // mechanism as the rest of the hub); falls back to `onSelect` so the
  // standalone dev-render harness (no hub wiring) still does *something*.
  const rowMenu = (row: TableRow): StandardRowMenu => ({
    primary: [
      {
        id: 'open',
        label: t('Otwórz', 'Open'),
        icon: Eye,
        onClick: () => (onOpenInitiative ? onOpenInitiative(String(row.id)) : onSelect(String(row.id))),
      },
    ],
    universalHandlers: {
      preview: () => (onOpenInitiative ? onOpenInitiative(String(row.id)) : onSelect(String(row.id))),
      editNote: t('Edycja z poziomu pełnego widoku inicjatyw', 'Edit from the full Initiatives view'),
    },
  });

  return (
    <>
      <div className="mb-1 flex items-end justify-between gap-4">
        <div>
          <h2 className="m-0 text-[21px] font-semibold tracking-tight text-c-text">
            {t('Portfolio inicjatyw', 'Initiative portfolio')}
          </h2>
          <div className="mt-0.5 text-[12.5px] text-c-text-muted">
            {t('Status · źródło · rezultaty w jednym wierszu', 'Status · source · results in one row')}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <StandardTable
          columns={columns}
          data={initiatives}
          selectedRowId={selectedId}
          onRowClick={(row) => onSelect(String(row.id))}
          onRowDoubleClick={(row) =>
            onOpenInitiative ? onOpenInitiative(String(row.id)) : onSelect(String(row.id))
          }
          rowMenu={rowMenu}
          selection={{ selectedIds, onChange: setSelectedIds }}
          persistKey="initiatives-light.list"
          defaultSort={{ columnId: 'name', direction: 'asc' }}
          canvasClassName="p-0"
          empty={{
            title: t('Brak inicjatyw w portfolio', 'No initiatives in the portfolio'),
            description: t(
              'Utwórz pierwszą inicjatywę przyciskiem „Nowa inicjatywa" powyżej.',
              'Create the first initiative with the "New initiative" button above.'
            ),
          }}
        />
      </div>
    </>
  );
}

function KanbanTab({
  byStatus,
  selectedId,
  onSelect,
  onOpenInitiative,
  statusLabel,
  priorityDotClass,
  t,
}: {
  byStatus: Record<InitiativeStatusLite, PortfolioInitiativeLite[]>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenInitiative?: (id: string) => void;
  statusLabel: Record<InitiativeStatusLite, string>;
  priorityDotClass: Record<InitiativePriorityLite, string>;
  t: (pl: string, en: string) => string;
}): React.ReactElement {
  return (
    <>
      <div className="mb-1 flex items-end justify-between gap-4">
        <div>
          <h2 className="m-0 text-[21px] font-semibold tracking-tight text-c-text">
            {t('Kanban', 'Kanban')}
          </h2>
          <div className="mt-0.5 text-[12.5px] text-c-text-muted">
            {t('5 etapów cyklu życia inicjatywy', '5 stages of the initiative lifecycle')}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {KANBAN_COLUMNS.map((status) => {
          const items = byStatus[status];
          return (
            <div key={status} className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[11.5px] font-semibold uppercase tracking-wide text-c-text-muted">
                  {statusLabel[status]}
                </span>
                <span className="text-[11px] tabular-nums text-c-text-muted">{items.length}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {items.map((item) => {
                  const on = item.id === selectedId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelect(item.id)}
                      onDoubleClick={() => onOpenInitiative?.(item.id)}
                      title={onOpenInitiative ? t('Kliknij 2x, aby otworzyć', 'Double-click to open') : undefined}
                      className="rounded-lg border bg-c-surface px-3 py-2.5 text-left transition-colors hover:border-c-border-strong"
                      style={on ? { borderColor: BLUE, backgroundColor: BLUE_SOFT } : { borderColor: 'var(--c-border)' }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${priorityDotClass[item.priority]}`} style={item.priority === 'MEDIUM' ? { backgroundColor: BLUE } : undefined} />
                        <span className="truncate text-[12.5px] font-medium text-c-text">{item.name}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        {SOURCE_ICON[item.sourceType]}
                        <span className="h-[4px] flex-1 overflow-hidden rounded-full bg-c-surface-raised">
                          <span
                            className="block h-full rounded-full"
                            style={{ width: `${Math.round(item.progress)}%`, backgroundColor: BLUE }}
                          />
                        </span>
                        <span className="w-7 flex-shrink-0 text-right text-[10px] tabular-nums text-c-text-muted">
                          {Math.round(item.progress)}%
                        </span>
                      </div>
                    </button>
                  );
                })}
                {items.length === 0 && (
                  <div className="rounded-lg border border-dashed border-c-border px-3 py-4 text-center text-[11px] text-c-text-muted">
                    {t('puste', 'empty')}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function BackboneTab({
  bySource,
  selectedId,
  onSelect,
  onOpenInitiative,
  t,
}: {
  bySource: Record<InitiativeSourceTypeLite, PortfolioInitiativeLite[]>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenInitiative?: (id: string) => void;
  t: (pl: string, en: string) => string;
}): React.ReactElement {
  const SOURCE_LABEL: Record<InitiativeSourceTypeLite, string> = {
    idea: t('Workspace pomysłu', 'Idea Workspace'),
    assessment: t('Ocena', 'Assessment'),
    interview: t('Insight z wywiadu', 'Interview Insight'),
    audit: t('Readout audytu', 'Audit Readout'),
  };
  const SOURCE_ORDER: InitiativeSourceTypeLite[] = ['assessment', 'interview', 'audit', 'idea'];

  return (
    <>
      <div className="mb-1 flex items-end justify-between gap-4">
        <div>
          <h2 className="m-0 text-[21px] font-semibold tracking-tight text-c-text">
            {t('Kręgosłup ŹRÓDŁO → INICJATYWA → REZULTATY', 'Backbone SOURCE → INITIATIVE → RESULTS')}
          </h2>
          <div className="mt-0.5 text-[12.5px] text-c-text-muted">
            {t(
              'Każda inicjatywa ma pochodzenie i mierzalny rezultat — silnik wiąże, nie zgaduje',
              'Every initiative has a traceable origin and a measurable result — engine-bound, never guessed'
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {SOURCE_ORDER.map((source) => {
          const items = bySource[source];
          if (!items || items.length === 0) return null;
          return (
            <div key={source} className="overflow-hidden rounded-xl border border-c-border">
              <div className="flex items-center gap-2 border-b border-c-border bg-c-surface-raised px-4 py-2.5">
                {SOURCE_ICON[source]}
                <span className="text-[12.5px] font-semibold text-c-text">{SOURCE_LABEL[source]}</span>
                <span className="text-[11px] text-c-text-muted">{items.length}</span>
              </div>
              <div>
                {items.map((item, idx) => {
                  const onTarget = item.results.filter((r) => r.onTarget).length;
                  const on = item.id === selectedId;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelect(item.id)}
                      onDoubleClick={() => onOpenInitiative?.(item.id)}
                      title={onOpenInitiative ? t('Kliknij 2x, aby otworzyć', 'Double-click to open') : undefined}
                      className={`grid w-full grid-cols-[1fr_18px_1fr_18px_120px] items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        idx > 0 ? 'border-t border-c-border' : ''
                      } ${on ? '' : 'hover:bg-c-surface-raised'}`}
                      style={on ? { backgroundColor: BLUE_SOFT } : undefined}
                    >
                      <span className="truncate text-[12.5px] text-c-text-secondary">{item.sourceLabel}</span>
                      <span className="text-center text-c-text-muted">→</span>
                      <span className="truncate text-[13px] font-medium text-c-text">{item.name}</span>
                      <span className="text-center text-c-text-muted">→</span>
                      <span className="text-right text-[11.5px] tabular-nums">
                        {item.results.length === 0 ? (
                          <span className="text-c-text-muted">{t('brak rezultatów', 'no results')}</span>
                        ) : (
                          <span className={onTarget === item.results.length ? 'text-c-success' : 'text-c-warning'}>
                            {onTarget}/{item.results.length} {t('na celu', 'on target')}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {Object.values(bySource).every((g) => g.length === 0) && (
          <div className="rounded-xl border border-dashed border-c-border px-4 py-6 text-center text-[12.5px] text-c-text-muted">
            {t('Brak inicjatyw ze śledzonym źródłem.', 'No initiatives with a tracked source.')}
          </div>
        )}
      </div>
    </>
  );
}

export default InitiativesLightShell;
