import { ExternalLink } from 'lucide-react';
import React from 'react';

import i18n from '@/i18n';
import { executionTypeLabel, UNKNOWN_EXECUTION_TYPE_LABEL } from '@/labels/executionTypeLabels';
import type { StandardRowMenu, TableColumn } from '@/components/standard';
import { getInitiativeStatusChipTone, getLocalizedStatusLabel } from '@/services/initiativeLifecycle';
import { InitiativeStatus } from '@/types';
import type { PortfolioInitiative } from '@/types';
import { formatListDate, formatRelativeHint } from '@/utils/listDateFormat';
import { mapInitiativeStatus } from '@/contracts/initiatives-execution/statusMapping';

import {
  INITIATIVE_GATE_NAME_LABELS,
  INITIATIVE_GATE_READINESS_LABELS,
  INITIATIVE_HEALTH_STATE_LABELS,
  INITIATIVE_IMPACT_CONFIDENCE_LABELS,
  INITIATIVE_LIFECYCLE_LABELS,
  nextStepForLifecycle,
} from './initiativeRegisterProjection';

export const INITIATIVE_REGISTER_COLUMN_IDS = [
  'name',
  'status',
  'gateName',
  'gateReadiness',
  'owner',
  'areaOrAxis',
  'nextAction',
  'expectedImpact',
  'plannedWindow',
  'healthState',
  'updatedAt',
] as const;

/**
 * A19 + A13 (uwagi wlasciciela 2026-09-05) — „czemu to jest inna tabela
 * inicjatyw — powinnismy miec jedna".
 *
 * Kolumny opcjonalne NIE tworza drugiej definicji tabeli: to ta sama
 * definicja z doloczonym polem kontekstu. `assessment-initiatives-table`
 * potrzebuje „Zrodlo: ocena X", modul /initiatives nie — i to jedyna roznica,
 * ktora wolno miedzy tymi powierzchniami wystapic.
 */
export const INITIATIVE_REGISTER_OPTIONAL_COLUMN_IDS = ['source'] as const;

/**
 * Rejestr kanoniczny (`runtime-v1`) trzyma `lifecycleState`
 * (REGISTERED_DRAFT / DEFINED / IN_EXECUTION …), a Ocena i starsze endpointy
 * trzymaja LEGACY `InitiativeStatus` (DRAFT / REVIEW / EXECUTING …).
 *
 * Zmierzone 2026-09-05 na `/assessment?tab=initiatives` (zrzut PRZED,
 * `evidence/inicjatywy-tabela-20260905/01-przed-ocena-inicjatywy.png`):
 * `nextStepForLifecycle('DRAFT')` wpadal w `default`, wiec SZESC z dziesieciu
 * kolumn pokazywalo „—" / „Nieznane" na kazdym wierszu. Tabela wygladala jak
 * INNA tabela nie dlatego, ze miala inne kolumny (kontrakt jest jeden od
 * dyzuru 274), tylko dlatego, ze te same kolumny nie umialy odczytac drugiego
 * slownika statusow. Alias zalatwia to w JEDNYM miejscu — obie powierzchnie
 * Oceny naprawiaja sie bez wlasnego kodu.
 */
/** Kanoniczny stan cyklu zycia wiersza — niezaleznie od tego, ktory slownik go przyniosl. */
export const resolveInitiativeRegisterLifecycle = (row: InitiativeRegisterRow): string => {
  const raw = String(row.displayStatus || row.status || '').toUpperCase();
  if (!raw) return '';
  return mapInitiativeStatus({ direction: 'legacy-to-runtime', status: raw }) ?? '';
};

