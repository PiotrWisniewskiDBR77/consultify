/**
 * [ODMROZENIE 05_INITIATIVES DEC-495] A2 (DEC-498 §1) — lista parkingu.
 *
 * Slowa wlasciciela: „jak nie to idzie na parking albo do archiwum (...). Warto je
 * zatrzymac z informacja dlaczego nie weszla aby system jej nie proponowal znowu
 * albo proponowal jak przeszkoda przestanie ja blokowac."
 *
 * Ekran listowy => WYLACZNIE `StandardTable` + `StandardPreview` (kanon TRIADY,
 * CLAUDE.md UI #1/#9). Zero wlasnej tabeli, zero `primary-*`.
 *
 * Zrodlem sa REALNE decyzje czlowieka (`/portfolio-dispositions`), nie propozycje
 * AI — na liscie parkingu jest tylko to, co ktos faktycznie zaparkowal.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { TableWithPreviewLayout } from '@/components/shared/TableWithPreviewLayout';
import { StandardPreview } from '@/components/standard/StandardPreview';
import {
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard/StandardTable';
import {
  listPortfolioDispositions,
  type PortfolioDispositionItem,
  RuntimeApiError,
} from '@/services/initiatives-execution/runtimeApi';

interface ParkingRow extends TableRow {
  id: string;
  /** `title` jest wymagane przez kontrakt `TableWithPreviewLayout.PreviewableItem`. */
  title: string;
  initiative: string;
  kindLabel: string;
  reason: string;
  returnCondition: string;
  decidedAt: string;
  item: PortfolioDispositionItem;
}

const columns: TableColumn[] = [
  { id: 'initiative', label: 'Initiative', sortable: true, width: '260px' },
  { id: 'kindLabel', label: 'Disposition', sortable: true, width: '150px' },
  { id: 'reason', label: 'Reason it did not enter', sortable: true },
  { id: 'returnCondition', label: 'Return condition', sortable: true },
  { id: 'decidedAt', label: 'Decided', sortable: true, width: '170px' },
];

export function InitiativeParkingView({
  scopeKey,
  initiativeName,
}: {
  scopeKey: string;
  /** Nazwa inicjatywy z rejestru; gdy brak — pokazujemy identyfikator, nie zmyslamy. */
  initiativeName?: (initiativeId: string) => string | undefined;
}) {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage || i18n.language || 'en';
  const [items, setItems] = useState<PortfolioDispositionItem[]>([]);
  const [state, setState] = useState<'LOADING' | 'READY' | 'ERROR'>('LOADING');
  const [message, setMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setState('LOADING');
    setMessage(null);
    setItems([]);
    setSelectedId(null);
    listPortfolioDispositions(undefined, controller.signal)
      .then((rows) => {
        if (controller.signal.aborted) return;
        setItems(rows);
        setSelectedId(rows[0]?.decisionId ?? null);
        setState('READY');
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState('ERROR');
        setMessage(error instanceof RuntimeApiError ? error.code : 'PARKING_UNAVAILABLE');
      });
    return () => controller.abort();
  }, [scopeKey]);

  const label = useCallback(
    (item: PortfolioDispositionItem) =>
      initiativeName?.(item.initiativeId)?.trim() || item.initiativeId,
    [initiativeName]
  );

  const rows = useMemo<ParkingRow[]>(
    () =>
      items.map((item) => ({
        id: item.decisionId,
        title: label(item),
        initiative: label(item),
        kindLabel: t(`initiatives.analysis.${item.kind.toLowerCase()}`, item.kind),
        reason: item.reason,
        returnCondition:
          item.returnCondition ?? t('initiatives.parking.noReturnCondition', 'Not stated'),
        decidedAt: item.decidedAt ? new Date(item.decidedAt).toLocaleString(locale) : '—',
        item,
      })),
    [items, label, locale, t]
  );
  const selected = rows.find((row) => row.id === selectedId) ?? null;

  return (
    <section
      className="flex h-full min-h-0 flex-col"
      aria-label={t('initiatives.parking.title', 'Parking')}
    >
      {message ? (
        <p className="px-4 py-2 text-sm text-c-text-secondary" role="alert">
          {message}
        </p>
      ) : null}
      <div className="flex min-h-0 flex-1" data-testid="initiatives-parking-table">
        <div className="min-w-0 flex-1">
          <TableWithPreviewLayout<ParkingRow>
            key={scopeKey}
            selectedId={selectedId}
            selectedItem={selected}
            onSelect={setSelectedId}
            itemIds={rows.map((row) => row.id)}
            openDisabledReason={t(
              'initiatives.parking.noFullView',
              'A parking entry has no page of its own — it is the reason a decision was recorded.'
            )}
            renderPreview={(row) => (
              <div data-testid="initiatives-parking-preview">
                <StandardPreview
                  embedded
                  title={row.initiative}
                  meta={{
                    pills: [{ label: row.kindLabel, tone: 'neutral' }],
                    trailing: <span>{row.decidedAt}</span>,
                  }}
                  details={{
                    text: row.reason,
                    properties: [
                      {
                        id: 'returnCondition',
                        label: t('initiatives.parking.returnCondition', 'Return condition'),
                        value: row.returnCondition,
                      },
                      {
                        id: 'decidedBy',
                        label: t('initiatives.parking.decidedBy', 'Decided by'),
                        value: row.item.actorId || '—',
                      },
                      {
                        id: 'analysis',
                        label: t('initiatives.parking.analysis', 'Analysis'),
                        value: row.item.analysisId ?? '—',
                      },
                    ],
                  }}
                  relations={[
                    { id: row.item.initiativeId, label: row.initiative, type: 'initiative' },
                  ]}
                />
              </div>
            )}
          >
            <StandardTable
              columns={columns.map((column) => ({
                ...column,
                label: t(`initiatives.parking.columns.${column.id}`, column.label),
              }))}
              data={rows}
              loading={state === 'LOADING'}
              error={state === 'ERROR' ? message : null}
              selectedRowId={selectedId}
              onRowClick={(row) => setSelectedId(row.id)}
              persistKey="initiatives.parking.items"
              empty={{
                title: t('initiatives.parking.empty', 'Nothing is parked'),
                description: t(
                  'initiatives.parking.emptyDescription',
                  'Initiatives sent to parking or archive from the analysis appear here with the reason they did not enter.'
                ),
              }}
            />
          </TableWithPreviewLayout>
        </div>
      </div>
    </section>
  );
}
