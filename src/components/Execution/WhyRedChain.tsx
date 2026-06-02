/**
 * WhyRedChain — V4-EXEC-01
 * Displays the "why red" signal chain for red/amber initiatives:
 * signals → risks → decisions → tasks
 */

import { AlertTriangle, CheckSquare, Scale, Target } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface WhyRedSignal {
  type: string;
  message: string;
  entityId?: string;
}

export interface WhyRedRisk {
  id: string;
  title: string;
  severity?: string;
}

export interface WhyRedDecision {
  id: string;
  title: string;
  overdue?: boolean;
}

export interface WhyRedTask {
  id: string;
  title: string;
  status: string;
}

export interface WhyRedChainData {
  signals: WhyRedSignal[];
  risks: WhyRedRisk[];
  decisions: WhyRedDecision[];
  tasks: WhyRedTask[];
}

interface WhyRedChainProps {
  data: WhyRedChainData;
  compact?: boolean;
}

export const WhyRedChain: React.FC<WhyRedChainProps> = ({ data, compact }) => {
  const { t } = useTranslation();
  const hasContent =
    (data.signals?.length ?? 0) > 0 ||
    (data.risks?.length ?? 0) > 0 ||
    (data.decisions?.length ?? 0) > 0 ||
    (data.tasks?.length ?? 0) > 0;

  if (!hasContent) return null;

  if (compact) {
    const items: string[] = [];
    data.signals?.forEach((s) => items.push(s.message));
    if ((data.risks?.length ?? 0) > 0) {
      items.push(
        t('execution.whyRed.risksCount', '{{count}} risk(s)', {
          count: data.risks.length,
        })
      );
    }
    if ((data.tasks?.length ?? 0) > 0) {
      items.push(
        t('execution.whyRed.tasksCount', '{{count}} task(s)', {
          count: data.tasks.length,
        })
      );
    }
    if ((data.decisions?.length ?? 0) > 0) {
      items.push(
        t('execution.whyRed.decisionsCount', '{{count}} decision(s)', {
          count: data.decisions.length,
        })
      );
    }
    return (
      <div className="flex flex-wrap gap-1.5 text-xs text-slate-600 dark:text-slate-400">
        {items.slice(0, 3).map((msg, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400"
          >
            {msg}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="why-rose-chain">
      {data.signals && data.signals.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
            <AlertTriangle size={12} className="text-rose-500" />
            {t('execution.whyRed.signals', 'Signals')}
          </div>
          <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
            {data.signals.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-rose-500">•</span>
                <span>{s.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.risks && data.risks.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
            <Target size={12} className="text-amber-500" />
            {t('execution.whyRed.risks', 'Risks')}
          </div>
          <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
            {data.risks.slice(0, 5).map((r) => (
              <li key={r.id} className="flex items-start gap-2 truncate">
                <span className="text-amber-500">•</span>
                <span className="truncate">{r.title}</span>
                {r.severity && (
                  <span className="text-[10px] text-slate-400 shrink-0">{r.severity}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.decisions && data.decisions.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
            <Scale size={12} className="text-blue-500" />
            {t('execution.whyRed.decisions', 'Decisions')}
          </div>
          <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
            {data.decisions.slice(0, 5).map((d) => (
              <li key={d.id} className="flex items-start gap-2 truncate">
                <span className="text-blue-500">•</span>
                <span className="truncate">{d.title}</span>
                {d.overdue && (
                  <span className="text-[10px] text-rose-500 shrink-0">
                    {t('execution.whyRed.overdue', 'Overdue')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.tasks && data.tasks.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
            <CheckSquare size={12} className="text-primary-500" />
            {t('execution.whyRed.tasks', 'Tasks')}
          </div>
          <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
            {data.tasks.slice(0, 5).map((t) => (
              <li key={t.id} className="flex items-start gap-2 truncate">
                <span className="text-primary-500">•</span>
                <span className="truncate">{t.title}</span>
                <span className="text-[10px] text-slate-400 shrink-0 uppercase">{t.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
