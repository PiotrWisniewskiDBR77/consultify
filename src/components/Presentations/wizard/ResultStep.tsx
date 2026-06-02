import { ArrowLeft, Check, Download, ExternalLink } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { WizardSettings } from './types';

interface GenerationResult {
  slideCount: number;
  warnings: string[];
  exportPath?: string;
  deckId?: string;
}

interface ResultStepProps {
  result: GenerationResult;
  settings: WizardSettings;
  onDownload: () => void;
  onEditOutline: () => void;
  onOpenBuilder?: () => void;
}

export const ResultStep: React.FC<ResultStepProps> = ({
  result,
  settings,
  onDownload,
  onEditOutline,
  onOpenBuilder,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl bg-green-500/20 flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          {t('presentations.result.ready', 'Your Deck is Ready!')}
        </h2>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          {result.slideCount}{' '}
          {t('presentations.result.slidesGenerated', 'slides generated successfully')}
        </p>
      </div>

      {result.warnings.length > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-500/5 border border-yellow-200 dark:border-yellow-500/20 rounded-xl p-4">
          <p className="font-medium text-yellow-800 dark:text-yellow-400 text-sm mb-2">
            {t('presentations.result.warnings', 'Quality Warnings')}
          </p>
          <ul className="space-y-1">
            {result.warnings.map((w, i) => (
              <li key={i} className="text-sm text-yellow-700 dark:text-yellow-300/80">
                &bull; {w}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        {onOpenBuilder && (
          <button
            onClick={onOpenBuilder}
            className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-primary-600 to-blue-600 text-white font-semibold rounded-xl hover:from-primary-500 hover:to-blue-500 shadow-lg shadow-primary-500/25 text-lg"
          >
            <ExternalLink size={20} /> {t('presentations.result.openBuilder', 'Open Deck Builder')}
          </button>
        )}
        <button
          onClick={onDownload}
          className={`flex items-center gap-2 px-8 py-4 font-semibold rounded-xl text-lg ${
            onOpenBuilder
              ? 'border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
              : 'bg-gradient-to-r from-primary-600 to-blue-600 text-white hover:from-primary-500 hover:to-blue-500 shadow-lg shadow-primary-500/25'
          }`}
        >
          <Download size={20} /> {t('presentations.result.downloadPptx', 'Download PPTX')}
        </button>
        <button
          onClick={onEditOutline}
          className="flex items-center gap-2 px-6 py-3 border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-navy-800"
        >
          <ArrowLeft size={16} /> {t('presentations.result.editOutline', 'Edit & Regenerate')}
        </button>
      </div>

      <div className="bg-slate-50 dark:bg-navy-800 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
          <span>
            <strong>{result.slideCount}</strong> {t('presentations.outline.slides', 'slides')}
          </span>
          <span>&middot;</span>
          <span className="capitalize">{settings.presentationMode}</span>
          <span>&middot;</span>
          <span>{settings.language.toUpperCase()}</span>
          <span>&middot;</span>
          <span className="capitalize">{settings.confidentiality}</span>
        </div>
      </div>
    </div>
  );
};
