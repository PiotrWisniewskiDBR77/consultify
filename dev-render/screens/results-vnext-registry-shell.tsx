/**
 * RN-G2 P0 — visual QA harness for `ResultsVNextRegistryShell`. Mounts the
 * REAL shell component (no domain screen yet — P0 is shell-only) with mock
 * data covering every required state from RN_G2_UI_SCOPE.md §D: loading,
 * empty, error, forbidden (ABAC deep-link deny), and locked/lifecycle-gated
 * rows + the honest-missing (`null` vs `'not_calculable'`) value domain.
 *
 * URL params:
 *   ?domain=kpi|roi|okr           which domain's mock vocabulary to use (default kpi)
 *   &state=ready|loading|empty|error|forbidden   which top-level state to force (default ready)
 *   &reason=CROSS_TENANT|NO_VISIBILITY_RECORD|PRIVATE_NOT_OWNER|OUT_OF_SCOPE|NOT_IN_CHAIN|NOT_ON_ACL
 *                                  ABAC deny reason when state=forbidden (default NO_VISIBILITY_RECORD)
 *   &selected=<rowId>             pre-select a row (opens StandardPreview); 'none' to close it
 */
import React, { useState } from 'react';

import {
  type ResultsVNextDenyReason,
  ResultsVNextRegistryShell,
  type ResultsVNextTableProps,
} from '../../src/components/ResultsVNext';
import { HonestValueCell } from '../../src/components/ResultsVNext/HonestValue';
import {
  LifecycleLockBadge,
  lockedRowMenuAction,
} from '../../src/components/ResultsVNext/LifecycleLockBadge';
import type {
  HonestValue,
  ResultsVNextDomain,
} from '../../src/components/ResultsVNext/types';
import type {
  StandardPreviewProps,
  StandardRowMenu,
  TableColumn,
} from '../../src/components/standard';
import { StatusChip } from '../../src/components/ui/primitives';

interface MockRow {
  id: string;
  name: string;
  owner: string;
  status: 'draft' | 'in_review' | 'approved' | 'closed' | 'blocked';
  locked?: { label: string; reason: string };
  metricLabel: string;
  metricValue: HonestValue<number>;
  metricUnit: string;
  updatedAt: string;
}

const DOMAIN_VOCAB: Record<
  ResultsVNextDomain,
  { title: string; metricLabel: string; unit: string; rows: MockRow[] }
> = {
  kpi: {
    title: 'KPI Registry',
    metricLabel: 'Current value',
    unit: '%',
    rows: [
      {
        id: 'kpi-1',
        name: 'OEE linii pakowania',
        owner: 'Anna Kowalska',
        status: 'in_review',
        metricLabel: 'Current value',
        metricValue: 74,
        metricUnit: '%',
        updatedAt: '2026-08-08',
      },
      {
        id: 'kpi-2',
        name: 'Pokrycie audytu dostawców',
        owner: 'Tomasz Nowak',
        status: 'draft',
        metricLabel: 'Current value',
        metricValue: null,
        metricUnit: '%',
        updatedAt: '2026-08-01',
      },
      {
        id: 'kpi-3',
        name: 'Redukcja kosztów pracy (degenerate baseline)',
        owner: 'Piotr Wiśniewski',
        status: 'approved',
        metricLabel: 'Deviation vs baseline',
        metricValue: 'not_calculable',
        metricUnit: '%',
        updatedAt: '2026-08-05',
      },
      {
        id: 'kpi-4',
        name: 'Czas cyklu zamknięcia miesiąca',
        owner: 'Anna Kowalska',
        status: 'closed',
        locked: {
          label: 'Closed',
          reason: 'Deviation case closed — measurements are read-only until reopened.',
        },
        metricLabel: 'Current value',
        metricValue: 5,
        metricUnit: 'dni',
        updatedAt: '2026-07-30',
      },
    ],
  },
  roi: {
    title: 'ROI Registry',
    metricLabel: 'NPV',
    unit: 'PLN',
    rows: [
      {
        id: 'roi-1',
        name: 'Automatyzacja linii pakowania',
        owner: 'Anna Kowalska',
        status: 'in_review',
        metricLabel: 'NPV',
        metricValue: 512000,
        metricUnit: 'PLN',
        updatedAt: '2026-08-07',
      },
      {
        id: 'roi-2',
        name: 'Migracja legacy MES',
        owner: 'Tomasz Nowak',
        status: 'draft',
        metricLabel: 'NPV',
        metricValue: null,
        metricUnit: 'PLN',
        updatedAt: '2026-08-02',
      },
      {
        id: 'roi-3',
        name: 'Program szkoleń Lean (zero cost basis)',
        owner: 'Piotr Wiśniewski',
        status: 'blocked',
        metricLabel: 'IRR',
        metricValue: 'not_calculable',
        metricUnit: '%',
        updatedAt: '2026-08-04',
      },
      {
        id: 'roi-4',
        name: 'Rollup finansowy — jedno źródło',
        owner: 'Anna Kowalska',
        status: 'approved',
        locked: {
          label: 'Approved',
          reason: 'Approved case — baseline and assumptions are frozen (approval snapshot taken).',
        },
        metricLabel: 'NPV',
        metricValue: 140000,
        metricUnit: 'PLN',
        updatedAt: '2026-07-29',
      },
    ],
  },
  okr: {
    title: 'OKR Registry',
    metricLabel: 'Progress',
    unit: '%',
    rows: [
      {
        id: 'okr-1',
        name: 'Zbudować cyfrową dojrzałość operacji do poziomu 4',
        owner: 'Anna Kowalska',
        status: 'in_review',
        metricLabel: 'Progress',
        metricValue: 72,
        metricUnit: '%',
        updatedAt: '2026-08-06',
      },
      {
        id: 'okr-2',
        name: 'Uzyskać dyscyplinę finansową portfela inicjatyw',
        owner: 'Tomasz Nowak',
        status: 'draft',
        metricLabel: 'Progress',
        metricValue: null,
        metricUnit: '%',
        updatedAt: '2026-08-03',
      },
      {
        id: 'okr-3',
        name: 'Zero key results (degenerate geometry)',
        owner: 'Piotr Wiśniewski',
        status: 'blocked',
        metricLabel: 'Confidence',
        metricValue: 'not_calculable',
        metricUnit: '',
        updatedAt: '2026-08-01',
      },
      {
        id: 'okr-4',
        name: 'Wdrożyć MES na 3 liniach',
        owner: 'Anna Kowalska',
        status: 'closed',
        locked: {
          label: 'Closed',
          reason: 'Cycle closed — carry-forward required to continue this Key Result.',
        },
        metricLabel: 'Progress',
        metricValue: 100,
        metricUnit: '%',
        updatedAt: '2026-07-25',
      },
    ],
  },
};

