/**
 * ToolsLightShell — lightweight, dense redesign of the Discovery Tools
 * module surface (companion to `FinanceLightShell` / `MaterialsLightShell` /
 * `DRDLightShell` — same doctrine, same shell shape). NEW component;
 * `DiscoveryToolsHub.tsx` (the real hub, 4777 lines, Library/Sessions/
 * Reports+Initiatives) is untouched. Gated OFF by default behind
 * `toolsLightFlag.ts` (`?ff_toolsLight=1`) — real wiring into the hub
 * happens in a later step, only after Piotr signs off on the harness
 * screenshot (CLAUDE.md rule #7: no flag-flip as a first look).
 *
 * Composition mirrors MaterialsLightShell / FinanceLightShell:
 *   1. Compact header strip (breadcrumb · library title · count chip · CTA).
 *   2. Left rail: 3 sections — Biblioteka · Sesje · Raporty (owner audit
 *      #61/#63: kebab/tabele on the TRIADA kanon; the real hub's fourth
 *      "Initiatives" surface folds into Raporty here — one dataset, one
 *      view, per DOKTRYNA_GESTOSCI §4 "zero dwóch zakładek na ten sam
 *      dataset": initiatives are just one `outputType` among the tool
 *      engine's standard outputs, `CONSULTING_TOOL_STANDARD_OUTPUTS`
 *      (initiative/report/presentation/idea) — not a separate hub).
 *   3. Center: the REAL `<StandardTable>` facade (import, not
 *      reimplementation) — one dense list per active section, TRIADA kanon
 *      (sort/filter header, kebab 5-block contract, row-select → bulk).
 *      Library carries the "Autor" column (owner note #69, already shipped
 *      in the real hub — mirrored here for shell parity).
 *   4. Right rail: session progress strip + deepening-ladder card (the
 *      4-rung "insight staircase" — surface → evidence → quantification →
 *      risk-capability, `deepeningLadder.ts` pattern shared by all 22
 *      frameworks) + sources card (mirrors DRDLightShell's "Źródła i
 *      założenia" / FinanceLightShell's "Pochodzenie" pattern) on the
 *      Sesje tab; category / output-type breakdown on Biblioteka / Raporty
 *      (mirrors MaterialsLightShell's `rightRailBreakdown`).
 *
 * COLOR DOCTRINE (hard, identical to Finance/Materials/DRD light shells):
 *   - `c-accent` (Harvard Crimson) is reserved for critical semantics only —
 *     NOT used here. Active nav item / primary CTA accent = the blue focus
 *     token (`--c-focus-solid`). Status tones: success = `c-success`,
 *     warning = `c-warning`, danger = `c-danger`, neutral/draft = muted text.
 *     Primary CTA is neutral (`bg-c-text text-c-surface`).
 *   - All colors via c-* tokens (Tailwind classes or `var(--c-*)` /
 *     `rgb(var(--c-*-rgb) / a)`), never raw hex — both themes adapt.
 *
 * This component is presentational only (props in, JSX out) — no store, no
 * API calls, no context — exactly like `EvBasketFootballField`. Mock data
 * for the dev-render harness lives in `dev-render/screens/tools-light.tsx`,
 * not here (same split as `materials-light.tsx` vs `MaterialsLightShell.tsx`).
 */
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  FileText,
  FolderOpen,
  Layers,
  Lightbulb,
  ListChecks,
  Lock,
  MessageSquare,
  Plus,
  Presentation,
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
// Types — lightweight mirrors of the real engine output shapes
// (`consultingToolsStandard.ts`: CONSULTING_TOOL_LIFECYCLE / CONSULTING_TOOL_
// STANDARD_OUTPUTS, `deepeningLadder.ts`: the 4-rung insight staircase shared
// by all frameworks). Kept local to this file so the light shell has zero
// coupling to the hub's data hooks — presentational-only, like its Finance/
// Materials/DRD siblings.
// ---------------------------------------------------------------------------

export type ToolsLightTab = 'library' | 'sessions' | 'reports';

export type ToolFrameworkCategory = 'Strategy' | 'Operations' | 'Digital' | 'Process Automation' | 'Licensed';