export interface InitiativeRegisterColumnOptions {
  /** Dokłada kolumnę „Źródło" (np. „Ocena: DRD"). Domyślnie wyłączona. */
  includeSource?: boolean;
  /**
   * [ODMROZENIE 05_INITIATIVES DEC-402] Opcjonalny `t()` do lokalizacji
   * WYŁĄCZNIE nowej kolumny „Obszar / oś" (pl+en). Pozostałych dziesięć
   * kolumn ustalonego kontraktu z dyżuru 274 zostaje bez zmian — nie mają
   * i18n dziś i nie jest to naprawiane tym zleceniem. Brak `t` → polski
   * fallback (zachowanie sprzed zmiany, oba wołające miejsca dziś je podają).
   */
  t?: (key: string, fallback: string) => string;
}

export type InitiativeRegisterRow = PortfolioInitiative & {
  canonicalVersion?: number;
  title?: string;
  description?: string;
  displayStatus?: string;
  gateName?: string;
  gateReadiness?: string;
  nextAction?: string;
  expectedImpact?: string;
  impactConfidence?: string;
  plannedWindow?: string | null;
  healthState?: string;
  sourceFreshness?: string;
  sourceLabel?: string;
  ownerName?: string;
};

const h = React.createElement;

export const formatPlannedWindow = (raw: unknown): string => {
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

const statusDotClass = (status: string, onHold?: boolean): string => {
  const tone = getInitiativeStatusChipTone(status as InitiativeStatus, { onHold });
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

/** Kategoria-tag pochodzenia rekordu, nie obszar — nigdy nie renderuj wprost. */
const INITIATIVE_CATEGORY_INTERNAL_TAGS = new Set(['interview_insight']);

/**
 * [ODMROZENIE 05_INITIATIVES DEC-402] „Obszar / oś" — zmierzone na żywo
 * (`/api/initiatives`, org DBR77, 71 wierszy): `area` 13/71, `axis` 23/71,
 * `category` 53/71 niepuste, 56/71 (79%) po tej rezolucji ma wartość.
 * Kolejność (pierwszy niepusty wygrywa):
 *   1. `registerArea` — realny obszar biznesowy/DRD (np. „IT", „Production") —
 *      to już czytelny tekst, wyświetlany wprost.
 *   2. `registerAxisRaw` — realna oś transformacji DRD LUB
 *      `InitiativeAxisEnum` (np. „Digital Processes", „transformational") —
 *      etykietowana TYM SAMYM, przetestowanym słownikiem co kolumna TYP w
 *      Execution (`executionTypeLabel`, src/labels/executionTypeLabels.ts,
 *      dyżur DEC-397 06_EXECUTION — ten sam pomiar na tym samym rekordzie).
 *      Nierozpoznana wartość pokazuje SUROWY tekst zamiast „Nieznany typ" —
 *      ta kolumna nie jest zamkniętą klasyfikacją, tylko orientacyjnym
 *      obszarem, więc surowy tekst niesie więcej niż placeholder.
 *   3. `registerCategory` — szersza kategoria źródła, z pominięciem
 *      wewnętrznego znacznika `interview_insight` (tag pochodzenia rekordu,
 *      nie obszar).
 *   4. brak sygnału → `null` (wołający renderuje „—" — brak pomiaru ≠ wynik).
 */
export const resolveInitiativeAreaOrAxis = (row: InitiativeRegisterRow): string | null => {
  const area = String(row.registerArea ?? '').trim();
  if (area) return area;

  const axisRaw = String(row.registerAxisRaw ?? '').trim();
  if (axisRaw) {
    const isPolish = (i18n.language || '').toLowerCase().startsWith('pl');
    const label = executionTypeLabel(axisRaw, isPolish);
    const unknownLabel = isPolish
      ? UNKNOWN_EXECUTION_TYPE_LABEL.pl
      : UNKNOWN_EXECUTION_TYPE_LABEL.en;
    return label === unknownLabel ? axisRaw : label;
  }

  const category = String(row.registerCategory ?? '').trim();
  if (category && !INITIATIVE_CATEGORY_INTERNAL_TAGS.has(category)) return category;

  return null;
};

export const createInitiativeRegisterColumns = (
  options: InitiativeRegisterColumnOptions = {}
): TableColumn[] => {
  const base: TableColumn[] = [
    {
      id: 'name',
      label: 'Inicjatywa',
      width: '220px',
      render: (raw) => {
        const row = raw as InitiativeRegisterRow;
        return h(
          'div',
          { className: 'min-w-0' },
          h(
            'span',
            { className: 'block truncate text-sm font-semibold text-c-text' },
            row.name || row.title || '—'
          ),
          h(
            'span',
            { className: 'block truncate text-xs text-c-text-secondary' },
            row.summary || row.description || 'Brak opisu problemu'
          )
        );
      },
    },
    {
      id: 'status',
      label: 'Status',
      width: '170px',
      filterable: true,
      filterOptions: Object.values(InitiativeStatus).map((value) => ({
        value,
        label: getLocalizedStatusLabel(value, t ?? ((key) => key)),
      })),
      render: (raw) => {
        const row = raw as InitiativeRegisterRow;
        const status = row.status as InitiativeStatus;
        return h(
          'span',
          {
            className: 'inline-flex items-center gap-1.5 text-xs font-medium text-c-text-secondary',
          },
          h('span', {
            className: `h-1.5 w-1.5 flex-shrink-0 rounded-full ${statusDotClass(String(row.status), row.onHold)}`,
          }),
          getLocalizedStatusLabel(status, t ?? ((key) => key))
        );
      },
    },
    {
      id: 'gateName',
      label: 'Następna bramka',
      width: '175px',
      render: (raw) => {
        const row = raw as InitiativeRegisterRow;
        const value = String(
          row.gateName || nextStepForLifecycle(resolveInitiativeRegisterLifecycle(row)).gate || ''
        );
        const label = value && value !== '—' ? INITIATIVE_GATE_NAME_LABELS[value] || value : '—';
        return h(
          'span',
          { className: 'block truncate text-xs text-c-text-secondary', title: label },
          label
        );
      },
    },
    {
      id: 'gateReadiness',
      label: 'Gotowość',
      width: '150px',
      render: (raw) => {
        const readiness = String((raw as InitiativeRegisterRow).gateReadiness || 'NOT_EVALUATED');
        const label = INITIATIVE_GATE_READINESS_LABELS[readiness] || readiness.replaceAll('_', ' ');
        return h(
          'span',
          { className: 'block truncate text-xs font-medium text-c-text-secondary', title: label },
          label
        );
      },
    },
    {
      id: 'owner',
      label: 'Właściciel',
      width: '150px',
      render: (raw) => {
        const row = raw as InitiativeRegisterRow;
        const owner = row.ownerBusiness || row.ownerExecution;
        const label = owner
          ? `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || '—'
          : row.ownerName || '—';
        return h('span', { className: 'block truncate text-xs text-c-text-secondary' }, label);
      },
    },
    {
      // [ODMROZENIE 05_INITIATIVES DEC-402] „Obszar / oś" — patrz
      // `resolveInitiativeAreaOrAxis` powyżej dla źródła danych i pomiaru.
      id: 'areaOrAxis',
      label: options.t ? options.t('initiatives.columns.areaOrAxis', 'Obszar / oś') : 'Obszar / oś',
      width: '150px',
      sortable: true,
      sortAccessor: (raw) => resolveInitiativeAreaOrAxis(raw as InitiativeRegisterRow) || '',
      render: (raw) => {
        const label = resolveInitiativeAreaOrAxis(raw as InitiativeRegisterRow) || '—';
        return h(
          'span',
          { className: 'block truncate text-xs text-c-text-secondary', title: label },
          label
        );
      },
    },
    {
      id: 'nextAction',
      label: 'Następne działanie',
      width: '160px',
      // PRZEWODY ODBIORU 2026-09-03: brak danych renderował się jako angielskie
      // „UNKNOWN" w polskiej tabeli (zmierzone na `assessment-initiatives-table`
      // — pięć wierszy, dwie kolumny). Kanon tabel: pusta komórka to „—".
      render: (raw) => {
        const row = raw as InitiativeRegisterRow;
        const action =
          row.nextAction || nextStepForLifecycle(resolveInitiativeRegisterLifecycle(row)).action;
        return h('span', { className: 'text-xs font-medium text-c-text' }, String(action || '—'));
      },
    },
    {
      id: 'expectedImpact',
      label: 'Oczekiwany efekt',
      width: '160px',
      render: (raw) => {
        const row = raw as InitiativeRegisterRow;
        const confidence = String(row.impactConfidence || 'UNKNOWN');
        return h(
          'div',
          { className: 'min-w-0 text-xs' },
          h(
            'span',
            { className: 'block truncate text-c-text-secondary' },
            String(row.expectedImpact || '—')
          ),
          h(
            'span',
            { className: 'text-c-text-secondary' },
            `Pewność: ${INITIATIVE_IMPACT_CONFIDENCE_LABELS[confidence] || confidence}`
          )
        );
      },
    },
    {
      id: 'plannedWindow',
      label: 'Planowane okno',
      width: '215px',
      render: (raw) => {
        const label = formatPlannedWindow((raw as InitiativeRegisterRow).plannedWindow);
        return h(
          'span',
          { className: 'block truncate text-xs text-c-text-secondary', title: label },
          label
        );
      },
    },
    {
      id: 'healthState',
      label: 'Kondycja',
      width: '110px',
      render: (raw) => {
        const row = raw as InitiativeRegisterRow;
        const value = String(
          row.healthState ||
            (resolveInitiativeRegisterLifecycle(row) === 'IN_EXECUTION' ? 'UNKNOWN' : 'N/A')
        );
        const label = INITIATIVE_HEALTH_STATE_LABELS[value] || value;
        return h(
          'span',
          { className: 'block truncate text-xs text-c-text-secondary', title: label },
          label
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
        const value = (raw as InitiativeRegisterRow).updatedAt;
        return value ? new Date(value).getTime() : 0;
      },
      render: (raw) => {
        const value = (raw as InitiativeRegisterRow).updatedAt;
        const relative = formatRelativeHint(value, new Date());
        return h(
          'span',
          {
            className: 'text-xs tabular-nums text-c-text-secondary',
            title: formatListDate(value, ''),
          },
          relative || '—'
        );
      },
    },
  ];

  if (!options.includeSource) return base;

  // Kolumna kontekstu — ta SAMA definicja, dolozone jedno pole. Wchodzi PRZED
  // „Aktualizacja", zeby kolumna sortowania zostala ostatnia (kanon TRIADA).
  const sourceColumn: TableColumn = {
    id: 'source',
    label: 'Źródło',
    width: '150px',
    render: (raw) => {
      const row = raw as InitiativeRegisterRow;
      const label = String(row.sourceLabel || row.sourceType || '').trim() || '—';
      return h(
        'span',
        { className: 'block truncate text-xs text-c-text-secondary', title: label },
        label
      );
    },
  };
  const updatedAtAt = base.findIndex((column) => column.id === 'updatedAt');
  const insertAt = updatedAtAt === -1 ? base.length : updatedAtAt;
  return [...base.slice(0, insertAt), sourceColumn, ...base.slice(insertAt)];
};

export const createInitiativeRegisterRowMenu = <T extends InitiativeRegisterRow>(options: {
  row: T;
  onOpen: (row: T) => void;
  onPreview: (row: T) => void;
}): StandardRowMenu => ({
  primary: [
    { id: 'open', label: 'Otwórz', icon: ExternalLink, onClick: () => options.onOpen(options.row) },
  ],
  universalHandlers: {
    preview: () => options.onPreview(options.row),
    archiveNote: 'Zmiany lifecycle i archiwizacja są wykonywane w kontrolowanym procesie.',
  },
});
