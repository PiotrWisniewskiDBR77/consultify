import { Copy, Lightbulb } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { StandardPreview, StandardTable } from '@/components/standard';
import { getInitiativeStatusChipTone } from '@/services/initiativeLifecycle';
import { PreviewActionBar } from '@/components/shared/PreviewPane/PreviewActionBar';

import { TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import {
  createInitiativeRegisterColumns,
  createInitiativeRegisterRowMenu,
  formatPlannedWindow,
  INITIATIVE_REGISTER_COLUMN_IDS,
  type InitiativeRegisterColumnOptions,
  type InitiativeRegisterRow,
} from './initiativeRegisterColumns.shared';
import {
  INITIATIVE_GATE_NAME_LABELS,
  INITIATIVE_GATE_READINESS_LABELS,
  INITIATIVE_LIFECYCLE_LABELS,
  INITIATIVE_SOURCE_FRESHNESS_LABELS,
} from './initiativeRegisterProjection';

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
  /**
   * A19/A13 — różnice kontekstu (np. „Źródło: ocena X") wchodzą jako opcjonalne
   * kolumny TEJ SAMEJ definicji, nigdy jako druga tabela.
   */
  columnOptions?: InitiativeRegisterColumnOptions;
  /** CTA pustego stanu specyficzne dla powierzchni (np. „Wygeneruj inicjatywy" w Ocenie). */
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
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
  columnOptions,
  emptyActionLabel,
  onEmptyAction,
}: CanonicalInitiativeRegisterProps) => {
  const { t } = useTranslation();
  const includeSource = !!columnOptions?.includeSource;
  const columns = useMemo(
    () => createCanonicalInitiativeRegisterColumns({ includeSource, t }),
    [includeSource, t]
  );
  const layoutRows = useMemo(
    () => rows.map((row) => ({ ...row, title: row.title || row.name })),
    [rows]
  );
  const selected = layoutRows.find((row) => row.id === selectedId) ?? null;
  const renderPreview = (initiative: CanonicalInitiativeRow) => (
    <StandardPreview
      title={initiative.name || 'Inicjatywa bez nazwy'}
      embedded
      meta={{
        pills: [
          {
            label: INITIATIVE_LIFECYCLE_LABELS[String(initiative.displayStatus)] || 'Nieznany',
            tone: getInitiativeStatusChipTone(initiative.status, { onHold: initiative.onHold }),
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
        recommendation: String(initiative.nextAction || '—'),
      }}
      details={{
        label: 'Kontekst inicjatywy',
        text: initiative.summary || initiative.description || 'Brak opisu.',
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
              initiative.ownerBusiness?.firstName || initiative.ownerExecution?.firstName || '—',
          },
          {
            id: 'impact',
            label: 'Oczekiwany efekt',
            value:
              initiative.expectedImpact && String(initiative.expectedImpact) !== 'UNKNOWN'
                ? String(initiative.expectedImpact)
                : 'Nieznany',
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
        <PreviewActionBar
          rows={[
            {
              columns: 2,
              buttons: [
                {
                  label: 'Kopiuj link',
                  icon: Copy,
                  colorScheme: 'neutral',
                  onClick: () => void navigator.clipboard?.writeText(initiative.id),
                },
              ],
            },
          ]}
        />
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
        rowClassName={(raw) => (raw as CanonicalInitiativeRow).archived ? 'opacity-60' : ''}
        defaultSort={{ columnId: 'updatedAt', direction: 'desc' }}
        persistKey={persistKey}
        empty={{
          icon: Lightbulb,
          title: emptyTitle,
          description: emptyDescription,
          actionLabel: onEmptyAction
            ? emptyActionLabel || 'Wygeneruj inicjatywy'
            : onResetFilters
              ? 'Wyczyść filtry'
              : undefined,
          onAction: onEmptyAction || onResetFilters,
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
