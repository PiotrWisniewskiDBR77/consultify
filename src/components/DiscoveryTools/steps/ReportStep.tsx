import { Download } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { ToolSession, ToolType } from '@/store/useToolStore';
import { exportToPDF } from '@/utils/pdfExport';

export function ReportStep(props: { toolType: ToolType; session: ToolSession; isPolish: boolean }) {
  const { toolType, session } = props;
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);

  const canExport = useMemo(() => typeof document !== 'undefined', []);

  const handleExport = async () => {
    if (!canExport) return;
    const el = document.getElementById('tool-report-export');
    if (!el) {
      toast.error(t('discoveryToolsSteps.reportStep.noExportableView'));
      return;
    }
    try {
      setExporting(true);
      const safeName = String(session.name || toolType)
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .toLowerCase();
      const date = new Date().toISOString().slice(0, 10);
      await exportToPDF('tool-report-export', {
        filename: `tool-report-${toolType}-${safeName}-${date}.pdf`,
        title: `${toolType} • Tool Report`,
        orientation: 'portrait',
      });
      toast.success(t('discoveryToolsSteps.reportStep.pdfExported'));
    } catch {
      toast.error(t('discoveryToolsSteps.reportStep.pdfExportFailed'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {t('discoveryToolsSteps.reportStep.title')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsSteps.reportStep.subtitle')}
        </p>
      </div>

      <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-900 dark:text-white">
              {t('discoveryToolsSteps.reportStep.pdfExport')}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t('discoveryToolsSteps.reportStep.pdfExportHint')}
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting
              ? t('discoveryToolsSteps.reportStep.exporting')
              : t('discoveryToolsSteps.reportStep.downloadPdf')}
          </button>
        </div>
      </div>
    </div>
  );
}
