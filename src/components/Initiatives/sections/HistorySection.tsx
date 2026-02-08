/**
 * HistorySection - Activity Log
 */

import { Clock, History } from 'lucide-react';
import React from 'react';

import { CollapsibleSection } from './CollapsibleSection';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const HistorySection: React.FC<InitiativeSectionProps> = ({ sectionType, expanded, onToggle }) => {
  const { history, isPolish } = useInitiativeContext();

  return (
    <CollapsibleSection
      id="history"
      title={isPolish ? 'Historia aktywności' : 'Activity Log'}
      icon={<History size={18} className="text-slate-500 dark:text-slate-400" />}
      iconBg="bg-gradient-to-br from-slate-500/10 to-gray-500/10 dark:from-slate-500/20 dark:to-gray-500/20"
      expanded={expanded}
      onToggle={onToggle}
      badge={history.length > 0 ? <span className="text-xs text-slate-400">{history.length}</span> : undefined}
    >
      {history.length === 0 ? (
        <div className="text-sm text-slate-400">{isPolish ? 'Brak historii.' : 'No history yet.'}</div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {history.map((e, idx) => (
            <div key={e.id} className="relative flex gap-3 pl-1">
              {idx < history.length - 1 && <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-slate-200 dark:bg-navy-700" />}
              <div className="relative z-10 flex-shrink-0 w-6 h-6 rounded-full bg-slate-400 dark:bg-slate-600 flex items-center justify-center">
                <Clock size={12} className="text-white" />
              </div>
              <div className="flex-1 min-w-0 pb-3">
                <p className="text-sm text-slate-700 dark:text-slate-300">{e.eventType}</p>
                <div className="flex items-center gap-2 mt-1">
                  {e.actorName && <span className="text-xs text-slate-500">{e.actorName}</span>}
                  <span className="text-xs text-slate-400">
                    {new Date(e.createdAt).toLocaleString(isPolish ? 'pl-PL' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </CollapsibleSection>
  );
};
