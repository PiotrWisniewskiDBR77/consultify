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
  ownerName?: string;
};

const h = React.createElement;

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

export const createInitiativeRegisterColumns = (): TableColumn[] => [
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
          { className: 'block truncate text-xs text-c-text-muted' },
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
      const lifecycle = String(row.displayStatus || row.status || 'UNKNOWN').toUpperCase();
      return h(
        'span',
        { className: 'inline-flex items-center gap-1.5 text-xs font-medium text-c-text-secondary' },
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
      const value = String((raw as InitiativeRegisterRow).gateName || '');
      const label = value ? INITIATIVE_GATE_NAME_LABELS[value] || value : '—';
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
      const readiness = String((raw as InitiativeRegisterRow).gateReadiness || 'UNKNOWN');
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
    render: (raw) =>
      h(
        'span',
        { className: 'text-xs font-medium text-c-text' },
        String((raw as InitiativeRegisterRow).nextAction || 'UNKNOWN')
      ),
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
          String(row.expectedImpact || 'UNKNOWN')
        ),
        h(
          'span',
          { className: 'text-c-text-muted' },
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
        { className: 'block truncate text-xs text-c-text-muted', title: label },
        label
      );
    },
  },
  {
    id: 'healthState',
    label: 'Kondycja',
    width: '110px',
    render: (raw) => {
      const value = String((raw as InitiativeRegisterRow).healthState || 'N/A');
      const label = INITIATIVE_HEALTH_STATE_LABELS[value] || value;
      return h(
        'span',
        { className: 'block truncate text-xs text-c-text-muted', title: label },
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
        { className: 'text-xs tabular-nums text-c-text-muted', title: formatListDate(value, '') },
        relative || '—'
      );
    },
  },
];

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
