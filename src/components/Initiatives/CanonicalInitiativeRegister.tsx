import { Copy, Lightbulb } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { enumLabel, isKnownEnumValue } from '@/utils/enumLabel';

import { StandardPreview, StandardTable } from '@/components/standard';
import { getInitiativeStatusChipTone, getLocalizedStatusLabel } from '@/services/initiativeLifecycle';
import { PreviewActionBar } from '@/components/shared/PreviewPane/PreviewActionBar';

import { TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import { InitiativeLifecycleActions } from './lifecycle/InitiativeLifecycleActions';
import {
  createInitiativeRegisterColumns,
  createInitiativeRegisterRowMenu,
  formatPlannedWindow,
  INITIATIVE_REGISTER_COLUMN_IDS,
  type InitiativeRegisterColumnOptions,
  type InitiativeRegisterRow,
} from './initiativeRegisterColumns.shared';


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
            // Dowód 07.09 (zrzut 04): `displayStatus` zna tylko stany runtime-v1, więc
            // „Do zatwierdzenia" świeciło w podglądzie jako „Nieznany", gdy wiersz obok
            // mówił poprawnie. Etykieta 7 statusów DEC-424 jest źródłem zapasowym.
            label: initiative.onHold
              ? t('initiatives.status.ON_HOLD', 'Wstrzymana')
              : (isKnownEnumValue('initiativeLifecycle', String(initiative.displayStatus))
                  ? enumLabel('initiativeLifecycle', String(initiative.displayStatus), t)
                  : '') ||
                getLocalizedStatusLabel(
                String(initiative.status) as Parameters<typeof getLocalizedStatusLabel>[0],
                t
              ),
            tone: getInitiativeStatusChipTone(initiative.status, { onHold: initiative.onHold }),
          },
          {
            label:
              // J17: enum przez slownik — nieznana wartosc daje „Unknown"/„Nieznane",
              // nigdy surowego stringa z bazy.
              enumLabel('initiativeGateReadiness', initiative.gateReadiness, t),
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
        label: t('initiatives.canonical.contextLabel', 'Initiative context'),
        text:
          initiative.summary ||
          initiative.description ||
          t('initiatives.canonical.noDescription', 'No description.'),
        properties: [
          {
            id: 'gate',
            label: t('initiatives.columns.gateName', 'Next gate'),
            value: initiative.gateName ? enumLabel('initiativeGateName', initiative.gateName, t) : '—',
          },
          {
            id: 'readiness',
            label: t('initiatives.columns.gateReadiness', 'Readiness'),
            value: enumLabel('initiativeGateReadiness', initiative.gateReadiness, t),
          },
          {
            id: 'owner',
            label: t('initiatives.columns.owner', 'Owner'),
            value:
              initiative.ownerBusiness?.firstName || initiative.ownerExecution?.firstName || '—',
          },
          {
            id: 'impact',
            label: t('initiatives.columns.expectedImpact', 'Expected impact'),
            value:
              initiative.expectedImpact && String(initiative.expectedImpact) !== 'UNKNOWN'
                ? String(initiative.expectedImpact)
                : t('enums.unknown', 'Unknown'),
          },
          {
            id: 'window',
            label: t('initiatives.columns.plannedWindow', 'Planned window'),
            value: formatPlannedWindow(initiative.plannedWindow),
          },
          {
            id: 'freshness',
            label: t('initiatives.columns.source', 'Source'),
            value: enumLabel('initiativeSourceFreshness', initiative.sourceFreshness, t),
          },
        ],
        onCopy: () =>
          void navigator.clipboard?.writeText(`${initiative.name} — ${initiative.status}`),
      }}
      relations={relationForRow?.(initiative) || []}
    >
      {/*
        Łańcuch zarządzania (DEC-424/DEC-453): JEDYNE miejsce w rejestrze
        Inicjatyw, gdzie zmienia się etap. Rola decyduje o widoczności przycisku,
        warunek — o jego aktywności (powód obok), powód wymagany — o oknie.
        Kebab wiersza NIE dubluje tych akcji (doktryna gęstości §1).
      */}
      <InitiativeLifecycleActions
        initiativeId={initiative.id}
        density="full"
        heading={t('initiatives.lifecycle.heading', 'Etap inicjatywy')}
        className="mt-4"
      />
    </StandardPreview>
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