export interface ToolFrameworkLite {
  id: string;
  name: string;
  category: ToolFrameworkCategory;
  author: string;
  sessionsCount: number;
  ladderRungs: 1 | 2 | 3 | 4;
  status: 'available' | 'coming_soon';
}

export type ToolSessionStatus = 'draft' | 'in_progress' | 'deepening' | 'synthesis' | 'completed';

/** The 4-rung "insight staircase" (`deepeningLadder.ts`), shared shape across all 22 frameworks. */
export type LadderRungId = 'surface' | 'evidence' | 'quantification' | 'risk-capability';

export const LADDER_RUNG_ORDER: LadderRungId[] = ['surface', 'evidence', 'quantification', 'risk-capability'];

export interface ToolSourceLite {
  label: string;
  detail: string;
}

export interface ToolSessionLite {
  id: string;
  title: string;
  frameworkName: string;
  status: ToolSessionStatus;
  ladderDepth: 0 | 1 | 2 | 3 | 4;
  owner: string;
  updatedAt: string;
  outputsCount: number;
  sources: ToolSourceLite[];
}

export type ToolOutputType = 'initiative' | 'report' | 'presentation' | 'idea';

export interface ToolOutputLite {
  id: string;
  title: string;
  outputType: ToolOutputType;
  sourceSessionTitle: string;
  frameworkName: string;
  status: 'draft' | 'generated' | 'exported' | 'linked';
  owner: string;
  updatedAt: string;
}

interface ToolsLightShellProps {
  libraryName?: string;
  frameworks?: ToolFrameworkLite[];
  sessions?: ToolSessionLite[];
  outputs?: ToolOutputLite[];
  lastUpdatedLabel?: string;
  onNewSession?: () => void;
  onOpenChat?: () => void;
  onOpenFramework?: (id: string) => void;
  onOpenSession?: (id: string) => void;
  onOpenOutput?: (id: string) => void;
}

const BLUE = 'rgb(var(--c-focus-solid-rgb))';
const BLUE_SOFT = 'rgb(var(--c-focus-solid-rgb) / 0.10)';

const TAB_ICON: Record<ToolsLightTab, React.ReactNode> = {
  library: <BookOpen className="h-[13px] w-[13px]" />,
  sessions: <ListChecks className="h-[13px] w-[13px]" />,
  reports: <FileText className="h-[13px] w-[13px]" />,
};

const CATEGORY_LABEL: Record<ToolFrameworkCategory, { pl: string; en: string }> = {
  Strategy: { pl: 'Strategia', en: 'Strategy' },
  Operations: { pl: 'Operacje', en: 'Operations' },
  Digital: { pl: 'Cyfryzacja', en: 'Digital' },
  'Process Automation': { pl: 'Automatyzacja procesów', en: 'Process automation' },
  Licensed: { pl: 'Licencjonowane', en: 'Licensed' },
};

const SESSION_STATUS_META: Record<
  ToolSessionStatus,
  { labelPl: string; labelEn: string; className: string }
> = {
  draft: { labelPl: 'Szkic', labelEn: 'Draft', className: 'text-c-text-muted border-c-border' },
  in_progress: { labelPl: 'W toku', labelEn: 'In progress', className: 'text-c-focus-solid border-c-focus-solid/30' },
  deepening: { labelPl: 'Pogłębianie', labelEn: 'Deepening', className: 'text-c-warning border-c-warning/30' },
  synthesis: { labelPl: 'Synteza', labelEn: 'Synthesis', className: 'text-c-focus-solid border-c-focus-solid/30' },
  completed: { labelPl: 'Zakończona', labelEn: 'Completed', className: 'text-c-success border-c-success/30' },
};

const OUTPUT_STATUS_META: Record<
  ToolOutputLite['status'],
  { labelPl: string; labelEn: string; className: string }
> = {
  draft: { labelPl: 'Szkic', labelEn: 'Draft', className: 'text-c-text-muted border-c-border' },
  generated: { labelPl: 'Wygenerowany', labelEn: 'Generated', className: 'text-c-focus-solid border-c-focus-solid/30' },
  exported: { labelPl: 'Wyeksportowany', labelEn: 'Exported', className: 'text-c-focus-solid border-c-focus-solid/30' },
  linked: { labelPl: 'Powiązany', labelEn: 'Linked', className: 'text-c-success border-c-success/30' },
};

