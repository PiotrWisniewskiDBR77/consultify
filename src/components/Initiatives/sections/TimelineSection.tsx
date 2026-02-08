/**
 * TimelineSection - Start/end dates, target quarter, duration with progress
 */

import { motion } from 'framer-motion';
import { Calendar, Clock } from 'lucide-react';
import React, { useMemo } from 'react';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const TimelineSection: React.FC<InitiativeSectionProps> = ({ sectionType, expanded, onToggle }) => {
  const { initiative, isPolish, startDate, setStartDate, endDate, setEndDate } = useInitiativeContext();

  const plannedStart = startDate || initiative?.plannedStartDate || initiative?.planned_start_date;
  const plannedEnd = endDate || initiative?.plannedEndDate || initiative?.planned_end_date;
  const actualStart = initiative?.actualStartDate || initiative?.actual_start_date || initiative?.execution_started_at;

  const duration = useMemo(() => {
    if (!plannedStart || !plannedEnd) return null;
    const start = new Date(plannedStart);
    const end = new Date(plannedEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  }, [plannedStart, plannedEnd]);

  const timelineProgress = useMemo(() => {
    if (!plannedStart || !plannedEnd) return 0;
    const start = new Date(plannedStart).getTime();
    const end = new Date(plannedEnd).getTime();
    const now = Date.now();
    if (now <= start) return 0;
    if (now >= end) return 100;
    return Math.round(((now - start) / (end - start)) * 100);
  }, [plannedStart, plannedEnd]);

  const daysRemaining = useMemo(() => {
    if (!plannedEnd) return null;
    const end = new Date(plannedEnd);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }, [plannedEnd]);

  const isOverdue = daysRemaining !== null && daysRemaining < 0;

  return (
    <CollapsibleSection
      id="timeline"
      title={isPolish ? 'Harmonogram' : 'Timeline'}
      icon={<Calendar size={18} className="text-cyan-500 dark:text-cyan-400" />}
      iconBg="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 dark:from-cyan-500/20 dark:to-blue-500/20"
      expanded={expanded}
      onToggle={onToggle}
      badge={
        daysRemaining !== null ? (
          <span className={`text-xs px-1.5 py-0.5 rounded ${isOverdue ? 'bg-red-500/20 text-red-400' : daysRemaining <= 14 ? 'bg-amber-500/20 text-amber-400' : 'bg-cyan-500/20 text-cyan-400'}`}>
            {isOverdue
              ? (isPolish ? `${Math.abs(daysRemaining)}d po terminie` : `${Math.abs(daysRemaining)}d overdue`)
              : (isPolish ? `${daysRemaining}d do końca` : `${daysRemaining}d left`)}
          </span>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {/* Editable Date Fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">{isPolish ? 'Data startu' : 'Start Date'}</label>
            <input
              type="date"
              value={plannedStart ? new Date(plannedStart).toISOString().split('T')[0] : ''}
              onChange={(e) => setStartDate?.(e.target.value || null)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{isPolish ? 'Data końca' : 'End Date'}</label>
            <input
              type="date"
              value={plannedEnd ? new Date(plannedEnd).toISOString().split('T')[0] : ''}
              onChange={(e) => setEndDate?.(e.target.value || null)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-sm text-slate-700 dark:text-slate-300 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 transition-colors"
            />
          </div>
        </div>

        {/* Duration and Target Quarter */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/50 dark:bg-navy-800/50 border border-slate-200/50 dark:border-navy-700/50">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-slate-400" />
              <span className="text-xs text-slate-500">{isPolish ? 'Czas trwania' : 'Duration'}</span>
            </div>
            <span className="text-sm font-medium text-slate-700 dark:text-white">
              {duration ? `${duration} ${isPolish ? 'dni' : 'days'}` : '-'}
            </span>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/50 dark:bg-navy-800/50 border border-slate-200/50 dark:border-navy-700/50">
            <span className="text-xs text-slate-500">{isPolish ? 'Kwartał' : 'Quarter'}</span>
            <span className="text-sm font-medium text-slate-700 dark:text-white">
              {initiative?.targetQuarter || initiative?.target_quarter || '-'}
            </span>
          </div>
        </div>

        {/* Timeline Progress Bar */}
        {plannedStart && plannedEnd && (
          <div className="pt-2 border-t border-slate-200/50 dark:border-navy-700/50">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-slate-500">{isPolish ? 'Postęp czasu' : 'Time Progress'}</span>
              <span className={`text-xs font-medium ${isOverdue ? 'text-red-500' : 'text-cyan-500'}`}>
                {timelineProgress}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(timelineProgress, 100)}%` }}
                className={`h-full rounded-full ${
                  isOverdue
                    ? 'bg-gradient-to-r from-red-500 to-red-400'
                    : timelineProgress > 80
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500'
                      : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                }`}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-slate-400">
                {new Date(plannedStart).toLocaleDateString()}
              </span>
              <span className="text-[10px] text-slate-400">
                {new Date(plannedEnd).toLocaleDateString()}
              </span>
            </div>
          </div>
        )}

        {/* Actual Dates (Execution) */}
        {actualStart && (
          <div className="p-2.5 rounded-lg bg-cyan-50/50 dark:bg-cyan-500/5 border border-cyan-200/50 dark:border-cyan-500/20">
            <div className="flex items-center justify-between">
              <span className="text-xs text-cyan-600 dark:text-cyan-400 font-medium">
                {isPolish ? 'Faktyczny start' : 'Actual Start'}
              </span>
              <span className="text-sm text-cyan-700 dark:text-cyan-300">
                {new Date(actualStart).toLocaleDateString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
};
