import { Copy, ExternalLink, Lightbulb } from 'lucide-react';
import React, { useMemo } from 'react';

import {
  StandardPreview,
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
} from '@/components/standard';
import { statusChipTone } from '@/components/ui/primitives/chips';
import type { PortfolioInitiative } from '@/types';
import { formatListDate, formatRelativeHint } from '@/utils/listDateFormat';

import { TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import {
  INITIATIVE_GATE_NAME_LABELS,
  INITIATIVE_GATE_READINESS_LABELS,
  INITIATIVE_HEALTH_STATE_LABELS,
  INITIATIVE_IMPACT_CONFIDENCE_LABELS,
  INITIATIVE_LIFECYCLE_LABELS,
} from './initiativeRegisterProjection';

/**
 * "Planowane okno" w danych demo/rejestrze jest jednym stringiem
 * `"<ISO start> / <ISO end>"` (patrz `initiativesDemoData.ts`,
 * `initiativeRegisterProjection.ts`). Kanon dat (`formatListDate`, SSOT
 * `src/utils/listDateFormat.ts`) formatuje jedną wartość naraz — ta funkcja
 * rozdziela parę i renderuje ją jako jedną linię „od — do" zamiast surowych
 * znaczników ISO łamanych na kilka linii (defekt zgłoszony w audycie 2026-08-31).
 */
const formatPlannedWindow = (raw: unknown): string => {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return '—';
  const [start, end] = value.split('/').map((part) => part.trim());
  const startLabel = formatListDate(start, '');
  const endLabel = formatListDate(end, '');
  if (!startLabel && !endLabel) return '—';
  if (!endLabel) return startLabel;
  if (!startLabel) return endLabel;
  return `${startLabel} — ${endLabel}`;
};

export const CANONICAL_INITIATIVE_REGISTER_COLUMN_IDS = [
  'name',
  'status',
  'gateName',
  'gateReadiness',
  'owner',
  'nextAction',
  'expectedImpact',
  'plannedWindow',
  'healthState',
  'updatedAt',
] as const;

type CanonicalInitiativeRow = PortfolioInitiative & {
  canonicalVersion?: number;
  gateName?: string;
  gateReadiness?: string;
  nextAction?: string;
  expectedImpact?: string;
  impactConfidence?: string;
  plannedWindow?: string | null;
  healthState?: string;
  sourceFreshness?: string;
};

export interface CanonicalInitiativeRegisterProps {
  rows: CanonicalInitiativeRow[];
  selectedId: string | null;
  onSelect: (row: CanonicalInitiativeRow | null) => void;
  onOpen: (row: CanonicalInitiativeRow) => void;
  persistKey: string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle: string;
  emptyDescription: string;
  previewOpen?: boolean;
  onResetFilters?: () => void;
  relationForRow?: (row: CanonicalInitiativeRow) => Array<{ label: string; onClick?: () => void }>;
}

const statusDotClass = (status: string): string => {
  const tone = statusChipTone(status);
  return tone === 'info'
    ? 'bg-c-info'
    : tone === 'warning'
      ? 'bg-c-warning'
      : tone === 'success'
        ? 'bg-c-success'
        : tone === 'danger'
          ? 'bg-c-danger'
          : 'bg-c-text-muted';
};

export const createCanonicalInitiativeRegisterColumns = (): TableColumn[] => [
  {
    id: 'name',
    label: 'Inicjatywa',
    width: '220px',
    render: (raw) => {
      const row = raw as CanonicalInitiativeRow;
      return (
        <div className="min-w-0">
          <span className="block truncate text-sm font-semibold text-c-text">{row.name}</span>
          <span className="block truncate text-xs text-c-text-muted">
            {row.summary || 'Brak opisu problemu'}
          </span>
        </div>
      );
    },
  },
  {
    id: 'status',
    label: 'Cykl życia',
    width: '170px',
    filterable: true,
    filterOptions: Object.entries(INITIATIVE_LIFECYCLE_LABELS).map(([value, label]) => ({
      value,
      label,
    })),
    render: (raw) => {
      const row = raw as CanonicalInitiativeRow;
      const lifecycle = String(row.displayStatus || 'UNKNOWN');
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-c-text-secondary">
          <span
            className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${statusDotClass(row.status)}`}
          />
          {INITIATIVE_LIFECYCLE_LABELS[lifecycle] || 'UNKNOWN'}
        </span>
      );
    },
  },
  {
    id: 'gateName',
    label: 'Następna bramka',
    width: '175px',
    render: (raw) => {
      const value = String((raw as CanonicalInitiativeRow).gateName || '');
      const label = value ? INITIATIVE_GATE_NAME_LABELS[value] || value : '—';
      return (
        <span className="block truncate text-xs text-c-text-secondary" title={label}>
          {label}
        </span>
      );
    },
  },
  {
    id: 'gateReadiness',
    label: 'Gotowość',
    width: '150px',
    render: (raw) => {
      const readiness = String((raw as CanonicalInitiativeRow).gateReadiness || 'UNKNOWN');
      const label = INITIATIVE_GATE_READINESS_LABELS[readiness] || readiness.replaceAll('_', ' ');
      return (
        <span className="block truncate text-xs font-medium text-c-text-secondary" title={label}>
          {label}
        </span>
      );
    },
  },
  {
    id: 'owner',
    label: 'Właściciel',
    width: '150px',
    render: (raw) => {
      const row = raw as CanonicalInitiativeRow;
      const owner = row.ownerBusiness || row.ownerExecution;
      const name = owner ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || '—' : '—';
      return <span className="block truncate text-xs text-c-text-secondary">{name}</span>;
    },
  },
  {
    id: 'nextAction',
    label: 'Następne działanie',
    width: '160px',
    render: (raw) => (
      <span className="text-xs font-medium text-c-text">
        {String((raw as CanonicalInitiativeRow).nextAction || 'UNKNOWN')}
      </span>
    ),
  },
  {
    id: 'expectedImpact',
    label: 'Oczekiwany efekt',
    width: '160px',
    render: (raw) => {
      const row = raw as CanonicalInitiativeRow;
      const confidence = String(row.impactConfidence || 'UNKNOWN');
      return (
        <div className="min-w-0 text-xs">
          <span className="block truncate text-c-text-secondary">
            {String(row.expectedImpact || 'UNKNOWN')}
          </span>
          <span className="text-c-text-muted">
            Pewność: {INITIATIVE_IMPACT_CONFIDENCE_LABELS[confidence] || confidence}
          </span>
        </div>
      );
    },
  },
  {
    id: 'plannedWindow',
    label: 'Planowane okno',
    width: '215px',
    render: (raw) => {
      const label = formatPlannedWindow((raw as CanonicalInitiativeRow).plannedWindow);
      return (
        <span className="block truncate text-xs text-c-text-muted" title={label}>
          {label}
        </span>
      );
    },
  },
  {
    id: 'healthState',
    label: 'Kondycja',
    width: '110px',
    render: (raw) => {
      const value = String((raw as CanonicalInitiativeRow).healthState || 'N/A');
      const label = INITIATIVE_HEALTH_STATE_LABELS[value] || value;
      return (
        <span className="block truncate text-xs text-c-text-muted" title={label}>
          {label}
        </span>
      );
    },
  },
  {
    id: 'updatedAt',
    label: 'Aktualizacja',
    width: '220px',
    align: 'right',
    sortable: true,
    sortAccessor: (raw) => {
      const value = (raw as CanonicalInitiativeRow).updatedAt;
      return value ? new Date(value).getTime() : 0;
    },
    render: (raw) => {
      const value = (raw as CanonicalInitiativeRow).updatedAt;
      const relative = formatRelativeHint(value, new Date());
      return (
        <span className="text-xs tabular-nums text-c-text-muted" title={formatListDate(value, '')}>
          {relative || '—'}
        </span>
      );
    },
  },
];

export const CanonicalInitiativeRegister = ({
  rows,
  selectedId,
  onSelect,
  onOpen,
  persistKey,
  loading,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
  previewOpen,
  onResetFilters,
  relationForRow,
}: CanonicalInitiativeRegisterProps) => {
  const columns = useMemo(() => createCanonicalInitiativeRegisterColumns(), []);
  const layoutRows = useMemo(
    () => rows.map((row) => ({ ...row, title: row.title || row.name })),
    [rows]
  );
  const selected = layoutRows.find((row) => row.id === selectedId) ?? null;
  const renderPreview = (initiative: CanonicalInitiativeRow) => (
    <StandardPreview
      title={initiative.name || 'Untitled initiative'}
      embedded
      meta={{
        pills: [
          {
            label: INITIATIVE_LIFECYCLE_LABELS[String(initiative.displayStatus)] || 'UNKNOWN',
            tone: statusChipTone(initiative.status),
          },
          {
            label:
              INITIATIVE_GATE_READINESS_LABELS[String(initiative.gateReadiness || 'UNKNOWN')] ||
              String(initiative.gateReadiness || 'UNKNOWN'),
            tone: 'neutral',
          },
        ],
        trailing: (
          <span className="text-[11px] font-semibold text-c-text-secondary">
            v{String(initiative.canonicalVersion || '—')}
          </span>
        ),
        recommendation: String(initiative.nextAction || 'UNKNOWN'),
      }}
      details={{
        label: 'Kontekst inicjatywy',
        text: initiative.summary || initiative.description || 'No description.',
        properties: [
          {
            id: 'gate',
            label: 'Następna bramka',
            value: initiative.gateName
              ? INITIATIVE_GATE_NAME_LABELS[initiative.gateName] || initiative.gateName
              : '—',
          },
          {
            id: 'readiness',
            label: 'Gotowość',
            value:
              INITIATIVE_GATE_READINESS_LABELS[String(initiative.gateReadiness || 'UNKNOWN')] ||
              String(initiative.gateReadiness || 'UNKNOWN'),
          },
          {
            id: 'owner',
            label: 'Właściciel',
            value:
              initiative.ownerBusiness?.firstName ||
              initiative.ownerExecution?.firstName ||
              'UNASSIGNED',
          },
          {
            id: 'impact',
            label: 'Oczekiwany efekt',
            value: String(initiative.expectedImpact || 'UNKNOWN'),
          },
          {
            id: 'window',
            label: 'Planowane okno',
            value: formatPlannedWindow(initiative.plannedWindow),
          },
          {
            id: 'freshness',
            label: 'Źródło',
            value: String(initiative.sourceFreshness || 'UNKNOWN'),
          },
        ],
        onCopy: () =>
          void navigator.clipboard?.writeText(`${initiative.name} — ${initiative.status}`),
      }}
      relations={relationForRow?.(initiative) || []}
    />
  );

  return (
    <TableWithPreviewLayout<(typeof layoutRows)[number]>
      selectedId={selectedId}
      selectedItem={selected}
      onSelect={(id) => onSelect(layoutRows.find((row) => row.id === id) ?? null)}
      onOpenFull={(id) => {
        const row = layoutRows.find((candidate) => candidate.id === id);
        if (row) onOpen(row);
      }}
      itemIds={layoutRows.map((row) => row.id)}
      getItemById={(id) => layoutRows.find((row) => row.id === id) ?? null}
      renderPreview={renderPreview}
      previewOpen={previewOpen}
      renderPreviewFooter={(initiative) => (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onOpen(initiative)}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-emerald-300/40 bg-emerald-50 px-3 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100/70 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
          >
            <ExternalLink size={13} />
            Otwórz
          </button>
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(initiative.id)}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-c-border bg-c-surface px-3 text-xs font-medium text-c-text-secondary transition-colors hover:bg-c-surface-raised"
          >
            <Copy size={13} />
            Kopiuj link
          </button>
        </div>
      )}
    >
      <StandardTable
        columns={columns}
        data={rows}
        loading={loading}
        error={error}
        onRetry={onRetry}
        selectedRowId={selectedId}
        onRowClick={(raw) => onSelect(raw as CanonicalInitiativeRow)}
        onRowDoubleClick={(raw) => onOpen(raw as CanonicalInitiativeRow)}
        rowDescription={(raw) => (raw as CanonicalInitiativeRow).summary || null}
        defaultSort={{ columnId: 'updatedAt', direction: 'desc' }}
        persistKey={persistKey}
        empty={{
          icon: Lightbulb,
          title: emptyTitle,
          description: emptyDescription,
          actionLabel: onResetFilters ? 'Wyczyść filtry' : undefined,
          onAction: onResetFilters,
        }}
        rowMenu={(raw): StandardRowMenu => {
          const row = raw as CanonicalInitiativeRow;
          return {
            primary: [
              { id: 'open', label: 'Otwórz', icon: ExternalLink, onClick: () => onOpen(row) },
            ],
            universalHandlers: {
              preview: () => onSelect(row),
              archiveNote:
                'Zmiany lifecycle i archiwizacja są wykonywane w kontrolowanym procesie.',
            },
          };
        }}
      />
    </TableWithPreviewLayout>
  );
};