const OUTPUT_TYPE_META: Record<ToolOutputType, { labelPl: string; labelEn: string; icon: React.ElementType }> = {
  initiative: { labelPl: 'Inicjatywa', labelEn: 'Initiative', icon: Target },
  report: { labelPl: 'Raport', labelEn: 'Report', icon: FileText },
  presentation: { labelPl: 'Prezentacja', labelEn: 'Presentation', icon: Presentation },
  idea: { labelPl: 'Pomysł', labelEn: 'Idea', icon: Lightbulb },
};

const LADDER_RUNG_LABEL: Record<LadderRungId, { pl: string; en: string }> = {
  surface: { pl: 'Powierzchnia', en: 'Surface' },
  evidence: { pl: 'Dowody', en: 'Evidence' },
  quantification: { pl: 'Kwantyfikacja', en: 'Quantification' },
  'risk-capability': { pl: 'Ryzyko i zdolność', en: 'Risk & capability' },
};

function StatusPill({
  meta,
  isPolish,
}: {
  meta: { labelPl: string; labelEn: string; className: string };
  isPolish: boolean;
}): React.ReactElement {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
      {isPolish ? meta.labelPl : meta.labelEn}
    </span>
  );
}

export const ToolsLightShell: React.FC<ToolsLightShellProps> = ({
  libraryName,
  frameworks = [],
  sessions = [],
  outputs = [],
  lastUpdatedLabel,
  onNewSession,
  onOpenChat,
  onOpenFramework,
  onOpenSession,
  onOpenOutput,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const t = (pl: string, en: string) => (isPolish ? pl : en);

  const [activeTab, setActiveTab] = useState<ToolsLightTab>('library');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Sesje tab keeps its own "which session feeds the right rail" pointer,
  // defaulting to the most recently updated session so the panel is never
  // empty (DOKTRYNA_GESTOSCI §2: "żaden panel < 50% wypełnienia").
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(() => sessions[0]?.id ?? null);

  const TAB_LABEL: Record<ToolsLightTab, string> = {
    library: t('Biblioteka', 'Library'),
    sessions: t('Sesje', 'Sessions'),
    reports: t('Raporty', 'Reports'),
  };
  const TAB_COUNT: Record<ToolsLightTab, number> = {
    library: frameworks.length,
    sessions: sessions.length,
    reports: outputs.length,
  };

  const handleTabChange = (tab: ToolsLightTab) => {
    setActiveTab(tab);
    setSelectedRowId(null);
    setSelectedIds(new Set());
  };

  // ── Columns per section ────────────────────────────────────────────────
  const libraryColumns: TableColumn[] = useMemo(
    () => [
      { id: 'name', label: t('Nazwa', 'Name'), sortable: true, filterable: true },
      {
        id: 'category',
        label: t('Kategoria', 'Category'),
        sortable: true,
        filterable: true,
        filterOptions: (Object.keys(CATEGORY_LABEL) as ToolFrameworkCategory[]).map((c) => ({
          value: c,
          label: isPolish ? CATEGORY_LABEL[c].pl : CATEGORY_LABEL[c].en,
        })),
        render: (row: ToolFrameworkLite) => (
          <span className="text-c-text-secondary">
            {isPolish ? CATEGORY_LABEL[row.category].pl : CATEGORY_LABEL[row.category].en}
          </span>
        ),
      },
      { id: 'author', label: t('Autor', 'Author'), sortable: true, filterable: true },
      {
        id: 'ladderRungs',
        label: t('Drabinka', 'Ladder'),
        align: 'right',
        sortable: true,
        render: (row: ToolFrameworkLite) => (
          <span className="font-mono tabular-nums text-c-text-secondary">{row.ladderRungs}/4</span>
        ),
      },
      {
        id: 'sessionsCount',
        label: t('Sesje', 'Sessions'),
        align: 'right',
        sortable: true,
        render: (row: ToolFrameworkLite) => (
          <span className="font-mono tabular-nums text-c-text-secondary">{row.sessionsCount}</span>
        ),
      },
      {
        id: 'status',
        label: t('Status', 'Status'),
        sortable: true,
        filterable: true,
        filterOptions: [
          { value: 'available', label: t('Dostępne', 'Available') },
          { value: 'coming_soon', label: t('Wkrótce', 'Coming soon') },
        ],
        render: (row: ToolFrameworkLite) => (
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${
              row.status === 'available' ? 'text-c-success border-c-success/30' : 'text-c-text-muted border-c-border'
            }`}
          >
            {row.status === 'available' ? t('Dostępne', 'Available') : t('Wkrótce', 'Coming soon')}
          </span>
        ),
      },
    ],
    [isPolish, t]
  );

  const sessionColumns: TableColumn[] = useMemo(
    () => [
      { id: 'title', label: t('Tytuł', 'Title'), sortable: true, filterable: true },
      { id: 'frameworkName', label: t('Narzędzie', 'Framework'), sortable: true, filterable: true },
      {
        id: 'status',
        label: t('Status', 'Status'),
        sortable: true,
        filterable: true,
        filterOptions: (Object.keys(SESSION_STATUS_META) as ToolSessionStatus[]).map((s) => ({
          value: s,
          label: isPolish ? SESSION_STATUS_META[s].labelPl : SESSION_STATUS_META[s].labelEn,
        })),
        render: (row: ToolSessionLite) => <StatusPill meta={SESSION_STATUS_META[row.status]} isPolish={isPolish} />,
      },
      {
        id: 'ladderDepth',
        label: t('Drabinka', 'Ladder'),
        sortable: true,
        render: (row: ToolSessionLite) => (
          <span className="flex items-center gap-2">
            <span className="h-[5px] w-14 overflow-hidden rounded-full bg-c-surface-raised">
              <span
                className="block h-full rounded-full"
                style={{ width: `${(row.ladderDepth / 4) * 100}%`, backgroundColor: BLUE }}
              />
            </span>
            <span className="font-mono text-[11px] font-semibold tabular-nums text-c-text-muted">
              {row.ladderDepth}/4
            </span>
          </span>
        ),
      },
      { id: 'owner', label: t('Właściciel', 'Owner'), sortable: true, filterable: true },
      { id: 'updatedAt', label: t('Aktualizacja', 'Updated'), sortable: true },
    ],
    [isPolish, t]
  );

  const reportColumns: TableColumn[] = useMemo(
    () => [
      { id: 'title', label: t('Tytuł', 'Title'), sortable: true, filterable: true },
      {
        id: 'outputType',
        label: t('Typ', 'Type'),
        sortable: true,
        filterable: true,
        filterOptions: (Object.keys(OUTPUT_TYPE_META) as ToolOutputType[]).map((o) => ({
          value: o,
          label: isPolish ? OUTPUT_TYPE_META[o].labelPl : OUTPUT_TYPE_META[o].labelEn,
        })),
        render: (row: ToolOutputLite) => {
          const meta = OUTPUT_TYPE_META[row.outputType];
          const Icon = meta.icon;
          return (
            <span className="inline-flex items-center gap-1.5 text-c-text-secondary">
              <Icon className="h-3.5 w-3.5 text-c-text-muted" />
              {isPolish ? meta.labelPl : meta.labelEn}
            </span>
          );
        },
      },
      { id: 'sourceSessionTitle', label: t('Sesja źródłowa', 'Source session'), filterable: true },
      { id: 'frameworkName', label: t('Narzędzie', 'Framework'), sortable: true, filterable: true },
      {
        id: 'status',
        label: t('Status', 'Status'),
        sortable: true,
        filterable: true,
        filterOptions: (Object.keys(OUTPUT_STATUS_META) as ToolOutputLite['status'][]).map((s) => ({
          value: s,
          label: isPolish ? OUTPUT_STATUS_META[s].labelPl : OUTPUT_STATUS_META[s].labelEn,
        })),
        render: (row: ToolOutputLite) => <StatusPill meta={OUTPUT_STATUS_META[row.status]} isPolish={isPolish} />,
      },
      { id: 'owner', label: t('Właściciel', 'Owner'), sortable: true, filterable: true },
      { id: 'updatedAt', label: t('Aktualizacja', 'Updated'), sortable: true },
    ],
    [isPolish, t]
  );

  const activeColumns: TableColumn[] =
    activeTab === 'library' ? libraryColumns : activeTab === 'sessions' ? sessionColumns : reportColumns;
  const activeRows: TableRow[] = activeTab === 'library' ? frameworks : activeTab === 'sessions' ? sessions : outputs;

  const rowMenu = (row: TableRow): StandardRowMenu => {
    const openHandler =
      activeTab === 'library'
        ? onOpenFramework
        : activeTab === 'sessions'
          ? onOpenSession
          : onOpenOutput;
    return {
      primary: [
        {
          id: 'open',
          label: t('Otwórz', 'Open'),
          icon: Eye,
          onClick: openHandler ? () => openHandler(String(row.id)) : undefined,
        },
      ],
      universalHandlers: {
        preview: openHandler ? () => openHandler(String(row.id)) : undefined,
        editNote: t('Edycja z poziomu sesji narzędzia', 'Edit from the tool session'),
      },
    };
  };

  const handleRowClick = (row: TableRow) => {
    setSelectedRowId(String(row.id));
    if (activeTab === 'sessions') setSelectedSessionId(String(row.id));
  };

  const handleRowDoubleClick = (row: TableRow) => {
    if (activeTab === 'library') onOpenFramework?.(String(row.id));
    else if (activeTab === 'sessions') onOpenSession?.(String(row.id));
    else onOpenOutput?.(String(row.id));
  };

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) ?? sessions[0] ?? null,
    [sessions, selectedSessionId]
  );

  // ── Right-rail breakdown (Library / Reports tabs) ──────────────────────
  const libraryBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of frameworks) counts[f.category] = (counts[f.category] || 0) + 1;
    return (Object.keys(CATEGORY_LABEL) as ToolFrameworkCategory[])
      .filter((c) => counts[c] > 0)
      .map((c) => ({ label: isPolish ? CATEGORY_LABEL[c].pl : CATEGORY_LABEL[c].en, count: counts[c] }));
  }, [frameworks, isPolish]);

  const reportsBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const o of outputs) counts[o.outputType] = (counts[o.outputType] || 0) + 1;
    return (Object.keys(OUTPUT_TYPE_META) as ToolOutputType[])
      .filter((o) => counts[o] > 0)
      .map((o) => ({ label: isPolish ? OUTPUT_TYPE_META[o].labelPl : OUTPUT_TYPE_META[o].labelEn, count: counts[o] }));
  }, [outputs, isPolish]);

  const totalCount = frameworks.length + sessions.length + outputs.length;

  return (
    <div className="flex h-full flex-col bg-c-bg text-c-text">
      {/* ─── Compact header strip ─── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-c-border bg-c-surface px-5 py-3">
        <span className="text-[12px] text-c-text-muted">
          Tools <span className="mx-1 text-c-text-secondary">›</span> {TAB_LABEL[activeTab]}
        </span>
        <h1 className="m-0 text-[15px] font-semibold tracking-tight text-c-text">
          {libraryName || t('Narzędzia doradcze', 'Discovery tools')}
        </h1>
        <span className="rounded-full border border-c-border bg-c-surface-raised px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-c-text-secondary">
          {totalCount} {t('pozycji', 'items')}
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
          onClick={onNewSession}
          disabled={!onNewSession}
          className="inline-flex items-center gap-2 rounded-lg bg-c-text px-3.5 py-1.5 text-[13px] font-semibold text-c-surface transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          {t('Nowa sesja', 'New session')}
        </button>
      </div>

      {/* ─── 3-column work area ─── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[212px_1fr] lg:grid-cols-[212px_1fr_296px]">
        {/* NAV RAIL */}
        <nav className="hidden overflow-y-auto border-r border-c-border bg-c-surface px-3 py-4 md:block">
          <p className="mx-1.5 mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-c-text-muted">
            {t('Narzędzia', 'Tools')}
          </p>
          <div className="flex flex-col gap-0.5">
            {(['library', 'sessions', 'reports'] as ToolsLightTab[]).map((tab) => {
              const on = tab === activeTab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabChange(tab)}
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
                      {TAB_COUNT[tab]} {t('pozycji', 'items')}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* CENTER — real StandardTable facade (TRIADA kanon) */}
        <main className="min-w-0 overflow-y-auto px-6 py-5">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 className="m-0 text-[21px] font-semibold tracking-tight text-c-text">{TAB_LABEL[activeTab]}</h2>
              <div className="mt-0.5 text-[12.5px] text-c-text-muted">
                {TAB_COUNT[activeTab]} {t('pozycji w tej sekcji', 'items in this section')}
              </div>
            </div>
          </div>

          <StandardTable
            columns={activeColumns}
            data={activeRows}
            selectedRowId={selectedRowId}
            onRowClick={handleRowClick}
            onRowDoubleClick={handleRowDoubleClick}
            rowMenu={rowMenu}
            selection={{ selectedIds, onChange: setSelectedIds }}
            persistKey={`tools-light.${activeTab}`}
            defaultSort={{ columnId: 'updatedAt', direction: 'desc' }}
            canvasClassName="p-0"
            empty={{
              title:
                activeTab === 'library'
                  ? t('Brak narzędzi w bibliotece', 'No frameworks in the library')
                  : activeTab === 'sessions'
                    ? t('Brak sesji', 'No sessions yet')
                    : t('Brak raportów', 'No reports yet'),
              description:
                activeTab === 'library'
                  ? t('Katalog frameworków jest ładowany z silnika.', 'The framework catalog loads from the engine.')
                  : t(
                      'Rozpocznij pierwszą sesję przyciskiem „Nowa sesja" powyżej.',
                      'Start the first session with the "New session" button above.'
                    ),
            }}
          />
        </main>

        {/* ASIDE */}
        <aside className="hidden overflow-y-auto border-l border-c-border bg-c-surface px-4 py-4 lg:block">
          {activeTab === 'sessions' ? (
            <SessionAside session={selectedSession} t={t} isPolish={isPolish} lastUpdatedLabel={lastUpdatedLabel} />
          ) : (
            <BreakdownAside
              titleLabel={activeTab === 'library' ? t('Kategorie', 'Categories') : t('Wg typu', 'By type')}
              items={activeTab === 'library' ? libraryBreakdown : reportsBreakdown}
              t={t}
              lastUpdatedLabel={lastUpdatedLabel}
              footerNote={
                activeTab === 'library'
                  ? t(
                      '22 frameworki, 5 kategorii — silnik liczy poziom drabinki, czat tylko prowadzi rozmowę.',
                      '22 frameworks, 5 categories — the engine computes the ladder depth, chat only narrates the conversation.'
                    )
                  : t(
                      'Wyjścia grupowane wg typu — inicjatywy to jeden z 4 standardowych typów, nie osobny hub.',
                      'Outputs grouped by type — initiatives are one of 4 standard output types, not a separate hub.'
                    )
              }
            />
          )}
        </aside>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-sections (kept in-file — presentational only, not reused elsewhere yet)
// ---------------------------------------------------------------------------

function BreakdownAside({
  titleLabel,
  items,
  t,
  lastUpdatedLabel,
  footerNote,
}: {
  titleLabel: string;
  items: { label: string; count: number }[];
  t: (pl: string, en: string) => string;
  lastUpdatedLabel?: string;
  footerNote: string;
}): React.ReactElement {
  return (
    <>
      <p className="mx-0.5 mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-c-text-muted">
        {t('Rozkład', 'Breakdown')}
      </p>

      <div className="mb-3 overflow-hidden rounded-xl border border-c-border">
        <div className="flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-semibold text-c-text">
          <FolderOpen className="h-[15px] w-[15px] text-c-text-muted" />
          {titleLabel}
          <span
            className="ml-auto rounded-full px-1.5 py-px text-[10.5px] font-semibold"
            style={{ backgroundColor: BLUE_SOFT, color: BLUE }}
          >
            {items.length}
          </span>
        </div>
        <div className="flex flex-col gap-2 px-3.5 pb-3.5">
          {items.length === 0 && (
            <p className="m-0 text-[12.5px] leading-snug text-c-text-muted">
              {t('Brak danych dla tej sekcji.', 'No data for this section.')}
            </p>
          )}
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between text-[12.5px]">
              <span className="truncate text-c-text-secondary">{item.label}</span>
              <span className="font-mono font-semibold tabular-nums text-c-text">{item.count}</span>
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

      <div className="mt-2.5 border-t border-c-border pt-2.5 text-[11.5px] text-c-text-muted">{footerNote}</div>
    </>
  );
}

function SessionAside({
  session,
  t,
  isPolish,
  lastUpdatedLabel,
}: {
  session: ToolSessionLite | null;
  t: (pl: string, en: string) => string;
  isPolish: boolean;
  lastUpdatedLabel?: string;
}): React.ReactElement {
  if (!session) {
    return (
      <>
        <p className="mx-0.5 mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-c-text-muted">
          {t('Postęp sesji', 'Session progress')}
        </p>
        <div className="rounded-xl border border-dashed border-c-border px-3.5 py-6 text-center text-[12.5px] text-c-text-muted">
          {t('Wybierz sesję z listy, aby zobaczyć postęp.', 'Select a session from the list to see progress.')}
        </div>
      </>
    );
  }

  const statusMeta = SESSION_STATUS_META[session.status];

  return (
    <>
      {/* ── Postęp sesji: compact strip, not a card (DOKTRYNA §2 — meta w jednym pasku) ── */}
      <p className="mx-0.5 mb-2 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-c-text-muted">
        {t('Postęp sesji', 'Session progress')}
      </p>
      <div className="mb-3.5 flex items-center gap-2 rounded-xl border border-c-border bg-c-surface-raised px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-c-text">{session.title}</span>
        <StatusPill meta={statusMeta} isPolish={isPolish} />
      </div>

      {/* ── Drabinka pogłębiania (4-rung insight staircase) ── */}
      <div className="mb-3 overflow-hidden rounded-xl border border-c-border">
        <div className="flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-semibold text-c-text">
          <Layers className="h-[15px] w-[15px] text-c-text-muted" />
          {t('Drabinka pogłębiania', 'Deepening ladder')}
          <span
            className="ml-auto rounded-full px-1.5 py-px text-[10.5px] font-semibold"
            style={{ backgroundColor: BLUE_SOFT, color: BLUE }}
          >
            {session.ladderDepth}/4
          </span>
        </div>
        <div>
          {LADDER_RUNG_ORDER.map((rungId, idx) => {
            const rungDepth = idx + 1;
            const reached = rungDepth <= session.ladderDepth;
            const current = rungDepth === session.ladderDepth + 1;
            const Icon = reached ? CheckCircle2 : current ? Circle : Lock;
            const colorClass = reached ? 'text-c-success' : current ? 'text-c-focus-solid' : 'text-c-text-muted';
            return (
              <div
                key={rungId}
                className={`flex items-center gap-2.5 px-3.5 py-2.5 text-[12.5px] ${idx > 0 ? 'border-t border-c-border' : ''}`}
              >
                <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${colorClass}`} />
                <span className={reached || current ? 'text-c-text' : 'text-c-text-muted'}>
                  {isPolish ? LADDER_RUNG_LABEL[rungId].pl : LADDER_RUNG_LABEL[rungId].en}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Źródła ── */}
      <div className="mb-3 overflow-hidden rounded-xl border border-c-border">
        <div className="flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-semibold text-c-text">
          <FolderOpen className="h-[15px] w-[15px] text-c-text-muted" />
          {t('Źródła', 'Sources')}
          <span
            className="ml-auto rounded-full px-1.5 py-px text-[10.5px] font-semibold"
            style={{ backgroundColor: BLUE_SOFT, color: BLUE }}
          >
            {session.sources.length}
          </span>
        </div>
        <div className="flex flex-col gap-2.5 px-3.5 pb-3.5">
          {session.sources.length === 0 && (
            <p className="m-0 text-[12.5px] leading-snug text-c-text-muted">
              {t('Brak podpiętych źródeł.', 'No sources attached.')}
            </p>
          )}
          {session.sources.map((src) => (
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
          'Drabinkę liczy silnik deterministycznie — czat prowadzi rozmowę, nie zmienia poziomu.',
          'The ladder is computed deterministically by the engine — chat guides the conversation, never sets the level.'
        )}
      </div>
    </>
  );
}

export default ToolsLightShell;
