/**
 * Zlecenie → zakładka REZULTATY.
 *
 * Rezultaty to OBIEKTY DOMENOWE, nie lista wygenerowanych plików
 * (`02_INFORMATION_ARCHITECTURE_AND_UX.md` §7): cztery osie zamknięcia,
 * zmierzona wartość i powiązane obiekty z innych modułów.
 *
 * Wartość rozróżnia punkt wyjścia, cel, wynik i pewność pomiaru — a stan
 * „brak dowodu" jest osobny od „nieosiągnięte". UI tego nie spłaszcza.
 */

import { BarChart3, Link2 } from 'lucide-react';
import React, { useMemo, useState } from 'react';

import { StandardPreview } from '@/components/standard/StandardPreview';
import { StandardTable, type TableColumn } from '@/components/standard/StandardTable';
import {
  artifactLinkRelationLabel,
  artifactLinkStatusLabel,
  closureAxisLabel,
  closureAxisStatusLabel,
  closureTypeLabel,
  linkedTypeLabel,
  measurementConfidenceLabel,
  valueMeasurementStatusLabel,
} from '@/utils/enumLabels';

import type { CaseArtifactLink, CaseCoreView, ValueMeasurement } from './types';
import { formatDate, formatDateTime, StatusTag, TechnicalId } from './ui';

export interface RezultatyViewProps {
  caseItem: CaseCoreView;
  measurements: ValueMeasurement[];
  artifactLinks: CaseArtifactLink[];
  expert?: boolean;
}

type Selection = { kind: 'pomiar'; id: string } | { kind: 'obiekt'; id: string } | null;

function axisTone(status: string): 'success' | 'warning' | 'neutral' {
  if (status === 'COMPLETED' || status === 'VALIDATED') return 'success';
  if (status === 'PENDING') return 'warning';
  return 'neutral';
}

function measurementTone(
  status: ValueMeasurement['measurementStatus']
): 'success' | 'warning' | 'critical' | 'neutral' {
  if (status === 'CONFIRMED') return 'success';
  if (status === 'NOT_ACHIEVED') return 'critical';
  if (status === 'PARTIAL' || status === 'EVIDENCE_MISSING') return 'warning';
  return 'neutral';
}

function formatValue(value: number | null, unit: string | null): string {
  if (value === null || value === undefined) return '—';
  const number = new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 2 }).format(value);
  return unit ? `${number} ${unit}` : number;
}

