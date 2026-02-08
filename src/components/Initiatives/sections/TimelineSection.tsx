/**
 * TimelineSection - Start/end dates, target quarter, duration
 */

import { Calendar } from 'lucide-react';
import React from 'react';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const TimelineSection: React.FC<InitiativeSectionProps> = ({ sectionType, expanded, onToggle }) => {
  const { initiative, isPolish } = useInitiativeContext();

  return (
    <CollapsibleSection
      id="timeline"
      title={isPolish ? 'Harmonogram' : 'Timeline'}
      icon={<Calendar size={18} className="text-cyan-500 dark:text-cyan-400" />}
      iconBg="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 dark:from-cyan-500/20 dark:to-blue-500/20"
      expanded={expanded}
      onToggle={onToggle}
    >
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">{isPolish ? 'Data startu' : 'Start Date'}</span>
          <span className="text-sm text-slate-700 dark:text-white">{initiative.plannedStartDate ? new Date(initiative.plannedStartDate).toLocaleDateString() : '-'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">{isPolish ? 'Data końca' : 'End Date'}</span>
          <span className="text-sm text-slate-700 dark:text-white">{initiative.plannedEndDate ? new Date(initiative.plannedEndDate).toLocaleDateString() : '-'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">{isPolish ? 'Kwartał docelowy' : 'Target Quarter'}</span>
          <span className="text-sm text-slate-700 dark:text-white">{initiative.targetQuarter || '-'}</span>
        </div>
        {initiative.plannedStartDate && initiative.plannedEndDate && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-navy-700">
            <span className="text-xs text-slate-500">{isPolish ? 'Czas trwania' : 'Duration'}</span>
            <span className="text-sm font-medium text-slate-700 dark:text-white">
              {Math.ceil((new Date(initiative.plannedEndDate).getTime() - new Date(initiative.plannedStartDate).getTime()) / (1000 * 60 * 60 * 24))} {isPolish ? 'dni' : 'days'}
            </span>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};
