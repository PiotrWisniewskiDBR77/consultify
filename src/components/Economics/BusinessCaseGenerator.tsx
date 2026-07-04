/**
 * Business Case Generator Component
 *
 * Generates comprehensive business case documents from economic analysis data.
 * Supports multiple formats and customizable sections.
 */

import {
  AlertCircle,
  Building2,
  Check,
  ChevronDown,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Languages,
  Loader2,
  Settings,
  Shield,
  TrendingUp,
} from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

import { Api } from '../../services/api';

interface BusinessCaseGeneratorProps {
  analysisId: string;
  analysisName: string;
  hasFinancialData?: boolean;
  onGenerate?: (url: string) => void;
}

interface GenerationOptions {
  format: 'pdf' | 'docx';
  language: 'pl' | 'en';
  sections: {
    executiveSummary: boolean;
    problemStatement: boolean;
    proposedSolution: boolean;
    financialAnalysis: boolean;
    riskAssessment: boolean;
    implementation: boolean;
    recommendations: boolean;
  };
  includeCharts: boolean;
  includeAppendices: boolean;
}

const defaultOptions: GenerationOptions = {
  format: 'pdf',
  language: 'pl',
  sections: {
    executiveSummary: true,
    problemStatement: true,
    proposedSolution: true,
    financialAnalysis: true,
    riskAssessment: true,
    implementation: true,
    recommendations: true,
  },
  includeCharts: true,
  includeAppendices: false,
};

