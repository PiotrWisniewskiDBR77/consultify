/**
 * Consultify Document Studio — Outline Panel (MVP-1, Mode 1).
 *
 * Shows the deterministic outline returned by /document-studio/plan and lets
 * the user generate the document artifact (calling /generate).
 */

import { ChevronLeft, Loader2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import Button from '@/components/ui/primitives/Button';

import type { DocumentOutline } from './types';

interface DocumentStudioOutlinePanelProps {
  outline: DocumentOutline;
  onGenerate: () => void | Promise<void>;
  onBack: () => void;
  generating?: boolean;
  error?: string | null;
}

export const DocumentStudioOutlinePanel: React.FC<DocumentStudioOutlinePanelProps> = ({
  outline,
  onGenerate,
  onBack,
  generating,
  error,
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-c-text">{outline.title}</h2>
          <p className="mt-1 text-sm text-c-text-muted">
            {t('documentStudio.outline.type', 'Type')}:{' '}
            <span className="font-medium">{outline.documentType}</span> ·{' '}
            {t('documentStudio.outline.density', 'Density')}:{' '}
            <span className="font-medium">{outline.recommendedDensity}</span> ·{' '}
            {t('documentStudio.outline.register', 'Register')}:{' '}
            <span className="font-medium">{outline.recommendedRegister}</span> ·{' '}
            {t('documentStudio.outline.style', 'Style')}:{' '}
            <span className="font-medium">{outline.recommendedLanguageStyle}</span>
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onBack} disabled={generating}>
          <span className="inline-flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" />
            {t('documentStudio.outline.back', 'Back')}
          </span>
        </Button>
      </div>

      <ol className="flex flex-col gap-2">
        {outline.sections.map((section, idx) => (
          <li
            key={`${section.title}-${idx}`}
            className="rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3 text-sm"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium text-c-text">
                {idx + 1}. {section.title}
              </span>
              <span className="text-xs uppercase tracking-wide text-c-text-secondary">
                {section.expectedLengthHint}
              </span>
            </div>
            <p className="mt-1 text-xs text-c-text-muted">{section.purpose}</p>
          </li>
        ))}
      </ol>

      {error ? (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-danger-500/30 bg-danger-500/10 px-3 py-2 text-sm text-danger-700 dark:text-danger-400"
        >
          {error}
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-end gap-2">
        <Button type="button" variant="primary" onClick={onGenerate} disabled={generating}>
          {generating ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('documentStudio.outline.generating', 'Generating…')}
            </span>
          ) : (
            t('documentStudio.outline.generate', 'Generate document')
          )}
        </Button>
      </div>
    </div>
  );
};

export default DocumentStudioOutlinePanel;