const STATUS_TONE: Record<MockRow['status'], 'info' | 'warning' | 'success' | 'danger'> = {
  draft: 'info',
  in_review: 'warning',
  approved: 'success',
  closed: 'info',
  blocked: 'danger',
};

const STATUS_LABEL: Record<MockRow['status'], string> = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
  closed: 'Closed',
  blocked: 'Blocked',
};

function buildColumns(): TableColumn[] {
  return [
    {
      id: 'name',
      label: 'Name',
      width: '320px',
      render: (row: MockRow) => (
        <span className="text-sm font-medium text-c-text">{row.name}</span>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      width: '120px',
      filterable: true,
      filterOptions: (Object.keys(STATUS_LABEL) as MockRow['status'][]).map((s) => ({
        value: s,
        label: STATUS_LABEL[s],
      })),
      render: (row: MockRow) => (
        <StatusChip label={STATUS_LABEL[row.status]} tone={STATUS_TONE[row.status]} />
      ),
    },
    {
      id: 'owner',
      label: 'Owner',
      width: '160px',
      render: (row: MockRow) => (
        <span className="text-sm text-c-text-secondary">{row.owner}</span>
      ),
    },
    {
      id: 'metric',
      label: 'Value',
      width: '140px',
      align: 'right',
      render: (row: MockRow) => (
        <HonestValueCell
          value={row.metricValue}
          align="right"
          notCalculableReason={`${row.metricLabel} is structurally undefined for this record (e.g. zero baseline).`}
          format={(v) => (
            <span className="tabular-nums font-medium text-c-text">
              {v.toLocaleString('en-US')}
              {row.metricUnit ? ` ${row.metricUnit}` : ''}
            </span>
          )}
        />
      ),
    },
    {
      id: 'updatedAt',
      label: 'Updated',
      width: '120px',
      sortable: true,
      render: (row: MockRow) => (
        <span className="text-sm text-c-text-muted">{row.updatedAt}</span>
      ),
    },
  ];
}

function buildRowMenu(row: MockRow): StandardRowMenu {
  return {
    primary: [
      {
        id: 'open',
        label: 'Open',
        onClick: () => {},
      },
    ],
    statusTransitions: row.locked
      ? [lockedRowMenuAction({ id: 'approve', label: 'Approve' }, row.locked.reason)]
      : [
          {
            id: 'approve',
            label: 'Approve',
            onClick: () => {},
          },
        ],
    universalHandlers: row.locked
      ? {
          preview: () => {},
          editNote: row.locked.reason,
          archive: () => {},
        }
      : {
          preview: () => {},
          edit: () => {},
          archive: () => {},
        },
    destructive: row.locked
      ? undefined
      : {
          onClick: () => {},
          note: undefined,
        },
  };
}

function buildPreview(
  row: MockRow,
  domainTitle: string,
  onClose: () => void
): StandardPreviewProps {
  return {
    title: row.name,
    onClose,
    onOpenFull: () => {},
    headerExtra: row.locked ? (
      <LifecycleLockBadge label={row.locked.label} reason={row.locked.reason} />
    ) : undefined,
    meta: {
      pills: [
        { label: STATUS_LABEL[row.status], tone: STATUS_TONE[row.status] },
        { label: domainTitle, tone: 'neutral' },
      ],
      trailing: <span className="text-[11px] font-semibold text-c-text-secondary">{row.updatedAt}</span>,
      recommendation: row.locked
        ? row.locked.reason
        : 'AI recommendation: on track — no action needed this cycle.',
    },
    details: {
      showWordCount: false,
      properties: [
        { id: 'owner', label: 'Owner', value: row.owner },
        {
          id: 'metric',
          label: row.metricLabel,
          value: <HonestValueCell value={row.metricValue} />,
        },
        { id: 'status', label: 'Status', value: STATUS_LABEL[row.status] },
      ],
    },
    ai: {
      hints: ['Summarize record', 'Suggest next steps'],
      disabled: true,
      disabledTooltip: 'Coming soon',
    },
    relations: [],
    actions: row.locked
      ? { informational: [{ id: 'noop', variant: 'neutral', label: 'Locked', onClick: () => {}, disabled: true }] }
      : {
          resolutions: [
            { id: 'approve', variant: 'positive', label: 'Approve', onClick: () => {} },
          ],
          informational: [
            { id: 'delegate', variant: 'neutral', label: 'Delegate', onClick: () => {} },
          ],
        },
  };
}

const params = new URLSearchParams(window.location.search);
const domain = (params.get('domain') as ResultsVNextDomain) || 'kpi';
const state = params.get('state') || 'ready';
const reason = (params.get('reason') as ResultsVNextDenyReason) || 'NO_VISIBILITY_RECORD';
const initialSelected = params.get('selected');

const ResultsVNextRegistryShellScreen: React.FC = () => {
  const vocab = DOMAIN_VOCAB[domain];
  const columns = buildColumns();
  const [selectedId, setSelectedId] = useState<string | null>(
    initialSelected === 'none' ? null : (initialSelected ?? vocab.rows[0]?.id ?? null)
  );

  const selectedRow = vocab.rows.find((r) => r.id === selectedId) ?? null;

  const table: ResultsVNextTableProps = {
    columns,
    data: state === 'empty' ? [] : (vocab.rows as unknown as Array<Record<string, unknown> & { id: string }>),
    persistKey: `results-vnext.${domain}-registry`,
    loading: state === 'loading',
    error: state === 'error' ? 'Failed to load registry — the upstream service returned a 503.' : null,
    onRetry: () => {},
    empty:
      state === 'empty'
        ? {
            title: `No ${domain.toUpperCase()}s yet`,
            description: 'Create the first record to start tracking this registry.',
            actionLabel: `New ${domain.toUpperCase()}`,
            onAction: () => {},
          }
        : undefined,
    selectedRowId: selectedId,
    onRowClick: (row) => setSelectedId(String((row as unknown as MockRow).id)),
    rowMenu: (row) => buildRowMenu(row as unknown as MockRow),
    defaultSort: { columnId: 'updatedAt', direction: 'desc' },
  };

  return (
    <div className="h-screen bg-c-bg text-c-text">
      <ResultsVNextRegistryShell
        domain={domain}
        moduleBar={{
          tabs: [
            { id: 'my', label: 'My' },
            { id: 'org', label: 'Org' },
          ],
          activeTab: 'my',
          onTabChange: () => {},
          showTabCounts: false,
          viewModes: ['table'],
          viewMode: 'table',
          primaryCta: { label: `New ${domain.toUpperCase()}`, onClick: () => {} },
          chips: [
            { id: 'all', label: 'All', count: vocab.rows.length },
            { id: 'locked', label: 'Locked', count: vocab.rows.filter((r) => r.locked).length },
            {
              id: 'not_calculable',
              label: 'Not calculable',
              count: vocab.rows.filter((r) => r.metricValue === 'not_calculable').length,
            },
          ],
          activeChip: 'all',
          onChipChange: () => {},
        }}
        table={state === 'ready' || state === 'loading' || state === 'empty' || state === 'error' ? table : table}
        preview={
          state === 'ready' && selectedRow
            ? buildPreview(selectedRow, vocab.title, () => setSelectedId(null))
            : null
        }
        forbidden={state === 'forbidden' ? { reason } : null}
        onForbiddenBack={() => {}}
      />
    </div>
  );
};

export default ResultsVNextRegistryShellScreen;
