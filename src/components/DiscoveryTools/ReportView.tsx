/**
 * ReportView - Full report display with export options
 *
 * Displays comprehensive analysis report from strategic tools.
 * Supports PDF and image export for sharing and presentations.
 */

import React, { useRef, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  X,
  FileText,
  Download,
  Image,
  FileJson,
  Printer,
  Share2,
  Copy,
  Check,
  Calendar,
  User,
  Building,
  TrendingUp,
  Target,
  Lightbulb,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

import {
  ToolType,
  ToolSession,
  SWOTData,
  PorterData,
  InitiativeDraft,
  SWOTItem,
  SWOTCorrelation,
} from '@/store/useToolStore';
import { SWOTMatrix } from './visualizations/SWOTMatrix';
import { PorterRadar } from './visualizations/PorterRadar';
import { exportStrategicToolToPDF, exportStrategicToolToImage } from '@/services/pdf/pdfExport';

// ==================== TYPES ====================

interface ReportViewProps {
  isOpen: boolean;
  onClose: () => void;
  toolType: ToolType;
  session: ToolSession;
  organizationName?: string;
  isPolish: boolean;
}

interface ExportFormat {
  id: string;
  label: { en: string; pl: string };
  icon: React.ElementType;
  handler: () => void;
}

// ==================== TOOL METADATA ====================

const TOOL_NAMES: Record<ToolType, { en: string; pl: string }> = {
  'dynamic-swot': { en: 'Dynamic SWOT Analysis', pl: 'Dynamiczna Analiza SWOT' },
  'market-forces': { en: "Porter's Five Forces Analysis", pl: 'Analiza Pięciu Sił Portera' },
  'growth-paths': { en: 'Growth Paths Analysis', pl: 'Analiza Ścieżek Wzrostu' },
  'value-chain': { en: 'Value Chain Analysis', pl: 'Analiza Łańcucha Wartości' },
  'portfolio-priority': { en: 'Portfolio Prioritization', pl: 'Priorytetyzacja Portfolio' },
  'ambition-decomposer': { en: 'Ambition Decomposer', pl: 'Dekompozycja Ambicji' },
  'focus-tradeoff': { en: 'Focus & Trade-off Engine', pl: 'Silnik Fokusu i Kompromisów' },
  'risk-uncertainty': { en: 'Risk & Uncertainty Mapper', pl: 'Mapa Ryzyka i Niepewności' },
  'capability-mapper': { en: 'Capability Mapper', pl: 'Mapa Kompetencji' },
  'narrative-engine': { en: 'Narrative Engine', pl: 'Silnik Narracji' },
};

// ==================== COMPONENT ====================

export const ReportView: React.FC<ReportViewProps> = ({
  isOpen,
  onClose,
  toolType,
  session,
  organizationName = 'Organization',
  isPolish,
}) => {
  const { t } = useTranslation();
  const lang = isPolish ? 'pl' : 'en';
  const reportRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);

  // Get report data based on tool type
  const getReportData = useCallback(() => {
    const inputData = session.inputData;

    if (toolType === 'dynamic-swot') {
      const swotData = inputData as SWOTData;
      return {
        context: swotData.context,
        items: swotData.items,
        correlations: swotData.correlations,
        summary: swotData.summary,
        metrics: {
          strengths: swotData.items.filter((i) => i.quadrant === 'strengths').length,
          weaknesses: swotData.items.filter((i) => i.quadrant === 'weaknesses').length,
          opportunities: swotData.items.filter((i) => i.quadrant === 'opportunities').length,
          threats: swotData.items.filter((i) => i.quadrant === 'threats').length,
          totalItems: swotData.items.length,
          correlations: swotData.correlations.length,
        },
      };
    } else if (toolType === 'market-forces') {
      const porterData = inputData as PorterData;
      const avgScore = Object.values(porterData.forces).reduce((sum, f) => sum + f.score, 0) / 5;
      return {
        context: porterData.context,
        forces: porterData.forces,
        summary: porterData.summary,
        metrics: {
          attractiveness: (6 - avgScore).toFixed(1),
          avgForceScore: avgScore.toFixed(1),
          highestForce: Object.entries(porterData.forces).reduce((a, b) =>
            a[1].score > b[1].score ? a : b
          )[0],
          lowestForce: Object.entries(porterData.forces).reduce((a, b) =>
            a[1].score < b[1].score ? a : b
          )[0],
        },
      };
    }
    return null;
  }, [toolType, session.inputData]);

  const reportData = getReportData();
  const initiatives = session.generatedInitiatives;

  // Export handlers
  const handleExportPDF = useCallback(async () => {
    setExporting('pdf');
    try {
      const success = await exportStrategicToolToPDF({
        toolType,
        toolName: TOOL_NAMES[toolType][lang],
        sessionName: session.name,
        organizationName,
        createdAt: session.createdAt,
        elementRef: reportRef.current,
        isPolish,
      });
      
      if (!success) {
        console.error('[ReportView] PDF export failed');
      }
    } catch (err) {
      console.error('[ReportView] PDF export error:', err);
    } finally {
      setExporting(null);
    }
  }, [toolType, session, organizationName, isPolish, lang]);

  const handleExportImage = useCallback(async () => {
    setExporting('image');
    try {
      const sanitizedName = session.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `${toolType}_${sanitizedName}_${dateStr}.png`;
      
      const success = await exportStrategicToolToImage(reportRef.current, filename);
      
      if (!success) {
        console.error('[ReportView] Image export failed');
      }
    } catch (err) {
      console.error('[ReportView] Image export error:', err);
    } finally {
      setExporting(null);
    }
  }, [toolType, session]);

  const handleExportJSON = useCallback(async () => {
    setExporting('json');
    try {
      const exportData = {
        toolType,
        sessionId: session.id,
        sessionName: session.name,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        inputData: session.inputData,
        initiatives: session.generatedInitiatives,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${toolType}-analysis-${session.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[ReportView] JSON export error:', err);
    } finally {
      setExporting(null);
    }
  }, [toolType, session]);

  const handleCopyLink = useCallback(async () => {
    try {
      const url = `${window.location.origin}/tools/${toolType}?session=${session.id}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('[ReportView] Copy link error:', err);
    }
  }, [toolType, session.id]);

  const exportFormats: ExportFormat[] = [
    { id: 'pdf', label: { en: 'Export PDF', pl: 'Eksport PDF' }, icon: FileText, handler: handleExportPDF },
    { id: 'image', label: { en: 'Save as Image', pl: 'Zapisz jako obraz' }, icon: Image, handler: handleExportImage },
    { id: 'json', label: { en: 'Export JSON', pl: 'Eksport JSON' }, icon: FileJson, handler: handleExportJSON },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Report panel */}
      <div className="relative ml-auto w-full max-w-4xl h-full bg-white dark:bg-navy-900 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30">
              <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {isPolish ? 'Raport analizy' : 'Analysis Report'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {TOOL_NAMES[toolType][lang]}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Export buttons */}
            {exportFormats.map((format) => {
              const Icon = format.icon;
              const isLoading = exporting === format.id;
              return (
                <button
                  key={format.id}
                  onClick={format.handler}
                  disabled={exporting !== null}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-600 dark:text-slate-400 transition-colors disabled:opacity-50"
                  title={format.label[lang]}
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </button>
              );
            })}

            {/* Share button */}
            <button
              onClick={handleCopyLink}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-600 dark:text-slate-400 transition-colors"
              title={isPolish ? 'Kopiuj link' : 'Copy link'}
            >
              {copied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
            </button>

            {/* Print button */}
            <button
              onClick={() => window.print()}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-600 dark:text-slate-400 transition-colors"
              title={isPolish ? 'Drukuj' : 'Print'}
            >
              <Printer className="w-5 h-5" />
            </button>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Report content */}
        <div ref={reportRef} className="flex-1 overflow-y-auto p-6 print:p-0">
          <div className="max-w-3xl mx-auto space-y-8">
            {/* Report header */}
            <div className="text-center border-b border-slate-200 dark:border-navy-700 pb-6">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                {TOOL_NAMES[toolType][lang]}
              </h1>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-4">
                {session.name}
              </p>

              {/* Meta info */}
              <div className="flex items-center justify-center gap-6 text-sm text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1">
                  <Building className="w-4 h-4" />
                  {organizationName}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(session.createdAt).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
            </div>

            {/* Executive Summary */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-primary-500" />
                {isPolish ? 'Podsumowanie wykonawcze' : 'Executive Summary'}
              </h2>
              <div className="p-4 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
                <p className="text-slate-600 dark:text-slate-400">
                  {reportData?.summary?.keyInsights?.join(' ') ||
                    (isPolish
                      ? 'Analiza wymaga wygenerowania podsumowania przez AI.'
                      : 'Analysis requires AI-generated summary.')}
                </p>
              </div>
            </section>

            {/* Metrics */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary-500" />
                {isPolish ? 'Kluczowe metryki' : 'Key Metrics'}
              </h2>

              {toolType === 'dynamic-swot' && reportData && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <MetricCard
                    label={isPolish ? 'Mocne strony' : 'Strengths'}
                    value={(reportData.metrics as any).strengths}
                    color="emerald"
                  />
                  <MetricCard
                    label={isPolish ? 'Słabe strony' : 'Weaknesses'}
                    value={(reportData.metrics as any).weaknesses}
                    color="red"
                  />
                  <MetricCard
                    label={isPolish ? 'Szanse' : 'Opportunities'}
                    value={(reportData.metrics as any).opportunities}
                    color="blue"
                  />
                  <MetricCard
                    label={isPolish ? 'Zagrożenia' : 'Threats'}
                    value={(reportData.metrics as any).threats}
                    color="amber"
                  />
                </div>
              )}

              {toolType === 'market-forces' && reportData && (
                <div className="grid grid-cols-2 gap-4">
                  <MetricCard
                    label={isPolish ? 'Atrakcyjność branży' : 'Industry Attractiveness'}
                    value={`${(reportData.metrics as any).attractiveness}/5`}
                    color="emerald"
                  />
                  <MetricCard
                    label={isPolish ? 'Śr. siła konkurencji' : 'Avg. Force Score'}
                    value={`${(reportData.metrics as any).avgForceScore}/5`}
                    color="blue"
                  />
                </div>
              )}
            </section>

            {/* Visualization */}
            <section>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                {isPolish ? 'Wizualizacja' : 'Visualization'}
              </h2>
              <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
                {toolType === 'dynamic-swot' && (
                  <SWOTMatrix data={session.inputData as SWOTData} isPolish={isPolish} />
                )}
                {toolType === 'market-forces' && (
                  <PorterRadar data={session.inputData as PorterData} isPolish={isPolish} />
                )}
              </div>
            </section>

            {/* Key Insights */}
            {reportData?.summary?.keyInsights && reportData.summary.keyInsights.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  {isPolish ? 'Kluczowe wnioski' : 'Key Insights'}
                </h2>
                <ul className="space-y-3">
                  {reportData.summary.keyInsights.map((insight, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700"
                    >
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </span>
                      <span className="text-slate-600 dark:text-slate-400">{insight}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* SWOT Correlations */}
            {toolType === 'dynamic-swot' && reportData && (reportData as any).correlations?.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                  {isPolish ? 'Korelacje strategiczne' : 'Strategic Correlations'}
                </h2>
                <div className="space-y-3">
                  {((reportData as any).correlations as SWOTCorrelation[]).map((correlation) => (
                    <div
                      key={correlation.id}
                      className="p-4 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded ${
                            correlation.type === 'SO'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                              : correlation.type === 'WO'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                              : correlation.type === 'ST'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                          }`}
                        >
                          {correlation.type}
                        </span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 mb-2">{correlation.insight}</p>
                      {correlation.initiativeProposal && (
                        <p className="text-sm text-primary-600 dark:text-primary-400 flex items-center gap-1">
                          <Lightbulb className="w-4 h-4" />
                          {correlation.initiativeProposal}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Recommended Initiatives */}
            {initiatives.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-amber-500" />
                  {isPolish ? 'Rekomendowane inicjatywy' : 'Recommended Initiatives'}
                </h2>
                <div className="space-y-4">
                  {initiatives.map((initiative, index) => (
                    <div
                      key={initiative.id}
                      className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </span>
                          <h3 className="font-medium text-slate-900 dark:text-white">
                            {initiative.title}
                          </h3>
                        </div>
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            initiative.type === 'strategic'
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                              : initiative.type === 'operational'
                              ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                              : initiative.type === 'defensive'
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          }`}
                        >
                          {initiative.type}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 mb-3">{initiative.description}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                        <span>
                          {isPolish ? 'Wpływ' : 'Impact'}: <strong>{initiative.estimatedImpact}</strong>
                        </span>
                        <span>
                          {isPolish ? 'Wysiłek' : 'Effort'}: <strong>{initiative.estimatedEffort}</strong>
                        </span>
                      </div>
                      {initiative.rationale && (
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 italic">
                          {initiative.rationale}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Footer */}
            <div className="text-center pt-6 border-t border-slate-200 dark:border-navy-700 text-sm text-slate-400">
              <p>
                {isPolish
                  ? `Wygenerowano przez Consultify • ${new Date().toLocaleDateString('pl-PL')}`
                  : `Generated by Consultify • ${new Date().toLocaleDateString('en-US')}`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Metric card helper component
const MetricCard: React.FC<{
  label: string;
  value: number | string;
  color: string;
}> = ({ label, value, color }) => (
  <div
    className={`p-4 rounded-lg bg-${color}-50 dark:bg-${color}-900/20 border border-${color}-200 dark:border-${color}-800`}
  >
    <div className={`text-2xl font-bold text-${color}-600 dark:text-${color}-400`}>{value}</div>
    <div className="text-sm text-slate-600 dark:text-slate-400">{label}</div>
  </div>
);

export default ReportView;
