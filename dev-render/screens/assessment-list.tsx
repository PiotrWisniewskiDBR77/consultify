/**
 * Mock host for the TRIADA list canon — <StandardModuleBar> + <StandardTable>
 * mounted with a realistic "Assessment" list (DRD diagnoses per business unit),
 * the same pair of facades every list screen in the app must use (CLAUDE.md
 * UI-rule #1, SSOT docs/ui-standards/TRIADA_KANON.md). No re-implementation —
 * both components are the REAL production facades, fed mock rows only.
 *
 * Exercises: Menu 2 pills + search + primary CTA, Menu 3 filter chips with
 * counts, StandardTable sort/filter header, row kebab (5-block contract —
 * primary/status/universal/destructive), row-select checkboxes -> bulk bar.
 * All handlers are local no-ops / local state so the click interactions still
 * work for the supervisor without any backend.
 */
import React, { useMemo, useState } from 'react';
import { CheckCircle2, Eye, FileBarChart, RefreshCcw } from 'lucide-react';

import StandardModuleBar from '../../src/components/standard/StandardModuleBar';
import StandardTable, {
  type StandardRowMenu,
  type TableColumn,
  type TableRow,
} from '../../src/components/standard/StandardTable';

interface AssessmentRow extends TableRow {
  id: string;
  name: string;
  unit: string;
  status: 'draft' | 'in_review' | 'completed' | 'archived';
  score: number;
  confidence: number;
  owner: string;
  updatedAt: string;
}

const STATUS_LABEL: Record<AssessmentRow['status'], string> = {
  draft: 'Szkic',
  in_review: 'W przeglądzie',
  completed: 'Ukończona',
  archived: 'Zarchiwizowana',
};

const STATUS_COLOR: Record<AssessmentRow['status'], string> = {
  draft: 'bg-c-surface-muted text-c-text-secondary border-c-border',
  in_review: 'bg-c-warning/10 text-c-warning border-c-warning/30',
  completed: 'bg-c-success/10 text-c-success border-c-success/30',
  archived: 'bg-c-surface-muted text-c-text-muted border-c-border',
};

const MOCK_ROWS: AssessmentRow[] = [
  {
    id: 'a1',
    name: 'DBR77 · Digital Readiness Diagnosis',
    unit: 'Grupa — Zarząd',
    status: 'in_review',
    score: 3.4,
    confidence: 0.72,
    owner: 'Piotr Wiśniewski',
    updatedAt: '2026-07-10',
    description: 'Pełna diagnoza 39 obszarów / 5 osi — runda Q3 2026.',
  },
  {
    id: 'a2',
    name: 'Segment Manufacturing — DRD Light',
    unit: 'Manufacturing BU',
    status: 'completed',
    score: 4.1,
    confidence: 0.88,
    owner: 'Anna Kowalska',
    updatedAt: '2026-07-08',
    description: 'Skrócona diagnoza pilotażowa — 3 osie priorytetowe.',
  },
  {
    id: 'a3',
    name: 'Segment Logistics — DRD Light',
    unit: 'Logistics BU',
    status: 'draft',
    score: 0,
    confidence: 0,
    owner: 'Marek Zieliński',
    updatedAt: '2026-07-11',
    description: 'Nierozpoczęta — czeka na kickoff z liderem BU.',
  },
  {
    id: 'a4',
    name: 'Grupa Consultify — Roczna re-diagnoza',
    unit: 'Grupa — Zarząd',
    status: 'completed',
    score: 3.9,
    confidence: 0.91,
    owner: 'Piotr Wiśniewski',
    updatedAt: '2026-06-30',
    description: 'Porównanie rok do roku, delta +0.6 vs 2025.',
  },
  {
    id: 'a5',
    name: 'Segment Finance & Shared Services',
    unit: 'Finance BU',
    status: 'archived',
    score: 2.8,
    confidence: 0.65,
    owner: 'Anna Kowalska',
    updatedAt: '2026-05-14',
    description: 'Zamknięta po wdrożeniu inicjatyw naprawczych.',
  },
  {
    id: 'a6',
    name: 'Segment Sales & Marketing',
    unit: 'Sales BU',
    status: 'in_review',
    score: 3.1,
    confidence: 0.58,
    owner: 'Marek Zieliński',
    updatedAt: '2026-07-09',
    description: 'Wynik wstępny — czeka na walidację panelu ekspertów.',
  },
];

