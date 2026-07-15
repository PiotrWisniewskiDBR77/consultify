import { AlertCircle } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { NudgeData } from './useHomeData';

interface GentleNudgeProps {
  data: NudgeData;
  onViewDetails?: () => void;
}

export const GentleNudge: React.FC<GentleNudgeProps> = ({ data, onViewDetails }) => {
  const { t } = useTranslation();

  const hasContent = data.pendingDecisions > 0 || data.overdueTasks > 0 || data.message;
  if (!hasContent) return null;

  const parts: string[] = [];
  if (data.pendingDecisions > 0) {
    parts.push(t('myWork.gentleNudge.decisionsWaiting', { count: data.pendingDecisions }));
  }
  if (data.overdueTasks > 0) {
    parts.push(t('myWork.gentleNudge.tasksOverdue', { count: data.overdueTasks }));
  }

  const text = data.message || parts.join(' · ');

  return (
    <button
      onClick={onViewDetails}
      className="flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-xl bg-amber-500/[0.04] border border-amber-500/[0.08] text-sm text-slate-600 dark:text-slate-400 hover:bg-amber-500/[0.08] transition-all cursor-pointer animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500"
    >
      <AlertCircle size={15} className="text-amber-500" />
      <span>{text}</span>
      <span className="text-primary-400 font-semibold ml-1">
        {t('myWork.gentleNudge.view', 'View')} &rarr;
      </span>
    </button>
  );
};
