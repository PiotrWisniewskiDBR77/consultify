/**
 * AuditConclusionsTab — zakładka „Wnioski" modułu Audyty (DEC-417e, 1.1-A4).
 *
 * DECYZJA WŁAŚCICIELA 06.09 (karta 3 Audytów): „zamiast Wyniki to Wnioski — to
 * ma działać tak jak pozostałe moduły, które się kończą wnioskami, raportami
 * i inicjatywami". Zakładka „Wyniki" (Outputy jądra) przestała istnieć jako
 * zakładka; Outputy zostają ŹRÓDŁEM (finalizacja sesji w podglądzie sesji,
 * wybór źródła w generatorze raportu), a Menu 2 kończy się jak w Ocenie.
 *
 * Dane: `GET /api/conclusions` (org-wide warstwa Wniosków) filtrowane po
 * ŹRÓDLE audytu (`projekcjaWnioskowAudytu.czyWniosekZAudytu`) + JAWNY
 * `POST /api/conclusions/sync` RAZ na wejście (1.1-Z3: odczyt nie może pisać,
 * więc synchronizacja jest osobnym, jawnym wywołaniem). Brak uprawnienia do
 * synchronizacji (403) NIE blokuje listy — pokazujemy to, co już jest w bazie.
 *
 * Kanon TRIADA: `StandardTable` + `StandardPreview` w `JedenPrawyPanel`,
 * podgląd na klik wiersza i z kebaba (DEC-397b/1.1-K6). Zero `primary-*`.
 */