export function AssessmentListScreen(): React.ReactElement {
  const [rows, setRows] = useState<AssessmentRow[]>(MOCK_ROWS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [activeChip, setActiveChip] = useState<string | null>(null);

  const counts = useMemo(() => {
    const acc: Record<string, number> = { all: rows.length };
    for (const r of rows) acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, [rows]);

  const columns: TableColumn[] = useMemo(
    () => [
      { id: 'name', label: 'Nazwa oceny', sortable: true, filterable: true },
      { id: 'unit', label: 'Jednostka', sortable: true, filterable: true },
      {
        id: 'status',
        label: 'Status',
        sortable: true,
        filterable: true,
        filterOptions: (Object.keys(STATUS_LABEL) as AssessmentRow['status'][]).map((s) => ({
          value: s,
          label: STATUS_LABEL[s],
        })),
        render: (row: AssessmentRow) => (
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${STATUS_COLOR[row.status]}`}
          >
            {STATUS_LABEL[row.status]}
          </span>
        ),
      },
      {
        id: 'score',
        label: 'Wynik',
        align: 'right',
        sortable: true,
        render: (row: AssessmentRow) => (
          <span className="font-mono tabular-nums">{row.score > 0 ? row.score.toFixed(1) : '—'}</span>
        ),
      },
      {
        id: 'confidence',
        label: 'Pewność',
        align: 'right',
        sortable: true,
        render: (row: AssessmentRow) => (
          <span className="font-mono tabular-nums text-c-text-secondary">
            {row.confidence > 0 ? `${Math.round(row.confidence * 100)}%` : '—'}
          </span>
        ),
      },
      { id: 'owner', label: 'Właściciel', sortable: true, filterable: true },
      { id: 'updatedAt', label: 'Aktualizacja', sortable: true },
    ],
    []
  );

  const rowMenu = (row: AssessmentRow): StandardRowMenu => ({
    primary: [{ id: 'open', label: 'Otwórz', icon: Eye, onClick: () => setSelectedRowId(row.id) }],
    statusTransitions:
      row.status !== 'completed'
        ? [
            {
              id: 'complete',
              label: 'Oznacz jako ukończoną',
              icon: CheckCircle2,
              onClick: () =>
                setRows((prev) =>
                  prev.map((r) => (r.id === row.id ? { ...r, status: 'completed' } : r))
                ),
            },
          ]
        : [
            {
              id: 'reopen',
              label: 'Przywróć do przeglądu',
              icon: RefreshCcw,
              onClick: () =>
                setRows((prev) =>
                  prev.map((r) => (r.id === row.id ? { ...r, status: 'in_review' } : r))
                ),
            },
          ],
    universalHandlers: {
      preview: () => setSelectedRowId(row.id),
      edit: undefined,
      editNote: 'Edycja z poziomu edytora sesji DRD',
      archive: () =>
        setRows((prev) =>
          prev.map((r) => (r.id === row.id ? { ...r, status: 'archived' } : r))
        ),
    },
    destructive: {
      onClick: () => setRows((prev) => prev.filter((r) => r.id !== row.id)),
    },
  });

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto' }}>
      <StandardModuleBar
        tabs={[
          { id: 'all', label: 'Wszystkie' },
          { id: 'mine', label: 'Moje' },
          { id: 'templates', label: 'Szablony' },
        ]}
        activeTab="all"
        onTabChange={() => {}}
        searchValue=""
        onSearch={() => {}}
        primaryCta={{ label: 'Nowa ocena', icon: FileBarChart, onClick: () => {} }}
        chips={[
          { id: 'all', label: 'Wszystkie', count: counts.all },
          { id: 'draft', label: STATUS_LABEL.draft, count: counts.draft || 0 },
          { id: 'in_review', label: STATUS_LABEL.in_review, count: counts.in_review || 0 },
          { id: 'completed', label: STATUS_LABEL.completed, count: counts.completed || 0 },
          { id: 'archived', label: STATUS_LABEL.archived, count: counts.archived || 0 },
        ]}
        activeChip={activeChip}
        onChipChange={(id) => setActiveChip(id === activeChip ? null : id)}
        bulk={
          selectedIds.size > 0
            ? {
                count: selectedIds.size,
                onClear: () => setSelectedIds(new Set()),
                actions: [
                  {
                    id: 'archive-bulk',
                    label: 'Archiwizuj',
                    onClick: () => {
                      setRows((prev) =>
                        prev.map((r) =>
                          selectedIds.has(r.id) ? { ...r, status: 'archived' } : r
                        )
                      );
                      setSelectedIds(new Set());
                    },
                  },
                  {
                    id: 'delete-bulk',
                    label: 'Usuń',
                    variant: 'danger',
                    onClick: () => {
                      setRows((prev) => prev.filter((r) => !selectedIds.has(r.id)));
                      setSelectedIds(new Set());
                    },
                  },
                ],
              }
            : null
        }
      />
      <StandardTable
        columns={columns}
        data={rows.filter((r) => !activeChip || activeChip === 'all' || r.status === activeChip)}
        selectedRowId={selectedRowId}
        onRowClick={(row) => setSelectedRowId(String(row.id))}
        rowMenu={rowMenu as (row: TableRow) => StandardRowMenu}
        selection={{ selectedIds, onChange: setSelectedIds }}
        persistKey="dev-render.assessment-list"
        defaultSort={{ columnId: 'updatedAt', direction: 'desc' }}
      />
    </div>
  );
}

export default AssessmentListScreen;
