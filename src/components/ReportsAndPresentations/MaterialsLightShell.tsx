/**
 * MaterialsLightShell — lightweight, dense redesign of the Materials module
 * surface (companion to `DRDLightShell` / `FinanceLightShell` — same
 * doctrine, same shell shape). NEW component; `ReportsAndPresentationsHub.tsx`
 * (the real "Materiały" hub, sidebar id `MODULE_PRESENTATIONS`) is untouched.
 * Gated OFF by default behind `materialsLightFlag.ts` (`?ff_materialsLight=1`)
 * — real wiring into the hub happens in a later step, only after Piotr signs
 * off on the harness screenshot (CLAUDE.md rule #7: no flag-flip as a first
 * look).
 *
 * Composition mirrors FinanceLightShell / DRDLightShell:
 *   1. Compact header strip (breadcrumb · library title · count chip · CTA).
 *   2. Left rail: 3 sections by TYPE ONLY — Prezentacje · Dokumenty · Arkusze.
 *      Owner note #83 (2026-07-11): clean Menu 2 down to types — no separate
 *      All/Mine/Needs-review/Templates entries in the light nav, and no
 *      standalone "Data" tab (#83a: "Data" folds into "Sheets" — one dataset,
 *      one view, per DOKTRYNA_GESTOSCI §4 "zero dwóch zakładek na ten sam
 *      dataset").
 *   3. Center: the REAL `<StandardTable>` facade (import, not
 *      reimplementation) — one dense list per active type, TRIADA kanon
 *      (sort/filter header, kebab 5-block contract, row-select → bulk).
 *   4. Right rail: source-type breakdown (mirrors DRDLightShell's "Źródła i
 *      założenia" / FinanceLightShell's "Pochodzenie") + last-activity line.
 *
 * COLOR DOCTRINE (hard, identical to FinanceLightShell/DRDLightShell):
 *   - `c-accent` (Harvard Crimson) is reserved for critical semantics only —
 *     NOT used here. Active nav item / primary CTA accent = the blue focus
 *     token (`--c-focus-solid`). Status tones: success = `c-success`,
 *     warning = `c-warning`, danger = `c-danger`, neutral/draft = muted text.
 *     Primary CTA is neutral (`bg-c-text text-c-surface`).
 *   - All colors via c-* tokens (Tailwind classes or `var(--c-*)` /
 *     `rgb(var(--c-*-rgb) / a)`), never raw hex — both themes adapt.
 *
 * This component is presentational only (props in, JSX out) — no store, no
 * API calls, no context — exactly like `EvBasketFootballField`. Mock data for
 * the dev-render harness lives in `dev-render/screens/materials-light.tsx`,
 * not here (same split as `finance-light.tsx` vs `FinanceLightShell.tsx`).
 */