import { FileText, Lightbulb } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { JedenPrawyPanel } from '@/components/shared/PreviewPane/JedenPrawyPanel';
import { useJedenPanel } from '@/components/shared/PreviewPane/useJedenPanel';
import { ErrorState } from '@/components/shared/states';
import {
  StandardPreview,
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard';
import type { ArtifactPropertyRow } from '@/components/standard/ArtifactPropertiesTable';
import { StatusChip } from '@/components/ui/primitives/chips';
import { ConclusionsApi } from '@/services/api/conclusions.api';
import { formatListDate } from '@/utils/listDateFormat';

import {
  czyWniosekZAudytu,
  etykietaStanuWniosku,
  etykietaZrodlaWniosku,
  projektujWniosekAudytu,
  type WniosekAudytuWiersz,
} from '../wnioski/projekcjaWnioskowAudytu';

export interface AuditConclusionsTabProps {
  isPolish: boolean;
  /**
   * DEC-417b: filtr statusu wybrany w Menu 3 / dropdownie Menu 2 Huba.
   * `all` = bez filtra; pozostałe wartości to stany warstwy Wniosków.
   */
  statusFilter?: string;
  /** Rozkład statusów dla liczników chipów/dropdownu Menu 2 (Hub rysuje). */
  onCountsChange?: (counts: Record<string, number>) => void;
  /** Wymuszone przeładowanie po wygenerowaniu wniosku z CTA Menu 2. */
  reloadToken?: number;
}

export const AuditConclusionsTab: React.FC<AuditConclusionsTabProps> = ({
  isPolish,
  statusFilter = 'all',
  onCountsChange,
  reloadToken = 0,
}) => {
  const navigate = useNavigate();
  // DEC-397b (1.1-K6): klik wiersza / kebab „Podgląd" po zamknięciu panelu (X)
  // mają go ponownie otworzyć.
  const jedenPanel = useJedenPanel();
  const [items, setItems] = useState<WniosekAudytuWiersz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const onCountsChangeRef = useRef(onCountsChange);
  useEffect(() => {
    onCountsChangeRef.current = onCountsChange;
  }, [onCountsChange]);

  // Synchronizacja RAZ na wejście na zakładkę (nie na każdym przeładowaniu
  // listy) — `POST /api/conclusions/sync` jest zapisem, a nie odczytem.
  const zsynchronizowano = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    if (!zsynchronizowano.current) {
      zsynchronizowano.current = true;
      try {
        await ConclusionsApi.sync();
      } catch {
        // Brak prawa do synchronizacji (403) albo jej awaria nie może ukryć
        // wniosków, które już są w bazie — lecimy dalej do listy.
      }
    }
    try {
      const res = await ConclusionsApi.list();
      const wiersze = (res.conclusions ?? [])
        .filter((c) => typeof c?.id === 'string' && c.id.length > 0 && czyWniosekZAudytu(c))
        .map(projektujWniosekAudytu);
      setItems(wiersze);
    } catch (e: any) {
      setItems([]);
      setError(
        e?.status === 403
          ? isPolish
            ? 'Brak uprawnień do wniosków w tej organizacji.'
            : 'You do not have permission to view conclusions in this organization.'
          : e?.message ||
              (isPolish ? 'Nie udało się wczytać wniosków' : 'Failed to load conclusions')
      );
    } finally {
      setLoading(false);
    }
  }, [isPolish]);

  useEffect(() => {
    void load();
  }, [load, reloadToken]);

  // Liczniki Menu 3 / Menu 2 — z TEJ SAMEJ listy, którą widać w tabeli.
  useEffect(() => {
    const counts: Record<string, number> = { all: items.length };
    for (const row of items) {
      const key = row.status || 'unknown';
      counts[key] = (counts[key] ?? 0) + 1;
    }
    onCountsChangeRef.current?.(counts);
  }, [items]);

  const visibleItems = useMemo(
    () => (statusFilter === 'all' ? items : items.filter((row) => row.status === statusFilter)),
    [items, statusFilter]
  );

  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'title',
        label: isPolish ? 'Tytuł' : 'Title',
        sortable: true,
        render: (row) => (
          <span className="text-sm font-semibold text-c-text">
            {(row as unknown as WniosekAudytuWiersz).title}
          </span>
        ),
      },
      {
        // Kolumna TYP — ten sam rozdział, co na zakładce Wnioski Oceny
        // (DEC-416): wiersz nazywa rzecz po imieniu, nigdy po tytule.
        id: 'typWiersza',
        label: isPolish ? 'Typ' : 'Type',
        width: '120px',
        render: () => (
          <StatusChip label={isPolish ? 'Wniosek' : 'Conclusion'} tone="info" size="sm" />
        ),
      },
      {
        id: 'typZrodla',
        label: isPolish ? 'Źródło' : 'Source',
        width: '190px',
        sortable: true,
        render: (row) => {
          const wiersz = row as unknown as WniosekAudytuWiersz;
          return (
            <div className="flex flex-col">
              <span className="text-xs text-c-text-secondary">
                {etykietaZrodlaWniosku(wiersz.typZrodla, isPolish)}
              </span>
              {wiersz.zrodloTytul ? (
                <span className="text-[11px] text-c-text-muted truncate block max-w-[170px]">
                  {wiersz.zrodloTytul}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'status',
        label: 'Status',
        width: '160px',
        sortable: true,
        render: (row) => (
          <StatusChip
            label={etykietaStanuWniosku((row as unknown as WniosekAudytuWiersz).status, isPolish)}
            tone="neutral"
            size="sm"
          />
        ),
      },
      {
        id: 'dataISO',
        label: isPolish ? 'Data' : 'Date',
        width: '150px',
        sortable: true,
        render: (row) => (
          <span className="text-xs text-c-text-secondary tabular-nums">
            {formatListDate((row as unknown as WniosekAudytuWiersz).dataISO)}
          </span>
        ),
      },
    ],
    [isPolish]
  );

  const selected = items.find((row) => row.id === selectedId) || null;

  const selectedProperties: ArtifactPropertyRow[] | undefined = selected
    ? [
        {
          id: 'zrodlo',
          label: isPolish ? 'Źródło' : 'Source',
          value: `${etykietaZrodlaWniosku(selected.typZrodla, isPolish)}${
            selected.zrodloTytul ? ` — ${selected.zrodloTytul}` : ''
          }`,
        },
        {
          id: 'status',
          label: 'Status',
          value: etykietaStanuWniosku(selected.status, isPolish),
        },
        {
          id: 'data',
          label: isPolish ? 'Data' : 'Date',
          value: formatListDate(selected.dataISO),
        },
        {
          id: 'limits',
          label: isPolish ? 'Ograniczenia' : 'Limits',
          value: selected.limits || '—',
        },
        {
          id: 'nextAction',
          label: isPolish ? 'Następny krok' : 'Next action',
          value: selected.recommendedNextAction || '—',
        },
      ]
    : undefined;

  const otworzWniosek = useCallback(
    (conclusionId: string) => navigate(`/conclusions?id=${encodeURIComponent(conclusionId)}`),
    [navigate]
  );

  const rowMenu = (rawRow: TableRow): StandardRowMenu => {
    const row = rawRow as unknown as WniosekAudytuWiersz;
    return {
      statusTransitions: [
        {
          id: 'open-conclusion',
          label: isPolish ? 'Otwórz wniosek' : 'Open conclusion',
          icon: FileText,
          onClick: () => otworzWniosek(row.id),
        },
      ],
      universalHandlers: {
        preview: () => {
          jedenPanel.otworz();
          setSelectedId(row.id);
        },
      },
    };
  };

  if (error) {
    return (
      <div className="p-4">
        <ErrorState
          title={isPolish ? 'Nie udało się wczytać wniosków' : 'Could not load conclusions'}
          description={error}
          onRetry={() => void load()}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 min-w-0 overflow-auto p-4">
        <StandardTable
          columns={columns}
          data={visibleItems as unknown as TableRow[]}
          loading={loading}
          rowMenu={rowMenu}
          onRowClick={(row) => {
            jedenPanel.otworz();
            setSelectedId(String(row.id));
          }}
          selectedRowId={selectedId}
          persistKey="audits.method.conclusions"
          empty={{
            icon: Lightbulb,
            title: isPolish ? 'Brak wniosków' : 'No conclusions yet',
            description: isPolish
              ? 'Wniosek audytu powstaje z raportu audytu. Zacznij od przycisku „Nowy wniosek” w pasku modułu.'
              : 'An audit conclusion is built from an audit report. Start with “New conclusion” in the module bar.',
          }}
        />
      </div>
      <JedenPrawyPanel
        className="border-l border-c-border-subtle"
        rekord={
          selected ? (
            <StandardPreview
              title={selected.title}
              onClose={() => setSelectedId(null)}
              details={{
                properties: selectedProperties,
                label: isPolish ? 'Szczegóły' : 'Details',
                propertyLabel: isPolish ? 'Właściwość' : 'Property',
                valueLabel: isPolish ? 'Wartość' : 'Value',
              }}
              onOpenFull={() => otworzWniosek(selected.id)}
              openLabel={isPolish ? 'Otwórz wniosek' : 'Open conclusion'}
            >
              <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-2.5">
                <p className="text-xs font-semibold text-c-text">
                  {isPolish ? 'Werdykt' : 'Verdict'}
                </p>
                <p className="mt-1 whitespace-pre-line text-xs text-c-text-secondary">
                  {selected.statement ||
                    (isPolish ? 'Brak treści wniosku.' : 'No conclusion text.')}
                </p>
              </div>
            </StandardPreview>
          ) : null
        }
      />
    </div>
  );
};

export default AuditConclusionsTab;
