import { ExternalLink } from 'lucide-react';
import React from 'react';

import type { StandardRowMenu, TableColumn } from '@/components/standard';
import { statusChipTone } from '@/components/ui/primitives/chips';
import type { PortfolioInitiative } from '@/types';
import { formatListDate, formatRelativeHint } from '@/utils/listDateFormat';

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
export const INITIATIVE_REGISTER_LEGACY_LIFECYCLE_ALIASES: Record<string, string> = {
  DRAFT: 'REGISTERED_DRAFT',
  PLANNING: 'DEFINING',
  PENDING_REVIEW: 'DEFINED',
  REVIEW: 'ANALYZING',
  PROMOTED: 'READY_FOR_DECISION',
  APPROVED: 'APPROVED_BACKLOG',
  SCHEDULED: 'SCHEDULED',
  EXECUTING: 'IN_EXECUTION',
  BLOCKED: 'IN_EXECUTION',
  TRACKING: 'BENEFITS_TRACKING',
  DONE: 'CLOSED',
  ARCHIVED: 'ARCHIVED',
  CANCELLED: 'CANCELLED',
};

/** Kanoniczny stan cyklu zycia wiersza — niezaleznie od tego, ktory slownik go przyniosl. */
export const resolveInitiativeRegisterLifecycle = (row: InitiativeRegisterRow): string => {
  const raw = String(row.displayStatus || row.status || '').toUpperCase();
  if (!raw) return '';
  return INITIATIVE_REGISTER_LEGACY_LIFECYCLE_ALIASES[raw] || raw;
};

export interface InitiativeRegisterColumnOptions {
  /** Dokłada kolumnę „Źródło" (np. „Ocena: DRD"). Domyślnie wyłączona. */
  includeSource?: boolean;
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
      label: 'Cykl życia',
      width: '170px',
      filterable: true,
      filterOptions: Object.entries(INITIATIVE_LIFECYCLE_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
      render: (raw) => {
        const row = raw as InitiativeRegisterRow;
        const lifecycle = resolveInitiativeRegisterLifecycle(row) || 'UNKNOWN';
        return h(
          'span',
          {
            className: 'inline-flex items-center gap-1.5 text-xs font-medium text-c-text-secondary',
          },
          h('span', {
            className: `h-1.5 w-1.5 flex-shrink-0 rounded-full ${statusDotClass(String(row.status))}`,
          }),
          INITIATIVE_LIFECYCLE_LABELS[lifecycle] || lifecycle.replaceAll('_', ' ')
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
