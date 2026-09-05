import { AlertTriangle, CheckCircle2, CircleDot, UserRound } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ActionCardModel } from './ActionCard.types';

export interface ActionCardProps {
  card: ActionCardModel;
  onOpen?: (card: ActionCardModel) => void;
  className?: string;
}

const shown = (value?: string | null) => (value && value.trim() ? value : '—');

export function ActionCard({ card, onOpen, className = '' }: ActionCardProps) {
  const { t } = useTranslation();
  const critical = card.status === 'OPEN' && card.severity === 'RED';
  const statusLabel = card.status === 'OPEN'
    ? t('actionCard.status.open', 'OTWARTY')
    : t('actionCard.status.closed', 'ZAMKNIĘTY');
  const fields = [
    [t('actionCard.fields.period', 'Okres'), `${shown(card.periodStart)} – ${shown(card.periodEnd)}`],
    [t('actionCard.fields.goalMet', 'Cel osiągnięty?'), card.goalMet ? t('common.yes', 'Tak') : t('common.no', 'Nie')],
    [t('actionCard.fields.actionRequired', 'Działania wymagane?'), card.actionRequired ? t('common.yes', 'Tak') : t('common.no', 'Nie')],
    [t('actionCard.fields.problem', 'Opis problemu'), shown(card.problem)],
    [t('actionCard.fields.rootCause', 'Główna przyczyna'), shown(card.rootCause)],
    [t('actionCard.fields.action', 'Opis działania'), shown(card.actionText)],
    [t('actionCard.fields.owner', 'Odpowiedzialność'), shown(card.ownerName)],
    [t('actionCard.fields.dueDate', 'Termin'), shown(card.dueDate)],
    [t('actionCard.fields.comment', 'Komentarz'), shown(card.comment)],
    [t('actionCard.fields.status', 'Status'), statusLabel],
  ] as const;

  return (
    <article
      data-action-card
      className={`overflow-hidden rounded-2xl border bg-c-surface shadow-sm ${critical ? 'border-c-danger/50' : 'border-c-border-subtle'} ${className}`}
    >
      <header className="flex items-start justify-between gap-4 border-b border-c-border-subtle bg-c-surface-raised px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${critical ? 'bg-c-danger/10 text-c-danger' : 'bg-c-surface-subtle text-c-text-secondary'}`}>
            {critical ? <AlertTriangle size={18} aria-hidden="true" /> : <CircleDot size={18} aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-c-text">{t('actionCard.title', 'Karta działania')}</h2>
            <p className="truncate text-xs text-c-text-muted">{shown(card.problem)}</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${card.status === 'CLOSED' ? 'bg-c-success/10 text-c-success' : critical ? 'bg-c-danger/10 text-c-danger' : 'bg-c-warning/10 text-c-warning'}`}>
          {card.status === 'CLOSED' ? <CheckCircle2 size={13} aria-hidden="true" /> : <UserRound size={13} aria-hidden="true" />}
          {statusLabel}
        </span>
      </header>
      <dl className="divide-y divide-c-border-subtle">
        {fields.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[minmax(8rem,0.38fr)_1fr] gap-4 px-5 py-3">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-c-text-muted">{label}</dt>
            <dd className="whitespace-pre-wrap text-sm text-c-text-secondary">{value}</dd>
          </div>
        ))}
      </dl>
      {onOpen ? (
        <footer className="flex justify-end border-t border-c-border-subtle px-5 py-3">
          <button type="button" onClick={() => onOpen(card)} className="rounded-lg border border-c-border px-3 py-2 text-xs font-medium text-c-text hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus">
            {t('actionCard.open', 'Otwórz kartę')}
          </button>
        </footer>
      ) : null}
    </article>
  );
}

export default ActionCard;
