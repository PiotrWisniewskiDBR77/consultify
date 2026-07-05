/**
 * ConvertToConfirmation (V3-C02)
 * Toast/notification after successful MyWork conversion.
 * Shows "Created [type] from [source]" with action links.
 * DBR77: rounded-lg, dark bg, action links in primary color.
 */

import type { TFunction } from 'i18next';
import { ExternalLink, FileText } from 'lucide-react';
import React from 'react';
import toast, { type Toast, type ToastOptions } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

export interface ConvertToConfirmationOptions {
  outputType: string;
  outputId: string;
  sourceTitle: string;
  sessionId: string;
  onOpenOutput?: () => void;
  onOpenSession?: () => void;
}

const OUTPUT_TYPE_LABELS: Record<string, { en: string; pl: string }> = {
  initiative: { en: 'Initiative', pl: 'Inicjatywa' },
  report: { en: 'Report', pl: 'Raport' },
  presentation: { en: 'Presentation', pl: 'Prezentacja' },
  financial_model: { en: 'Financial Model', pl: 'Model finansowy' },
  budget: { en: 'Budget', pl: 'Budżet' },
  valuation: { en: 'Valuation', pl: 'Wycena' },
  analysis: { en: 'Financial Analysis', pl: 'Analiza finansowa' },
};

function ConvertToConfirmationContent({
  outputType,
  sourceTitle,
  onOpenOutput,
  onOpenSession,
  t,
  i18n,
}: {
  outputType: string;
  sourceTitle: string;
  onOpenOutput?: () => void;
  onOpenSession?: () => void;
  t: TFunction;
  i18n: { language: string };
}) {
  const isPl = i18n.language === 'pl';
  const typeLabel = OUTPUT_TYPE_LABELS[outputType]?.[isPl ? 'pl' : 'en'] ?? outputType;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-c-text">
        {t('traceability.convertTo.createdFrom', {
          defaultValue: 'Created {{type}} from {{source}}',
          type: typeLabel,
          source: sourceTitle.slice(0, 60) + (sourceTitle.length > 60 ? '…' : ''),
        })}
      </p>
      <div className="flex items-center gap-3">
        {onOpenOutput && (
          <button
            type="button"
            onClick={() => {
              onOpenOutput();
              toast.dismiss();
            }}
            className="flex items-center gap-1.5 text-xs font-medium text-c-accent hover:text-c-accent/80 hover:underline transition-colors"
          >
            <ExternalLink size={12} />
            {t('traceability.convertTo.openOutput', 'Open output')}
          </button>
        )}
        {onOpenSession && (
          <button
            type="button"
            onClick={() => {
              onOpenSession();
              toast.dismiss();
            }}
            className="flex items-center gap-1.5 text-xs font-medium text-c-accent hover:text-c-accent/80 hover:underline transition-colors"
          >
            <FileText size={12} />
            {t('traceability.convertTo.openSourceSession', 'Open source session')}
          </button>
        )}
      </div>
    </div>
  );
}

/** Inner toast content - uses useTranslation so must be a component */
function ToastContent({
  toastInstance,
  options,
}: {
  toastInstance: Toast;
  options: ConvertToConfirmationOptions;
}) {
  const { t, i18n } = useTranslation();
  const { outputType, sourceTitle, onOpenOutput, onOpenSession } = options;

  return (
    <div
      className={`rounded-lg bg-c-surface-raised border border-c-border-subtle px-4 py-3 shadow-xl transition-all ${
        toastInstance.visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <ConvertToConfirmationContent
        outputType={outputType}
        sourceTitle={sourceTitle}
        onOpenOutput={onOpenOutput}
        onOpenSession={onOpenSession}
        t={t}
        i18n={i18n}
      />
    </div>
  );
}

export const ConvertToConfirmation = {
  show: (options: ConvertToConfirmationOptions, toastOptions?: Partial<ToastOptions>) => {
    toast.custom((t: Toast) => <ToastContent toastInstance={t} options={options} />, {
      duration: 8000,
      position: 'bottom-right',
      ...toastOptions,
    });
  },
};

export default ConvertToConfirmation;
