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

import { AlertCircle, Archive, Calendar, ChevronRight, Edit2, RotateCcw, Trash2, User } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { getPriorityStyle, getStatusStyle } from '../../constants/statusColors';
import { STATUS_METADATA } from '../../services/initiativeLifecycle';
import { InitiativeStatus, PortfolioInitiative } from '../../types';
import { formatShortDate, getHealthInfo, getNextStep } from '../../utils/initiativeHelpers';
import { RowActionSection, RowActionsMenu } from '../shared/RowActionsMenu';

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
  const statusStyle = getStatusStyle(initiative.status);
  const priorityStyle = getPriorityStyle(initiative.priority);
  const health = getHealthInfo(initiative);
  const nextStep = getNextStep(initiative.status);
  const owner = initiative.ownerBusiness;
  const sponsor = initiative.ownerExecution;
  const statusLabel =
    STATUS_METADATA[initiative.status as InitiativeStatus]?.label || initiative.status;

  const archiveable = (
    [InitiativeStatus.DONE, InitiativeStatus.CANCELLED] as string[]
  ).includes(initiative.status);

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
          disabled: true,
          description: isPolish ? 'Wkrótce' : 'Coming soon',
          onClick: () => {},
        },
        initiative.status === InitiativeStatus.ARCHIVED
          ? {
              id: 'restore',
              label: isPolish ? 'Przywróć' : 'Restore',
              icon: RotateCcw,
              disabled: true,
              description: isPolish ? 'Wkrótce' : 'Coming soon',
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
          description: isPolish ? 'Wkrótce' : 'Coming soon',
          onClick: () => {},
        },
      ],
    },
  ];

  return (
    <div
      onClick={onClick}
      className={[
        'group relative cursor-pointer rounded-xl',
        'border border-slate-200/60 dark:border-white/[0.06]',
        'bg-slate-50/80 dark:bg-navy-800/60',
        'hover:bg-white dark:hover:bg-navy-800/80 transition-colors duration-150',
        'p-4',
      ].join(' ')}
    >
      {/* Top row: Priority + Status + Health */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {/* Priority */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${priorityStyle.bg} ${priorityStyle.text}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${priorityStyle.dot}`} />
            {initiative.priority || '—'}
          </span>
          {/* Status */}
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${statusStyle.bg} ${statusStyle.text}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
            {statusLabel}
          </span>
        </div>
        {/* Health + kebab */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${health.dotClass}`} />
            <span className="text-[10px] text-slate-600 dark:text-slate-500">{health.label}</span>
          </div>
          {/* Kebab — shown on card hover, stopPropagation so it doesn't fire onClick */}
          <div
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <RowActionsMenu sections={sections} />
          </div>
        </div>
      </div>

      {/* Name */}
      <h4 className="font-medium text-sm text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug mb-3">
        {initiative.name}
      </h4>

      {/* Owner + Sponsor */}
      <div className="flex items-center gap-3 mb-3">
        {owner ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center text-[9px] font-medium text-slate-600 dark:text-slate-300 overflow-hidden flex-shrink-0">
              {owner.avatarUrl ? (
                <img src={owner.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                `${owner.firstName?.[0] || '?'}${owner.lastName?.[0] || ''}`
              )}
            </div>
            <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
              {owner.firstName} {owner.lastName?.[0]}.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
            <User size={12} /> Unassigned
          </div>
        )}
        {sponsor && (
          <>
            <span className="text-slate-600 dark:text-slate-400 text-[10px]">/</span>
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center text-[9px] font-medium text-slate-600 dark:text-slate-300 overflow-hidden flex-shrink-0">
                {sponsor.avatarUrl ? (
                  <img src={sponsor.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  `${sponsor.firstName?.[0] || '?'}${sponsor.lastName?.[0] || ''}`
                )}
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {sponsor.firstName} {sponsor.lastName?.[0]}.
              </span>
            </div>
          </>
        )}
      </div>

      {/* Target date */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-3">
        <Calendar size={12} className="flex-shrink-0" />
        <span>{formatShortDate(initiative.plannedEndDate)}</span>
      </div>

      {/* Next step */}
      {nextStep && (
        <div className="pt-2.5 border-t border-slate-200/70 dark:border-white/[0.03]">
          <div className="text-[10px] text-slate-600 dark:text-slate-500 mb-0.5 uppercase tracking-wider font-medium">
            {t('initiatives.card.nextStep', 'Next step')}
          </div>
          <div className="text-xs text-slate-700 dark:text-slate-300 font-medium">
            {nextStep.label}
          </div>
          {nextStep.role && (
            <div className="text-[10px] text-slate-600 dark:text-slate-500 mt-0.5">
              {nextStep.role}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default InitiativeGridCard;