export const BusinessCaseGenerator: React.FC<BusinessCaseGeneratorProps> = ({
  analysisId,
  analysisName,
  hasFinancialData = false,
  onGenerate,
}) => {
  const [options, setOptions] = useState<GenerationOptions>(defaultOptions);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<{ url: string; timestamp: Date } | null>(null);

  const sectionLabels: Record<
    keyof GenerationOptions['sections'],
    { label: string; icon: React.ReactNode }
  > = {
    executiveSummary: { label: 'Streszczenie wykonawcze', icon: <FileText size={16} /> },
    problemStatement: { label: 'Opis problemu', icon: <AlertCircle size={16} /> },
    proposedSolution: { label: 'Proposed Solution', icon: <Building2 size={16} /> },
    financialAnalysis: { label: 'Analiza finansowa', icon: <TrendingUp size={16} /> },
    riskAssessment: { label: 'Ocena ryzyka', icon: <Shield size={16} /> },
    implementation: { label: 'Implementation Plan', icon: <Settings size={16} /> },
    recommendations: { label: 'Recommendations', icon: <Check size={16} /> },
  };

  const toggleSection = (section: keyof GenerationOptions['sections']) => {
    setOptions((prev) => ({
      ...prev,
      sections: {
        ...prev.sections,
        [section]: !prev.sections[section],
      },
    }));
  };

  const handleGenerate = async () => {
    // Validate at least one section selected
    const hasSelectedSections = Object.values(options.sections).some((v) => v);
    if (!hasSelectedSections) {
      toast.error('Select at least one section document');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await Api.generateBusinessCase(analysisId, {
        format: options.format,
        language: options.language,
        includeExecutiveSummary: options.sections.executiveSummary,
        includeFinancialAnalysis: options.sections.financialAnalysis,
        includeRiskAssessment: options.sections.riskAssessment,
      });

      setLastGenerated({ url: result.downloadUrl, timestamp: new Date() });
      toast.success('Business Case generated successfully');

      if (onGenerate) {
        onGenerate(result.downloadUrl);
      }

      // Auto-download
      window.open(result.downloadUrl, '_blank');
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate document');
    } finally {
      setIsGenerating(false);
    }
  };

  const selectedSectionsCount = Object.values(options.sections).filter(Boolean).length;
  const totalSections = Object.keys(options.sections).length;

  return (
    <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-navy-900 dark:text-white flex items-center gap-2">
            <FileText size={20} className="text-indigo-500" />
            Generator Business Case
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Wygeneruj profesjonalny dokument uzasadnienia biznesowego
          </p>
        </div>
        <button
          onClick={() => setShowOptions(!showOptions)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 dark:text-slate-400
                        hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5
                        rounded-lg transition-colors"
        >
          <Settings size={16} />
          Opcje
          <ChevronDown
            size={14}
            className={`transition-transform ${showOptions ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <button
          onClick={() => setOptions((prev) => ({ ...prev, format: 'pdf' }))}
          className={`p-4 rounded-xl border transition-all ${
            options.format === 'pdf'
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
              : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-c-border'
          }`}
        >
          <FileText
            size={24}
            className={`mx-auto mb-2 ${options.format === 'pdf' ? 'text-indigo-500' : 'text-slate-600 dark:text-slate-500'}`}
          />
          <p
            className={`text-sm font-medium ${options.format === 'pdf' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}
          >
            PDF
          </p>
        </button>
        <button
          onClick={() => setOptions((prev) => ({ ...prev, format: 'docx' }))}
          className={`p-4 rounded-xl border transition-all ${
            options.format === 'docx'
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
              : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-c-border'
          }`}
        >
          <FileSpreadsheet
            size={24}
            className={`mx-auto mb-2 ${options.format === 'docx' ? 'text-indigo-500' : 'text-slate-600 dark:text-slate-500'}`}
          />
          <p
            className={`text-sm font-medium ${options.format === 'docx' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}
          >
            Word (DOCX)
          </p>
        </button>
      </div>

      {/* Options Panel */}
      {showOptions && (
        <div className="mb-6 p-4 bg-slate-50 dark:bg-navy-900 rounded-xl space-y-4">
          {/* Language */}
          <div>
            <label className="text-sm font-medium text-navy-900 dark:text-white mb-2 block">
              <Languages size={14} className="inline mr-1.5" />
              Document language
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setOptions((prev) => ({ ...prev, language: 'pl' }))}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
                  options.language === 'pl'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-navy-700'
                }`}
              >
                🇵🇱 Polski
              </button>
              <button
                onClick={() => setOptions((prev) => ({ ...prev, language: 'en' }))}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-colors ${
                  options.language === 'en'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-navy-700'
                }`}
              >
                🇬🇧 English
              </button>
            </div>
          </div>

          {/* Sections */}
          <div>
            <label className="text-sm font-medium text-navy-900 dark:text-white mb-2 block">
              Sekcje document ({selectedSectionsCount}/{totalSections})
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(
                Object.entries(sectionLabels) as [
                  keyof GenerationOptions['sections'],
                  { label: string; icon: React.ReactNode },
                ][]
              ).map(([key, { label, icon }]) => (
                <button
                  key={key}
                  onClick={() => toggleSection(key)}
                  className={`flex items-center gap-2 p-2 rounded-lg text-sm transition-colors ${
                    options.sections[key]
                      ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400'
                      : 'bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-navy-700'
                  }`}
                >
                  {options.sections[key] ? (
                    <Check size={14} className="text-indigo-500" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded border border-slate-300 dark:border-c-border" />
                  )}
                  {icon}
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Additional Options */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options.includeCharts}
                onChange={(e) =>
                  setOptions((prev) => ({ ...prev, includeCharts: e.target.checked }))
                }
                className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Wykresy i wizualizacje
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={options.includeAppendices}
                onChange={(e) =>
                  setOptions((prev) => ({ ...prev, includeAppendices: e.target.checked }))
                }
                className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm text-slate-600 dark:text-slate-400">Attachments</span>
            </label>
          </div>
        </div>
      )}

      {/* Warning if no financial data */}
      {!hasFinancialData && options.sections.financialAnalysis && (
        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 text-sm">
            <AlertCircle size={16} />
            <span>No financial data. Financial analysis section will be incomplete.</span>
          </div>
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={handleGenerate}
        disabled={isGenerating || selectedSectionsCount === 0}
        className="w-full py-3 px-4 bg-gradient-to-r from-crimson-600 to-primary-600 hover:from-crimson-500 hover:to-primary-500
                    text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed
                    shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30"
      >
        {isGenerating ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={18} className="animate-spin" />
            Generating document...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Download size={18} />
            Generuj Business Case ({options.format.toUpperCase()})
          </span>
        )}
      </button>

      {/* Last Generated */}
      {lastGenerated && (
        <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-sm">
              <Check size={16} />
              <span>Wygenerowano {lastGenerated.timestamp.toLocaleTimeString('pl-PL')}</span>
            </div>
            <a
              href={lastGenerated.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              <Eye size={14} />
              Open
            </a>
          </div>
        </div>
      )}

      {/* Preview Info */}
      <div className="mt-4 pt-4 border-t border-slate-200 dark:border-navy-700">
        <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
          Document will contain data from analysis: <strong>{analysisName}</strong>
        </p>
      </div>
    </div>
  );
};

export default BusinessCaseGenerator;