import {
  Clock,
  Eye,
  FileText,
  FolderOpen,
  MessageSquare,
  Plus,
  Presentation,
  Table2,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import StandardTable, {
  type StandardRowMenu,
  type TableColumn,
  type TableRow,
} from '../standard/StandardTable';

// ---------------------------------------------------------------------------
// Types — lightweight mirrors of the real hub's output shapes
// (`ReportsAndPresentations/types.ts`: ReportItem / PresentationItem +
// sheet rows). Kept local to this file so the light shell has zero coupling
// to the hub's data hooks (`useRapData.ts`) — presentational-only, like its
// Finance/DRD siblings.
// ---------------------------------------------------------------------------

export type MaterialsTab = 'presentations' | 'documents' | 'sheets';

export type MaterialStatus = 'draft' | 'generated' | 'editing' | 'ready' | 'exported' | 'shared' | 'archived';

export type MaterialSourceType = 'tool' | 'assessment' | 'finance' | 'upload';

export interface MaterialPresentationLite {
  id: string;
  title: string;
  sourceType: MaterialSourceType;
  status: MaterialStatus;
  slideCount: number;
  owner: string;
  updatedAt: string;
}

export type MaterialReportType = 'R1' | 'R2' | 'R3' | 'R4' | 'custom';

export interface MaterialDocumentLite {
  id: string;
  title: string;
  reportType: MaterialReportType;
  status: MaterialStatus;
  owner: string;
  updatedAt: string;
  exportFormats: string[];
}

export interface MaterialSheetLite {
  id: string;
  title: string;
  status: MaterialStatus;
  rowCount: number;
  owner: string;
  updatedAt: string;
}

interface MaterialsLightShellProps {
  libraryName?: string;
  presentations?: MaterialPresentationLite[];
  documents?: MaterialDocumentLite[];
  sheets?: MaterialSheetLite[];
  lastUpdatedLabel?: string;
  onNewMaterial?: (tab: MaterialsTab) => void;
  onOpenChat?: () => void;
  onOpenItem?: (tab: MaterialsTab, id: string) => void;
}

const BLUE = 'rgb(var(--c-focus-solid-rgb))';
const BLUE_SOFT = 'rgb(var(--c-focus-solid-rgb) / 0.10)';

const TAB_ICON: Record<MaterialsTab, React.ReactNode> = {
  presentations: <Presentation className="h-[13px] w-[13px]" />,
  documents: <FileText className="h-[13px] w-[13px]" />,
  sheets: <Table2 className="h-[13px] w-[13px]" />,
};

const STATUS_META: Record<
  MaterialStatus,
  { labelPl: string; labelEn: string; className: string }
> = {
  draft: { labelPl: 'Szkic', labelEn: 'Draft', className: 'text-c-text-muted border-c-border' },
  generated: { labelPl: 'Wygenerowany', labelEn: 'Generated', className: 'text-c-focus-solid border-c-focus-solid/30' },
  editing: { labelPl: 'Edycja', labelEn: 'Editing', className: 'text-c-warning border-c-warning/30' },
  ready: { labelPl: 'Gotowy', labelEn: 'Ready', className: 'text-c-success border-c-success/30' },
  exported: { labelPl: 'Wyeksportowany', labelEn: 'Exported', className: 'text-c-focus-solid border-c-focus-solid/30' },
  shared: { labelPl: 'Udostępniony', labelEn: 'Shared', className: 'text-c-focus-solid border-c-focus-solid/30' },
  archived: { labelPl: 'Zarchiwizowany', labelEn: 'Archived', className: 'text-c-text-muted border-c-border' },
};

const SOURCE_META: Record<MaterialSourceType, { labelPl: string; labelEn: string }> = {
  tool: { labelPl: 'Narzędzie', labelEn: 'Tool' },
  assessment: { labelPl: 'Ocena', labelEn: 'Assessment' },
  finance: { labelPl: 'Finanse', labelEn: 'Finance' },
  upload: { labelPl: 'Przesłane', labelEn: 'Upload' },
};

const REPORT_TYPE_LABEL: Record<MaterialReportType, string> = {
  R1: 'R1 · Raport tygodniowy',
  R2: 'R2 · Komitet sterujący',
  R3: 'R3 · Śledzenie korzyści',
  R4: 'R4 · Przegląd portfela',
  custom: 'Własny',
};

function StatusPill({ status, isPolish }: { status: MaterialStatus; isPolish: boolean }): React.ReactElement {
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.className}`}
    >
      {isPolish ? meta.labelPl : meta.labelEn}
    </span>
  );
}

export const MaterialsLightShell: React.FC<MaterialsLightShellProps> = ({
  libraryName,
  presentations = [],
  documents = [],
  sheets = [],
  lastUpdatedLabel,
  onNewMaterial,
  onOpenChat,
  onOpenItem,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const t = (pl: string, en: string) => (isPolish ? pl : en);

  const [activeTab, setActiveTab] = useState<MaterialsTab>('presentations');
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const TAB_LABEL: Record<MaterialsTab, string> = {
    presentations: t('Prezentacje', 'Presentations'),
    documents: t('Dokumenty', 'Documents'),
    sheets: t('Arkusze', 'Sheets'),
  };
  const TAB_COUNT: Record<MaterialsTab, number> = {
    presentations: presentations.length,
    documents: documents.length,
    sheets: sheets.length,
  };

  const totalCount = presentations.length + documents.length + sheets.length;

  // Reset selection when switching type — selection is per-list, not global
  // (StandardTable MUST #7: checkbox-driven bulk mode is scoped to the
  // visible rows of the active tab).
  const handleTabChange = (tab: MaterialsTab) => {
    setActiveTab(tab);
    setSelectedRowId(null);
    setSelectedIds(new Set());
  };

  // ── Columns + rows per type ────────────────────────────────────────────
  const presentationColumns: TableColumn[] = useMemo(
    () => [
      { id: 'title', label: t('Tytuł', 'Title'), sortable: true, filterable: true },
      {
        id: 'sourceType',
        label: t('Źródło', 'Source'),
        sortable: true,
        filterable: true,
        filterOptions: (Object.keys(SOURCE_META) as MaterialSourceType[]).map((s) => ({
          value: s,
          label: isPolish ? SOURCE_META[s].labelPl : SOURCE_META[s].labelEn,
        })),
        render: (row: MaterialPresentationLite) => (
          <span className="text-c-text-secondary">
            {isPolish ? SOURCE_META[row.sourceType].labelPl : SOURCE_META[row.sourceType].labelEn}
          </span>
        ),
      },
      {
        id: 'status',
        label: t('Status', 'Status'),
        sortable: true,
        filterable: true,
        filterOptions: (Object.keys(STATUS_META) as MaterialStatus[]).map((s) => ({
          value: s,
          label: isPolish ? STATUS_META[s].labelPl : STATUS_META[s].labelEn,
        })),
        render: (row: MaterialPresentationLite) => <StatusPill status={row.status} isPolish={isPolish} />,
      },
      {
        id: 'slideCount',
        label: t('Slajdy', 'Slides'),
        align: 'right',
        sortable: true,
        render: (row: MaterialPresentationLite) => (
          <span className="font-mono tabular-nums text-c-text-secondary">{row.slideCount}</span>
        ),
      },
      { id: 'owner', label: t('Właściciel', 'Owner'), sortable: true, filterable: true },
      { id: 'updatedAt', label: t('Aktualizacja', 'Updated'), sortable: true },
    ],
    [isPolish, t]
  );

  const documentColumns: TableColumn[] = useMemo(
    () => [
      { id: 'title', label: t('Tytuł', 'Title'), sortable: true, filterable: true },
      {
        id: 'reportType',
        label: t('Typ raportu', 'Report type'),
        sortable: true,
        filterable: true,
        filterOptions: (Object.keys(REPORT_TYPE_LABEL) as MaterialReportType[]).map((rt) => ({
          value: rt,
          label: REPORT_TYPE_LABEL[rt],
        })),
        render: (row: MaterialDocumentLite) => (
          <span className="font-mono text-[11px] font-semibold text-c-text-muted">
            {REPORT_TYPE_LABEL[row.reportType]}
          </span>
        ),
      },
      {
        id: 'status',
        label: t('Status', 'Status'),
        sortable: true,
        filterable: true,
        filterOptions: (Object.keys(STATUS_META) as MaterialStatus[]).map((s) => ({
          value: s,
          label: isPolish ? STATUS_META[s].labelPl : STATUS_META[s].labelEn,
        })),
        render: (row: MaterialDocumentLite) => <StatusPill status={row.status} isPolish={isPolish} />,
      },
      {
        id: 'exportFormats',
        label: t('Eksport', 'Export'),
        render: (row: MaterialDocumentLite) => (
          <span className="text-c-text-secondary">{row.exportFormats.join(' · ') || '—'}</span>
        ),
      },
      { id: 'owner', label: t('Właściciel', 'Owner'), sortable: true, filterable: true },
      { id: 'updatedAt', label: t('Aktualizacja', 'Updated'), sortable: true },
    ],
    [isPolish, t]
  );

  const sheetColumns: TableColumn[] = useMemo(
    () => [
      { id: 'title', label: t('Tytuł', 'Title'), sortable: true, filterable: true },
      {
        id: 'status',
        label: t('Status', 'Status'),
        sortable: true,
        filterable: true,
        filterOptions: (Object.keys(STATUS_META) as MaterialStatus[]).map((s) => ({
          value: s,
          label: isPolish ? STATUS_META[s].labelPl : STATUS_META[s].labelEn,
        })),
        render: (row: MaterialSheetLite) => <StatusPill status={row.status} isPolish={isPolish} />,
      },
      {
        id: 'rowCount',
        label: t('Wiersze', 'Rows'),
        align: 'right',
        sortable: true,
        render: (row: MaterialSheetLite) => (
          <span className="font-mono tabular-nums text-c-text-secondary">{row.rowCount}</span>
        ),
      },
      { id: 'owner', label: t('Właściciel', 'Owner'), sortable: true, filterable: true },
      { id: 'updatedAt', label: t('Aktualizacja', 'Updated'), sortable: true },
    ],
    [isPolish, t]
  );

  const activeColumns: TableColumn[] =
    activeTab === 'presentations' ? presentationColumns : activeTab === 'documents' ? documentColumns : sheetColumns;
  const activeRows: TableRow[] =
    activeTab === 'presentations' ? presentations : activeTab === 'documents' ? documents : sheets;

  const rowMenu = (row: TableRow): StandardRowMenu => ({
    primary: [
      {
        id: 'open',
        label: t('Otwórz', 'Open'),
        icon: Eye,
        onClick: onOpenItem ? () => onOpenItem(activeTab, String(row.id)) : undefined,
      },
    ],
    universalHandlers: {
      preview: onOpenItem ? () => onOpenItem(activeTab, String(row.id)) : undefined,
      editNote: t('Edycja z poziomu edytora materiału', 'Edit from the material editor'),
    },
  });

  // Source-type breakdown for the right rail (presentations tab has real
  // sourceType data; documents/sheets fall back to a report-type / count
  // summary so the panel is never empty — DOKTRYNA_GESTOSCI §2 "żaden panel
  // < 50% wypełnienia").
  const rightRailBreakdown = useMemo(() => {
    if (activeTab === 'presentations') {
      const counts: Record<string, number> = {};
      for (const p of presentations) counts[p.sourceType] = (counts[p.sourceType] || 0) + 1;
      return (Object.keys(SOURCE_META) as MaterialSourceType[])
        .filter((s) => counts[s] > 0)
        .map((s) => ({
          label: isPolish ? SOURCE_META[s].labelPl : SOURCE_META[s].labelEn,
          count: counts[s],
        }));
    }
    if (activeTab === 'documents') {
      const counts: Record<string, number> = {};
      for (const d of documents) counts[d.reportType] = (counts[d.reportType] || 0) + 1;
      return (Object.keys(REPORT_TYPE_LABEL) as MaterialReportType[])
        .filter((rt) => counts[rt] > 0)
        .map((rt) => ({ label: REPORT_TYPE_LABEL[rt], count: counts[rt] }));
    }
    const counts: Record<string, number> = {};
    for (const s of sheets) counts[s.status] = (counts[s.status] || 0) + 1;
    return (Object.keys(STATUS_META) as MaterialStatus[])
      .filter((s) => counts[s] > 0)
      .map((s) => ({ label: isPolish ? STATUS_META[s].labelPl : STATUS_META[s].labelEn, count: counts[s] }));
  }, [activeTab, presentations, documents, sheets, isPolish]);

  return (
    <div className="flex h-full flex-col bg-c-bg text-c-text">
      {/* ─── Compact header strip ─── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-c-border bg-c-surface px-5 py-3">
        <span className="text-[12px] text-c-text-muted">
          Materiały <span className="mx-1 text-c-text-secondary">›</span> {TAB_LABEL[activeTab]}
        </span>
        <h1 className="m-0 text-[15px] font-semibold tracking-tight text-c-text">
          {libraryName || t('Biblioteka materiałów', 'Materials library')}
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
            {t('Zapytaj', 'Ask')}
          </button>
        )}
        <button
          type="button"
          onClick={onNewMaterial ? () => onNewMaterial(activeTab) : undefined}
          disabled={!onNewMaterial}
          className="inline-flex items-center gap-2 rounded-lg bg-c-text px-3.5 py-1.5 text-[13px] font-semibold text-c-surface transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          {t('Nowy materiał', 'New material')}
        </button>
      </div>

      {/* ─── 3-column work area ─── */}
      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[212px_1fr] lg:grid-cols-[212px_1fr_280px]">
        {/* TYPE NAV RAIL */}
        <nav className="hidden overflow-y-auto border-r border-c-border bg-c-surface px-3 py-4 md:block">
          <p className="mx-1.5 mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-c-text-muted">
            {t('Typy materiałów', 'Material types')}
          </p>
          <div className="flex flex-col gap-0.5">
            {(['presentations', 'documents', 'sheets'] as MaterialsTab[]).map((tab) => {
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
              <h2 className="m-0 text-[21px] font-semibold tracking-tight text-c-text">
                {TAB_LABEL[activeTab]}
              </h2>
              <div className="mt-0.5 text-[12.5px] text-c-text-muted">
                {TAB_COUNT[activeTab]} {t('pozycji w tym typie', 'items of this type')}
              </div>
            </div>
          </div>

          <StandardTable
            columns={activeColumns}
            data={activeRows}
            selectedRowId={selectedRowId}
            onRowClick={(row) => setSelectedRowId(String(row.id))}
            onRowDoubleClick={onOpenItem ? (row) => onOpenItem(activeTab, String(row.id)) : undefined}
            rowMenu={rowMenu}
            selection={{ selectedIds, onChange: setSelectedIds }}
            persistKey={`materials-light.${activeTab}`}
            defaultSort={{ columnId: 'updatedAt', direction: 'desc' }}
            canvasClassName="p-0"
            empty={{
              title: t('Brak materiałów tego typu', 'No materials of this type yet'),
              description: t(
                'Wygeneruj pierwszy materiał przyciskiem „Nowy materiał" powyżej.',
                'Generate the first material with the "New material" button above.'
              ),
            }}
          />
        </main>

        {/* ASIDE */}
        <aside className="hidden overflow-y-auto border-l border-c-border bg-c-surface px-4 py-4 lg:block">
          <p className="mx-0.5 mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.13em] text-c-text-muted">
            {t('Rozkład', 'Breakdown')}
          </p>

          <div className="mb-3 overflow-hidden rounded-xl border border-c-border">
            <div className="flex items-center gap-2 px-3.5 py-3 text-[12.5px] font-semibold text-c-text">
              <FolderOpen className="h-[15px] w-[15px] text-c-text-muted" />
              {activeTab === 'presentations'
                ? t('Źródła', 'Sources')
                : activeTab === 'documents'
                  ? t('Typy raportów', 'Report types')
                  : t('Statusy', 'Statuses')}
              <span
                className="ml-auto rounded-full px-1.5 py-px text-[10.5px] font-semibold"
                style={{ backgroundColor: BLUE_SOFT, color: BLUE }}
              >
                {rightRailBreakdown.length}
              </span>
            </div>
            <div className="flex flex-col gap-2 px-3.5 pb-3.5">
              {rightRailBreakdown.length === 0 && (
                <p className="m-0 text-[12.5px] leading-snug text-c-text-muted">
                  {t('Brak danych dla tego typu.', 'No data for this type.')}
                </p>
              )}
              {rightRailBreakdown.map((item) => (
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

          <div className="mt-2.5 border-t border-c-border pt-2.5 text-[11.5px] text-c-text-muted">
            {t(
              'Materiały grupowane po typie — bez osobnej zakładki „Dane": arkusze to jeden widok.',
              'Materials are grouped by type — no separate "Data" tab: sheets are a single view.'
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default MaterialsLightShell;