export const RezultatyView: React.FC<RezultatyViewProps> = ({
  caseItem,
  measurements,
  artifactLinks,
  expert,
}) => {
  const [selection, setSelection] = useState<Selection>(null);

  const axes = useMemo(
    () => [
      { key: 'delivery', status: caseItem.deliveryStatus },
      { key: 'decision', status: caseItem.decisionStatus },
      { key: 'implementation', status: caseItem.implementationStatus },
      { key: 'outcome', status: caseItem.outcomeStatus },
    ],
    [caseItem]
  );

  const measurementRows = useMemo(
    () =>
      measurements.map((item) => ({
        id: item.measurementId,
        wskaznik: item.metricName || item.metricKey,
        punktWyjscia: formatValue(item.baselineValue, item.baselineUnit),
        cel: formatValue(item.targetValue, item.targetUnit),
        wynik: formatValue(item.actualValue, item.actualUnit),
        stan: valueMeasurementStatusLabel(item.measurementStatus, true),
        stanTone: measurementTone(item.measurementStatus),
        pewnosc: measurementConfidenceLabel(item.confidence, true),
        pomiar: item.measurementDate,
      })),
    [measurements]
  );

  const linkRows = useMemo(
    () =>
      artifactLinks.map((link) => ({
        id: link.linkId,
        obiekt: linkedTypeLabel(link.artifactType, true),
        rola: artifactLinkRelationLabel(link.relation, true),
        stan: link.isStale ? 'Nieaktualny' : artifactLinkStatusLabel(link.linkStatus, true),
        stanTone: link.isStale || link.linkStatus === 'UNAVAILABLE' ? 'warning' : 'neutral',
        dodane: link.linkedAt,
      })),
    [artifactLinks]
  );

  const measurementColumns: TableColumn[] = [
    {
      id: 'wskaznik',
      label: 'Co mierzymy',
      width: '240px',
      sortable: true,
      render: (row: Record<string, unknown>) => (
        <span className="text-sm font-medium text-c-text">{String(row.wskaznik)}</span>
      ),
    },
    { id: 'punktWyjscia', label: 'Punkt wyjścia', width: '140px', align: 'right' },
    { id: 'cel', label: 'Cel', width: '120px', align: 'right' },
    { id: 'wynik', label: 'Wynik', width: '120px', align: 'right' },
    {
      id: 'stan',
      label: 'Stan pomiaru',
      width: '180px',
      filterable: true,
      render: (row: Record<string, unknown>) => (
        <StatusTag tone={row.stanTone as 'critical'}>{String(row.stan)}</StatusTag>
      ),
    },
    {
      id: 'pomiar',
      label: 'Data pomiaru',
      width: '140px',
      sortable: true,
      render: (row: Record<string, unknown>) => (
        <span className="text-sm text-c-text-secondary">{formatDate(String(row.pomiar))}</span>
      ),
    },
  ];

  const linkColumns: TableColumn[] = [
    {
      id: 'obiekt',
      label: 'Obiekt',
      width: '200px',
      sortable: true,
      filterable: true,
      render: (row: Record<string, unknown>) => (
        <span className="text-sm font-medium text-c-text">{String(row.obiekt)}</span>
      ),
    },
    { id: 'rola', label: 'Rola w zleceniu', width: '220px', filterable: true },
    {
      id: 'stan',
      label: 'Stan powiązania',
      width: '170px',
      render: (row: Record<string, unknown>) => (
        <StatusTag tone={row.stanTone as 'critical'}>{String(row.stan)}</StatusTag>
      ),
    },
    {
      id: 'dodane',
      label: 'Powiązane',
      width: '150px',
      sortable: true,
      render: (row: Record<string, unknown>) => (
        <span className="text-sm text-c-text-secondary">{formatDate(String(row.dodane))}</span>
      ),
    },
  ];

  const selectedMeasurement =
    selection?.kind === 'pomiar'
      ? (measurements.find((item) => item.measurementId === selection.id) ?? null)
      : null;
  const selectedLink =
    selection?.kind === 'obiekt'
      ? (artifactLinks.find((item) => item.linkId === selection.id) ?? null)
      : null;

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:flex-row">
      <div className="min-w-0 flex-1 space-y-4">
        <div className="rounded-xl border border-c-border bg-c-surface p-3 sm:p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold text-c-text">Czy zlecenie jest domknięte</h2>
            <span className="text-xs text-c-text-muted">
              Umówione zamknięcie: {closureTypeLabel(caseItem.contractedClosureType, true)}
            </span>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {axes.map((axis) => (
              <div
                key={axis.key}
                className="rounded-lg border border-c-border bg-c-surface-raised px-3 py-2"
              >
                <div className="text-xs uppercase tracking-wide text-c-text-muted">
                  {closureAxisLabel(axis.key, true)}
                </div>
                <div className="mt-1">
                  <StatusTag tone={axisTone(axis.status)}>
                    {closureAxisStatusLabel(axis.status, true)}
                  </StatusTag>
                </div>
              </div>
            ))}
          </div>
          {caseItem.closedAt ? (
            <p className="mt-3 text-sm text-c-text-secondary">
              Zamknięte {formatDateTime(caseItem.closedAt)} jako{' '}
              {closureTypeLabel(caseItem.closureType, true).toLowerCase()}.
            </p>
          ) : null}
        </div>

        <section aria-labelledby="zlecenia-wartosc" className="min-w-0">
          <h3 id="zlecenia-wartosc" className="mb-2 text-sm font-semibold text-c-text">
            Zmierzona wartość
          </h3>
          <div className="min-w-0 overflow-hidden rounded-xl border border-c-border bg-c-surface p-2 sm:p-3">
            <StandardTable
              columns={measurementColumns}
              data={measurementRows}
              selectedRowId={selection?.kind === 'pomiar' ? selection.id : null}
              onRowClick={(row) => setSelection({ kind: 'pomiar', id: String(row.id) })}
              rowDescription={() => null}
              persistKey="caseWorkspace.results.measurements"
              density="compact"
              defaultSort={{ columnId: 'pomiar', direction: 'desc' }}
              empty={{
                icon: BarChart3,
                title: 'Nic jeszcze nie zmierzono',
                description:
                  'Efekt zlecenia mierzy się po wdrożeniu. Do tego czasu ta lista pozostaje pusta — to nie jest błąd.',
              }}
            />
          </div>
        </section>

        <section aria-labelledby="zlecenia-obiekty" className="min-w-0">
          <h3 id="zlecenia-obiekty" className="mb-2 text-sm font-semibold text-c-text">
            Powiązane obiekty
          </h3>
          <div className="min-w-0 overflow-hidden rounded-xl border border-c-border bg-c-surface p-2 sm:p-3">
            <StandardTable
              columns={linkColumns}
              data={linkRows}
              selectedRowId={selection?.kind === 'obiekt' ? selection.id : null}
              onRowClick={(row) => setSelection({ kind: 'obiekt', id: String(row.id) })}
              rowDescription={() => null}
              persistKey="caseWorkspace.results.links"
              density="compact"
              defaultSort={{ columnId: 'dodane', direction: 'desc' }}
              empty={{
                icon: Link2,
                title: 'Brak powiązanych obiektów',
                description:
                  'Tu trafiają dokumenty, decyzje, inicjatywy i dowody, na których opiera się to zlecenie.',
              }}
            />
          </div>
        </section>
      </div>

      {selectedMeasurement ? (
        <aside className="w-full shrink-0 lg:w-[380px]">
          <StandardPreview
            title={selectedMeasurement.metricName || selectedMeasurement.metricKey}
            onClose={() => setSelection(null)}
            meta={{
              pills: [
                {
                  label: valueMeasurementStatusLabel(selectedMeasurement.measurementStatus, true),
                  tone: 'info',
                },
                {
                  label: measurementConfidenceLabel(selectedMeasurement.confidence, true),
                  tone: 'neutral',
                },
              ],
            }}
            details={{
              text: 'Pomiar efektu tego zlecenia.',
              showWordCount: false,
              propertyLabel: 'Właściwość',
              valueLabel: 'Wartość',
              properties: [
                {
                  id: 'baza',
                  label: 'Punkt wyjścia',
                  value: formatValue(
                    selectedMeasurement.baselineValue,
                    selectedMeasurement.baselineUnit
                  ),
                },
                {
                  id: 'cel',
                  label: 'Cel',
                  value: formatValue(
                    selectedMeasurement.targetValue,
                    selectedMeasurement.targetUnit
                  ),
                },
                {
                  id: 'wynik',
                  label: 'Wynik',
                  value: formatValue(
                    selectedMeasurement.actualValue,
                    selectedMeasurement.actualUnit
                  ),
                },
                {
                  id: 'data',
                  label: 'Data pomiaru',
                  value: formatDate(selectedMeasurement.measurementDate),
                },
                {
                  id: 'nastepny',
                  label: 'Następny pomiar',
                  value: selectedMeasurement.nextMeasurementDueAt
                    ? formatDate(selectedMeasurement.nextMeasurementDueAt)
                    : 'nie zaplanowano',
                },
                {
                  id: 'dowod',
                  label: 'Dowód',
                  value: selectedMeasurement.evidenceRef ? 'dołączony' : 'brak',
                },
              ],
            }}
          />
        </aside>
      ) : selectedLink ? (
        <aside className="w-full shrink-0 lg:w-[380px]">
          <StandardPreview
            title={linkedTypeLabel(selectedLink.artifactType, true)}
            onClose={() => setSelection(null)}
            meta={{
              pills: [
                { label: artifactLinkRelationLabel(selectedLink.relation, true), tone: 'info' },
                ...(selectedLink.isStale
                  ? [{ label: 'Nieaktualny', tone: 'warning' as const }]
                  : []),
              ],
            }}
            details={{
              text: selectedLink.isStale
                ? 'Obiekt zmienił się po powiązaniu — sprawdź, czy nadal potwierdza to, co miał potwierdzać.'
                : 'Obiekt powiązany z tym zleceniem.',
              showWordCount: false,
              propertyLabel: 'Właściwość',
              valueLabel: 'Wartość',
              properties: [
                {
                  id: 'rola',
                  label: 'Rola w zleceniu',
                  value: artifactLinkRelationLabel(selectedLink.relation, true),
                },
                {
                  id: 'stan',
                  label: 'Stan powiązania',
                  value: artifactLinkStatusLabel(selectedLink.linkStatus, true),
                },
                { id: 'dodane', label: 'Powiązane', value: formatDateTime(selectedLink.linkedAt) },
                {
                  id: 'wersja',
                  label: 'Przypięta wersja',
                  value: selectedLink.artifactRevision ?? 'zawsze najnowsza',
                },
                ...(expert
                  ? [
                      {
                        id: 'id',
                        label: 'Identyfikator obiektu',
                        value: <TechnicalId value={selectedLink.artifactId} />,
                      },
                    ]
                  : []),
              ],
            }}
          />
        </aside>
      ) : null}
    </div>
  );
};

export default RezultatyView;
