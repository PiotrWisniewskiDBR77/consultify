import { Copy, ExternalLink, Lightbulb } from 'lucide-react';
import React, { useMemo } from 'react';

import { StandardPreview, StandardTable } from '@/components/standard';

import { TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import {
  createInitiativeRegisterColumns,
  createInitiativeRegisterRowMenu,
  INITIATIVE_REGISTER_COLUMN_IDS,
  type InitiativeRegisterRow,
} from './initiativeRegisterColumns.shared';
import { INITIATIVE_SOURCE_FRESHNESS_LABELS } from './initiativeRegisterProjection';

/**
 * "Planowane okno" w danych demo/rejestrze jest jednym stringiem
 * `"<ISO start> / <ISO end>"` (patrz `initiativesDemoData.ts`,
 * `initiativeRegisterProjection.ts`). Kanon dat (`formatListDate`, SSOT
 * `src/utils/listDateFormat.ts`) formatuje jedną wartość naraz — ta funkcja
 * rozdziela parę i renderuje ją jako jedną linię „od — do" zamiast surowych
 * znaczników ISO łamanych na kilka linii (defekt zgłoszony w audycie 2026-08-31).
 */
export const CANONICAL_INITIATIVE_REGISTER_COLUMN_IDS = INITIATIVE_REGISTER_COLUMN_IDS;
export const createCanonicalInitiativeRegisterColumns = createInitiativeRegisterColumns;
type CanonicalInitiativeRow = InitiativeRegisterRow;

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
            value:
              INITIATIVE_SOURCE_FRESHNESS_LABELS[String(initiative.sourceFreshness || 'UNKNOWN')] ||
              String(initiative.sourceFreshness || 'UNKNOWN'),
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
        rowMenu={(raw) =>
          createInitiativeRegisterRowMenu({
            row: raw as CanonicalInitiativeRow,
            onOpen,
            onPreview: onSelect,
          })
        }
      />
    </TableWithPreviewLayout>
  );
};
