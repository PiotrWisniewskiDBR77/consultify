import { ExternalLink, Play, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export type AssessmentFrameworkPreviewModel = {
  id: string;
  framework: string;
  name: string;
  description: string;
  whatYouGet: string[];
  tags: string[];
};

export const AssessmentFrameworkPreviewV3Body: React.FC<{
  item: AssessmentFrameworkPreviewModel;
}> = ({ item }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t('assessment.preview.frameworkLabel', 'Framework')}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center h-6 px-2 rounded-full text-[11px] border border-slate-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.03] text-slate-700 dark:text-slate-200 font-mono">
            {String(item.framework || '').toUpperCase()}
          </span>
          <span className="inline-flex items-center h-6 px-2 rounded-full text-[11px] border border-danger-500/30 bg-danger-500/10 text-danger-600 dark:text-danger-300">
            {t('assessment.preview.assessmentLabel', 'Assessment')}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t('assessment.preview.descriptionLabel', 'Description')}
        </div>
        <div className="mt-2 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
          {item.description || '—'}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t('assessment.preview.whatYouGet', 'What you get')}
        </div>
        <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-200">
          {(item.whatYouGet || []).slice(0, 8).map((x) => (
            <li key={x} className="flex items-start gap-2">
              <span className="mt-2 w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span className="min-w-0">{x}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export const AssessmentFrameworkPreviewV3Footer: React.FC<{
  item: AssessmentFrameworkPreviewModel;
  onOpenFull: () => void;
  onStart: () => void;
  onChat: () => void;
}> = ({ onOpenFull, onStart, onChat }) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <button
        type="button"
        onClick={onChat}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-white/70 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/[0.08] text-primary-600 dark:text-primary-300 hover:bg-primary-50/70 dark:hover:bg-primary-500/10 transition-colors"
        title={t('common.ai', 'AI')}
      >
        <Sparkles size={14} />
        {t('common.ai', 'AI')}
      </button>

      <button
        type="button"
        onClick={onStart}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-primary-500/15 text-primary-600 dark:text-primary-400 hover:bg-primary-500/25 transition-colors"
      >
        <Play size={14} />
        {t('assessment.preview.startAssessment', 'Start assessment')}
      </button>

      <button
        type="button"
        onClick={onOpenFull}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
      >
        <ExternalLink size={14} />
        {t('common.open', 'Open')}
      </button>
    </div>
  );
};
