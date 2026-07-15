/**
 * PDF Export Modal
 *
 * Modal for configuring and exporting digitization analysis to PDF.
 * Supports multiple templates and languages.
 */

import {
  CheckCircle,
  Download,
  FileCheck,
  FileText,
  Globe,
  Layout,
  Loader2,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { DigitizationAnalysis } from './types';

interface PDFExportModalProps {
  analysis: DigitizationAnalysis;
  onClose: () => void;
}

type PDFTemplate = 'executive' | 'full' | 'gap_analysis';
type ExportLanguage = 'pl' | 'en';

const TEMPLATES: Array<{
  id: PDFTemplate;
  namePl: string;
  nameEn: string;
  descriptionPl: string;
  descriptionEn: string;
  icon: typeof FileText;
}> = [
  {
    id: 'executive',
    namePl: 'Podsumowanie wykonawcze',
    nameEn: 'Executive Totalmary',
    descriptionPl: '1-2 strony z kluczowymi scoreami i recommendationmi',
    descriptionEn: '1-2 pages with key results and recommendations',
    icon: FileCheck,
  },
  {
    id: 'full',
    namePl: 'Full Report',
    nameEn: 'Full Report',
    descriptionPl: 'Complete report with all details per axis',
    descriptionEn: 'Complete report with all axis details',
    icon: FileText,
  },
  {
    id: 'gap_analysis',
    namePl: 'Analiza luk',
    nameEn: 'Gap Analysis',
    descriptionPl: 'Detailed analysis gaps with prioritization',
    descriptionEn: 'Detailed gap analysis with prioritization',
    icon: Layout,
  },
];

export const PDFExportModal: React.FC<PDFExportModalProps> = ({ analysis, onClose }) => {
  const { t } = useTranslation();
  const [template, setTemplate] = useState<PDFTemplate>('executive');
  const [language, setLanguage] = useState<ExportLanguage>('pl');
  const [includeRecommendations, setIncludeRecommendations] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ success: boolean; url?: string } | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setExportResult(null);

    try {
      const result = await Api.exportDigitizationPDF(analysis.id, {
        template,
        language,
        recommendations: includeRecommendations,
      });

      setExportResult({ success: true, url: result.downloadUrl });
      toast.success(
        language === 'pl' ? 'PDF generated successfully' : 'PDF generated successfully'
      );
    } catch (error: any) {
      toast.error(
        error.message || (language === 'pl' ? 'Failed to generate PDF' : 'Failed to generate PDF')
      );
      setExportResult({ success: false });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = () => {
    if (exportResult?.url) {
      window.open(exportResult.url, '_blank');
    }
  };

  // Language of the EXPORTED PDF template content (user-selectable, independent
  // of the app's own UI language) — used only to pick namePl/nameEn etc. below.
  const isTemplatePl = language === 'pl';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-overlay p-4">
      <div className="bg-white dark:bg-navy-900 rounded-xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
              <FileText className="text-rose-500" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-navy-900 dark:text-white">
                {t('economics.pdfExport.title', 'Export to PDF')}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{analysis.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-600 dark:text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Language selector */}
          <div>
            <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
              <Globe size={14} className="inline mr-2" />
              {t('economics.pdfExport.reportLanguage', 'Report Language')}
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setLanguage('pl')}
                className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${
                  language === 'pl'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'
                }`}
              >
                🇵🇱 Polski
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={`flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all ${
                  language === 'en'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'
                }`}
              >
                🇬🇧 English
              </button>
            </div>
          </div>

          {/* Template selector */}
          <div>
            <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
              <Layout size={14} className="inline mr-2" />
              {t('economics.pdfExport.reportTemplate', 'Report Template')}
            </label>
            <div className="space-y-2">
              {TEMPLATES.map((tpl) => {
                const Icon = tpl.icon;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => setTemplate(tpl.id)}
                    className={`w-full p-3 rounded-xl text-left transition-all flex items-start gap-3 ${
                      template === tpl.id
                        ? 'bg-emerald-500/10 border-2 border-emerald-500'
                        : 'bg-slate-50 dark:bg-navy-800 border-2 border-transparent hover:border-slate-200 dark:border-navy-700'
                    }`}
                  >
                    <Icon
                      size={20}
                      className={
                        template === tpl.id
                          ? 'text-emerald-500'
                          : 'text-slate-600 dark:text-slate-500'
                      }
                    />
                    <div>
                      <p
                        className={`font-medium ${
                          template === tpl.id ? 'text-emerald-600' : 'text-navy-900 dark:text-white'
                        }`}
                      >
                        {isTemplatePl ? tpl.namePl : tpl.nameEn}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {isTemplatePl ? tpl.descriptionPl : tpl.descriptionEn}
                      </p>
                    </div>
                    {template === tpl.id && (
                      <CheckCircle size={18} className="text-emerald-500 ml-auto" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Options */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={includeRecommendations}
                onChange={(e) => setIncludeRecommendations(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-sm text-navy-900 dark:text-white">
                {t('economics.pdfExport.includeRecommendations', 'Include recommendations')}
              </span>
            </label>
          </div>

          {/* Export result */}
          {exportResult?.success && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/20">
              <div className="flex items-center gap-3">
                <CheckCircle className="text-emerald-500" size={20} />
                <div className="flex-1">
                  <p className="font-medium text-emerald-700 dark:text-emerald-400">
                    {t('economics.pdfExport.ready', 'PDF ready for download!')}
                  </p>
                </div>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors"
                >
                  <Download size={16} />
                  {t('economics.pdfExport.download', 'Download')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-navy-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl font-medium transition-colors"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-6 py-2 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-300 text-white rounded-xl font-medium transition-colors"
          >
            {isExporting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {t('economics.pdfExport.generating', 'Generating...')}
              </>
            ) : (
              <>
                <FileText size={16} />
                {t('economics.pdfExport.generate', 'Generate PDF')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PDFExportModal;
