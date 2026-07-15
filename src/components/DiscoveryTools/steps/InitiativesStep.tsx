import { ArrowRight, ListTodo, MessageSquareText } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { InitiativeDraft, ToolSession, ToolType } from '@/store/useToolStore';

export function InitiativesStep(props: {
  toolType: ToolType;
  session: ToolSession;
  isPolish: boolean;
  generatedInitiatives?: { id: string; title: string; status?: string }[];
  onOpenInitiatives?: () => void;
  onOpenChat?: () => void;
}) {
  const { toolType, session, generatedInitiatives, onOpenInitiatives, onOpenChat } = props;
  const { t } = useTranslation();

  const localDrafts: InitiativeDraft[] = Array.isArray(session.generatedInitiatives)
    ? session.generatedInitiatives
    : [];
  const apiDrafts = Array.isArray(generatedInitiatives) ? generatedInitiatives : [];

  const hasAny = apiDrafts.length > 0 || localDrafts.length > 0;
  const summary = (session.inputData as any)?.flow?.results?.executiveSummary || '';
  const keyFindings: string[] = (session.inputData as any)?.flow?.results?.keyFindings || [];

  const title = t('discoveryToolsSteps.initiativesStep.title');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsSteps.initiativesStep.subtitle')}
        </p>
      </div>

      {(summary || keyFindings.length > 0) && (
        <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
          <div className="text-sm font-medium text-slate-900 dark:text-white mb-2">
            {t('discoveryToolsSteps.initiativesStep.summary')}
          </div>
          {summary && (
            <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {summary}
            </div>
          )}
          {keyFindings.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-slate-700 dark:text-slate-300">
              {keyFindings.slice(0, 6).map((k, idx) => (
                <li key={`${idx}-${k}`} className="flex items-start gap-2">
                  <span className="mt-2 w-1.5 h-1.5 rounded-full bg-primary-400" />
                  <span>{k}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {onOpenInitiatives && (
          <button
            onClick={onOpenInitiatives}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800"
          >
            <ArrowRight className="w-4 h-4" />
            {t('discoveryToolsSteps.initiativesStep.openInitiatives')}
          </button>
        )}
        {onOpenChat && (
          <button
            onClick={onOpenChat}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-navy-700"
          >
            <MessageSquareText className="w-4 h-4" />
            {t('discoveryToolsSteps.initiativesStep.openChat')}
          </button>
        )}
      </div>

      <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
          <ListTodo className="w-4 h-4 text-slate-500" />
          <span>{t('discoveryToolsSteps.initiativesStep.generatedInitiatives')}</span>
          <span className="text-xs text-slate-500">
            ({apiDrafts.length || localDrafts.length || 0})
          </span>
        </div>

        {!hasAny ? (
          <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            {t('discoveryToolsSteps.initiativesStep.noInitiativesHint')}
          </div>
        ) : (
          <ul className="mt-3 space-y-2">
            {apiDrafts.map((i) => (
              <li
                key={i.id}
                className="p-3 rounded-lg border border-slate-200 dark:border-navy-700 text-sm text-slate-700 dark:text-slate-200"
              >
                {i.title}
                {i.status ? (
                  <span className="ml-2 text-xs text-slate-500">({i.status})</span>
                ) : null}
              </li>
            ))}
            {apiDrafts.length === 0 &&
              localDrafts.map((i) => (
                <li
                  key={i.id}
                  className="p-3 rounded-lg border border-slate-200 dark:border-navy-700 text-sm text-slate-700 dark:text-slate-200"
                >
                  {i.title}
                </li>
              ))}
          </ul>
        )}
      </div>

      <div className="text-xs text-slate-500 dark:text-slate-400">
        {t('discoveryToolsSteps.initiativesStep.toolType', { toolType })}
      </div>
    </div>
  );
}
