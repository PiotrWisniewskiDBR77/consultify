/**
 * ExportButton (V3-I01)
 *
 * Button for properties strip to export financial analysis to report or presentation.
 * DBR77: pill (rounded-full), secondary styling with Download icon.
 */

import { Download } from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import type { ExportResult } from '@/services/financeExportService';

import { ExportToOutputDialog } from './ExportToOutputDialog';

export interface ExportButtonProps {
  analysisId: string;
  analysisTitle: string;
  analysisType: string;
  relatedInitiativeIds?: string[];
  className?: string;
}

export const ExportButton: React.FC<ExportButtonProps> = ({
  analysisId,
  analysisTitle,
  analysisType,
  relatedInitiativeIds,
  className = '',
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleExportComplete = (result: ExportResult) => {
    const outputUrl = `/reports/builder/${result.outputId}`;
    // Canonical alias: /finance (keeps backwards compatibility with /economics)
    const sourceUrl = `/finance`;

    toast.custom(
      (toastInstance) => (
        <div
          className={`${
            toastInstance.visible ? 'animate-enter' : 'animate-leave'
          } max-w-md w-full bg-white dark:bg-navy-900 shadow-xl rounded-xl pointer-events-auto ring-1 ring-slate-200 dark:ring-navy-700 overflow-hidden`}
        >
          <div className="p-4">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {t('finance.export.toastSuccess', 'Draft created successfully')}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {result.title}
            </p>
            <div className="flex items-center gap-3 mt-3">
              <button
                onClick={() => {
                  navigate(outputUrl);
                  toast.dismiss(toastInstance.id);
                }}
                className="text-sm font-medium text-purple-500 hover:text-purple-400 transition-colors"
              >
                {t('finance.export.openOutput', 'Open output')}
              </button>
              <button
                onClick={() => {
                  navigate(sourceUrl);
                  toast.dismiss(toastInstance.id);
                }}
                className="text-sm font-medium text-purple-500 hover:text-purple-400 transition-colors"
              >
                {t('finance.export.openSource', 'Open source')}
              </button>
            </div>
          </div>
        </div>
      ),
      { duration: 6000, position: 'bottom-right' }
    );
  };

  return (
    <>
      <button
        onClick={() => setDialogOpen(true)}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors border border-slate-200 dark:border-navy-600 ${className}`}
      >
        <Download size={16} />
        {t('finance.export.button', 'Export')}
      </button>

      <ExportToOutputDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        analysisId={analysisId}
        analysisTitle={analysisTitle}
        analysisType={analysisType}
        relatedInitiativeIds={relatedInitiativeIds}
        onExportComplete={handleExportComplete}
      />
    </>
  );
};
