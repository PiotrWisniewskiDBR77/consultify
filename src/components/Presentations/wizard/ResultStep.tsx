import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { WizardSettings } from './types';

interface GenerationResult {
  slideCount: number;
  warnings: string[];
  exportPath?: string;
  deckId?: string;
  // A4 (2026-07-23): nie-blokujący sygnał jakości (Critic kompozycji + M19
  // walidacja strukturalna), liczony deterministycznie za ENABLE_DECK_QUALITY_GATES
  // (default ON). Informacyjny — nigdy nie blokuje pobrania/otwarcia decka.
  qualityGates?: {
    critic: { overallScore: number; regenerateSlides: number[]; passed: boolean };
    structural: { valid: boolean; errorCount: number; warningCount: number };
  };
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
  const [warningsExpanded, setWarningsExpanded] = useState(false);
  const warningCount = result.warnings.length;
  const critic = result.qualityGates?.critic;

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

      {warningCount > 0 && (
        <div className="bg-c-warning/5 border border-c-warning/20 rounded-xl overflow-hidden">
          <button
            type="button"
            aria-expanded={warningsExpanded}
            onClick={() => setWarningsExpanded((v) => !v)}
            className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-c-warning/10"
          >
            {warningsExpanded ? (
              <ChevronDown size={16} className="text-c-warning flex-shrink-0" />
            ) : (
              <ChevronRight size={16} className="text-c-warning flex-shrink-0" />
            )}
            <AlertTriangle size={16} className="text-c-warning flex-shrink-0" />
            <span className="font-medium text-c-warning text-sm">
              {t('presentations.result.qualityBadge', 'Jakość: {{count}} ostrzeżeń', {
                count: warningCount,
              })}
            </span>
            {critic && (
              <span className="ml-auto px-2 py-0.5 rounded-full text-[11px] font-medium bg-c-warning/10 text-c-warning">
                {t('presentations.result.qualityScore', 'Score {{score}}/100', {
                  score: critic.overallScore,
                })}
              </span>
            )}
          </button>
          {warningsExpanded && (
            <ul className="space-y-1 px-4 pb-4">
              {result.warnings.map((w, i) => (
                <li key={i} className="text-sm text-c-warning/90">
                  &bull; {w}
                </li>
              ))}
            </ul>
          )}
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
