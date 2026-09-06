/**
 * Initiative Grid Card
 *
 * Card view for Initiatives module grid — "pokazywać priorytety".
 *
 * Shows: Name, Priority, Status, Owner+Sponsor, Target date, Next step,
 *        Top 1-3 blocking missing, Health RAG
 *
 * Tech Sexy v2.0: invisible borders, subtle hover, monochromatic chrome
 */

import { Archive, ChevronRight, Clock, Edit2, RotateCcw, Trash2, User } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  DueChip,
  EntityStatusChip,
  PriorityChip,
  type PriorityLevel,
} from '@/components/ui/primitives/chips';

import { STATUS_METADATA } from '../../services/initiativeLifecycle';
import { InitiativeStatus, PortfolioInitiative } from '../../types';
import { formatShortDate, getHealthInfo, getNextStep } from '../../utils/initiativeHelpers';
import { RowActionSection, RowActionsMenu } from '../shared/RowActionsMenu';

/** Map raw initiative priority → PriorityChip level (canon §4.2). */
const PRIORITY_LEVEL: Record<string, PriorityLevel> = {
  CRITICAL: 'urgent',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

interface InitiativeGridCardProps {
  initiative: PortfolioInitiative;
  onClick: () => void;
  onArchive?: (initiative: PortfolioInitiative) => void;
  onOpenFull?: (initiative: PortfolioInitiative) => void;
}

export const InitiativeGridCard: React.FC<InitiativeGridCardProps> = ({
  initiative,
  onClick,
  onArchive,
  onOpenFull,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const terminal =
    initiative.status === InitiativeStatus.REJECTED ||
    initiative.status === InitiativeStatus.CLOSED;
  const priorityLevel = PRIORITY_LEVEL[initiative.priority];
  const health = getHealthInfo(initiative);
  const nextStep = getNextStep(initiative.status);
  const owner = initiative.ownerBusiness;
  const sponsor = initiative.ownerExecution;
  const description = initiative.summary || initiative.description;

  const archiveable = ([InitiativeStatus.CLOSED, InitiativeStatus.REJECTED] as string[]).includes(
    initiative.status
  );

  // Kebab — canon §8.0: IDENTICAL sections/positions to the table row (PortfolioListView).
  const comingSoonBackend = isPolish ? 'Wkrótce (backend)' : 'Soon (backend)';
  const sections: RowActionSection[] = [
    { id: 'context', kind: 'context', actions: [] },
    {
      id: 'fixed',
      kind: 'manage',
      actions: [
        {
          id: 'open-preview',
          label: isPolish ? 'Otwórz podgląd' : 'Open preview',
          icon: ChevronRight,
          onClick,
        },
        ...(onOpenFull
          ? [
              {
                id: 'open-full',
                label: isPolish ? 'Otwórz pełny widok' : 'Open full view',
                icon: ChevronRight,
                onClick: () => onOpenFull(initiative),
              },
            ]
          : []),
        {
          id: 'edit',
          label: isPolish ? 'Edytuj' : 'Edit',
          icon: Edit2,
          onClick,
        },
        initiative.status === InitiativeStatus.CLOSED
          ? {
              id: 'restore',
              label: isPolish ? 'Przywróć' : 'Restore',
              icon: RotateCcw,
              disabled: true,
              description: comingSoonBackend,
              onClick: () => {},
            }
          : {
              id: 'archive',
              label: isPolish ? 'Archiwizuj' : 'Archive',
              icon: Archive,
              disabled: !onArchive || !archiveable,
              description:
                !onArchive || !archiveable
                  ? isPolish
                    ? 'Zakończ lub anuluj najpierw'
                    : 'Finish or cancel first'
                  : undefined,
              onClick: () => onArchive?.(initiative),
            },
        // 4 — Delay (slot present because initiative has a due date; §9.2)
        ...(initiative.plannedEndDate
          ? [
              {
                id: 'delay',
                label: isPolish ? 'Przesuń termin' : 'Delay',
                icon: Clock,
                disabled: true,
                description: comingSoonBackend,
                onClick: () => {},
              },
            ]
          : []),
      ],
    },
    {
      id: 'danger',
      kind: 'danger',
      actions: [
        {
          id: 'delete',
          label: isPolish ? 'Usuń' : 'Delete',
          icon: Trash2,
          variant: 'danger' as const,
          disabled: true,
          description: comingSoonBackend,
          onClick: () => {},
        },
      ],
    },
  ];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onDoubleClick={() => onOpenFull?.(initiative)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={t('initiatives.card.openInitiative', 'Open initiative: {{title}}', {
        title: initiative.name,
      })}
      className={[
        'group relative cursor-pointer rounded-xl p-4',
        'border border-slate-200/60 dark:border-white/[0.03]',
        // canon §8.1 — neutral card surface; status color lives in the badge, not the card
        'bg-c-surface',
        'hover:shadow-md hover:-translate-y-px transition-all duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-2 ring-offset-c-bg',
        terminal ? 'opacity-60' : '',
      ].join(' ')}
    >
      {/* Zone 1 — Badge row (status · priority · health) + kebab */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <EntityStatusChip
            status={initiative.status}
            label={t(
              STATUS_METADATA[initiative.status as InitiativeStatus]?.labelKey ??
                'initiatives.status.unknown'
            )}
          />
          {priorityLevel && <PriorityChip level={priorityLevel} label={initiative.priority} />}
          <span className="inline-flex items-center gap-1.5 text-[11px] text-c-text-muted">
            <span className={`w-1.5 h-1.5 rounded-full ${health.dotClass}`} />
            {health.label}
          </span>
        </div>
        {/* Kebab — same RowActionsMenu/sections as the table row (§8.0) */}
        <div
          className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <RowActionsMenu sections={sections} />
        </div>
      </div>

      {/* Zone 2 — Title */}
      <h4
        className="font-semibold text-sm text-c-text line-clamp-2 leading-snug"
        title={initiative.name}
      >
        {initiative.name}
      </h4>

      {/* Zone 3 — Description (when available) */}
      {description && <p className="mt-1 text-xs text-c-text-muted line-clamp-2">{description}</p>}

      {/* Owner + Sponsor */}
      <div className="flex items-center gap-3 mt-3">
        {owner ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center text-[9px] font-medium text-c-text-secondary overflow-hidden flex-shrink-0">
              {owner.avatarUrl ? (
                <img src={owner.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                `${owner.firstName?.[0] || '?'}${owner.lastName?.[0] || ''}`
              )}
            </div>
            <span className="text-[11px] text-c-text-secondary truncate">
              {owner.firstName} {owner.lastName?.[0]}.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] text-c-text-muted">
            <User size={12} /> {isPolish ? 'Nieprzypisane' : 'Unassigned'}
          </div>
        )}
        {sponsor && (
          <>
            <span className="text-c-text-muted text-[10px]">/</span>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center text-[9px] font-medium text-c-text-secondary overflow-hidden flex-shrink-0">
                {sponsor.avatarUrl ? (
                  <img src={sponsor.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  `${sponsor.firstName?.[0] || '?'}${sponsor.lastName?.[0] || ''}`
                )}
              </div>
              <span className="text-[11px] text-c-text-muted truncate">
                {sponsor.firstName} {sponsor.lastName?.[0]}.
              </span>
            </div>
          </>
        )}
      </div>

      {/* Zone 4 — Stats footer: next step · due (3 values) */}
      <div className="flex items-center justify-between gap-2 text-[11px] text-c-text-muted border-t border-slate-200/60 dark:border-white/[0.03] mt-3 pt-3">
        <span className="truncate" title={nextStep?.label}>
          {nextStep ? (
            <>
              <span className="text-c-text-muted">
                {t('initiatives.card.nextStep', 'Next step')}:{' '}
              </span>
              <span className="text-c-text-secondary font-medium">{nextStep.label}</span>
            </>
          ) : (
            '—'
          )}
        </span>
        {initiative.plannedEndDate ? (
          <DueChip
            label={formatShortDate(initiative.plannedEndDate)}
            due={terminal ? null : initiative.plannedEndDate}
            showIcon
          />
        ) : (
          <span className="text-c-text-muted shrink-0">—</span>
        )}
      </div>
    </div>
  );
};

export default InitiativeGridCard;
