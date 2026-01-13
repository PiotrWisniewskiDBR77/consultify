/**
 * Economics View (Enterprise Edition)
 *
 * Main view for digitization maturity assessment management.
 * Features:
 * - Analysis Catalog with grid/table view
 * - Evaluation Tool for scoring
 * - Results visualization with radar charts
 * - Comparison view
 * - Version history
 * - PDF/Excel export
 * - AI recommendations
 *
 * Keyboard Shortcuts:
 * - Ctrl+N: New analysis
 * - Ctrl+S: Save current analysis
 * - Ctrl+E: Export to Excel
 * - Ctrl+P: Export to PDF
 * - Ctrl+H: Show version history
 * - Escape: Close modals / Back to catalog
 */

import {
  ArrowLeft,
  BarChart3,
  Calculator,
  Download,
  FileText,
  FolderOpen,
  GitCompare,
  History,
  Keyboard,
  Plus,
  Sparkles,
  Upload,
  Wrench,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { AIRecommendationsPanel } from '../components/Economics/AIRecommendationsPanel';
import { AnalysisCatalog } from '../components/Economics/AnalysisCatalog';
import { AnalysisCompareView } from '../components/Economics/AnalysisCompareView';
import { AnalysisCreateModal } from '../components/Economics/AnalysisCreateModal';
import { AnalysisResultsPanel } from '../components/Economics/AnalysisResultsPanel';
import { DigitizationToolTab } from '../components/Economics/DigitizationToolTab';
import { ExcelImportWizard } from '../components/Economics/ExcelImportWizard';
import { FinancialAnalysisPanel } from '../components/Economics/FinancialAnalysisPanel';
import { PDFExportModal } from '../components/Economics/PDFExportModal';
import { DigitizationAnalysis } from '../components/Economics/types';
import { VersionHistoryPanel } from '../components/Economics/VersionHistoryPanel';
import { SplitLayout } from '../components/layout/SplitLayout';
import { Api } from '@/services/api';

type EconomicsTab = 'catalog' | 'tool' | 'results' | 'financial' | 'compare';

export const EconomicsView: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<EconomicsTab>('catalog');
  const [selectedAnalysis, setSelectedAnalysis] = useState<DigitizationAnalysis | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showPDFExport, setShowPDFExport] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      // Ctrl+N: New analysis
      if (e.ctrlKey && e.key === 'n') {
        e.preventDefault();
        setShowCreateModal(true);
      }
      // Ctrl+E: Export to Excel
      else if (e.ctrlKey && e.key === 'e' && selectedAnalysis) {
        e.preventDefault();
        handleExcelExport();
      }
      // Ctrl+P: Export to PDF
      else if (e.ctrlKey && e.key === 'p' && selectedAnalysis) {
        e.preventDefault();
        setShowPDFExport(true);
      }
      // Ctrl+H: Version history
      else if (e.ctrlKey && e.key === 'h' && selectedAnalysis) {
        e.preventDefault();
        setShowVersionHistory(true);
      }
      // Escape: Close modals or go back
      else if (e.key === 'Escape') {
        if (showCreateModal) setShowCreateModal(false);
        else if (showImportWizard) setShowImportWizard(false);
        else if (showPDFExport) setShowPDFExport(false);
        else if (showVersionHistory) setShowVersionHistory(false);
        else if (selectedAnalysis && activeTab !== 'catalog') {
          setActiveTab('catalog');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedAnalysis,
    showCreateModal,
    showImportWizard,
    showPDFExport,
    showVersionHistory,
    activeTab,
  ]);

  const handleExcelExport = async () => {
    if (!selectedAnalysis) return;
    try {
      const result = await Api.exportDigitizationAnalysis(selectedAnalysis.id);
      toast.success('Excel wygenerowany');
      if (result.downloadUrl) {
        window.open(result.downloadUrl, '_blank');
      }
    } catch (err: any) {
      toast.error(err.message || 'Nie udało się wyeksportować');
    }
  };

  const tabs = [
    {
      id: 'catalog' as const,
      label: 'Katalog analiz',
      labelEn: 'Analysis Catalog',
      icon: FolderOpen,
    },
    {
      id: 'tool' as const,
      label: 'Narzędzie oceny',
      labelEn: 'Evaluation Tool',
      icon: Wrench,
      disabled: !selectedAnalysis,
    },
    {
      id: 'results' as const,
      label: 'Wyniki',
      labelEn: 'Results & Insights',
      icon: BarChart3,
      disabled: !selectedAnalysis,
    },
    {
      id: 'financial' as const,
      label: 'Analiza finansowa',
      labelEn: 'Financial Analysis',
      icon: Calculator,
      disabled: !selectedAnalysis,
    },
    { id: 'compare' as const, label: 'Porównaj', labelEn: 'Compare', icon: GitCompare },
  ];

  const handleSelectAnalysis = useCallback((analysis: DigitizationAnalysis) => {
    setSelectedAnalysis(analysis);
    setActiveTab('tool');
  }, []);

  const handleCreateAnalysis = useCallback((newAnalysis: DigitizationAnalysis) => {
    setSelectedAnalysis(newAnalysis);
    setShowCreateModal(false);
    setActiveTab('tool');
    setRefreshKey((k) => k + 1);
  }, []);

  const handleImportComplete = useCallback((analysis: DigitizationAnalysis) => {
    setSelectedAnalysis(analysis);
    setShowImportWizard(false);
    setActiveTab('tool');
    setRefreshKey((k) => k + 1);
  }, []);

  const handleAnalysisUpdate = useCallback((updated: DigitizationAnalysis) => {
    setSelectedAnalysis(updated);
    setRefreshKey((k) => k + 1);
  }, []);

  const handleBackToCatalog = useCallback(() => {
    setSelectedAnalysis(null);
    setActiveTab('catalog');
  }, []);

  return (
    <SplitLayout
      title="Economics & Value Realization"
      subtitle="Ocena dojrzałości cyfrowej i analiza wartości"
    >
      <div className="flex flex-col h-full">
        {/* Selected Analysis Context Bar */}
        {selectedAnalysis && (
          <div className="bg-gradient-to-r from-emerald-600/10 to-teal-600/10 border-b border-emerald-500/20 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Calculator size={20} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">{selectedAnalysis.name}</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {selectedAnalysis.projectName
                    ? `Projekt: ${selectedAnalysis.projectName}`
                    : 'Bez projektu'}{' '}
                  • Status:{' '}
                  <span
                    className={`capitalize ${
                      selectedAnalysis.status === 'completed'
                        ? 'text-green-400'
                        : selectedAnalysis.status === 'in_progress'
                          ? 'text-yellow-400'
                          : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {selectedAnalysis.status === 'completed'
                      ? 'Zakończona'
                      : selectedAnalysis.status === 'in_progress'
                        ? 'W trakcie'
                        : 'Szkic'}
                  </span>{' '}
                  • Wynik:{' '}
                  <span className="text-emerald-400 font-medium">
                    {selectedAnalysis.overallScore?.toFixed(1) || '0'}/7
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowVersionHistory(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400 dark:text-slate-500 hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
                title="Historia wersji (Ctrl+H)"
              >
                <History size={14} />
                Wersje
              </button>
              <button
                onClick={handleExcelExport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400 dark:text-slate-500 hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
                title="Eksport Excel (Ctrl+E)"
              >
                <Download size={14} />
                Excel
              </button>
              <button
                onClick={() => setShowPDFExport(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400 dark:text-slate-500 hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
                title="Eksport PDF (Ctrl+P)"
              >
                <FileText size={14} />
                PDF
              </button>
              <div className="w-px h-6 bg-white/20 mx-2" />
              <button
                onClick={handleBackToCatalog}
                className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 hover:text-white transition-colors"
              >
                <ArrowLeft size={16} />
                Katalog
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center px-6 border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all
                                ${
                                  activeTab === tab.id
                                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                    : tab.disabled
                                      ? 'border-transparent text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white hover:border-slate-300 dark:border-navy-700'
                                }`}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}

          {/* Action Buttons */}
          <div className="ml-auto flex items-center gap-2 py-2">
            <button
              onClick={() => setShowImportWizard(true)}
              className="flex items-center gap-2 px-3 py-2 text-slate-600 dark:text-slate-300 
                                hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg text-sm transition-colors"
            >
              <Upload size={16} />
              Import Excel
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 
                                text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-emerald-600/20"
            >
              <Plus size={16} />
              Nowa analiza
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-navy-950">
          {activeTab === 'catalog' && (
            <AnalysisCatalog
              key={refreshKey}
              onSelect={handleSelectAnalysis}
              onCreateNew={() => setShowCreateModal(true)}
              onImport={() => setShowImportWizard(true)}
            />
          )}
          {activeTab === 'tool' && selectedAnalysis && (
            <DigitizationToolTab analysis={selectedAnalysis} onUpdate={handleAnalysisUpdate} />
          )}
          {activeTab === 'results' && selectedAnalysis && (
            <div className="p-6 space-y-6">
              <AnalysisResultsPanel analysis={selectedAnalysis} />
              <AIRecommendationsPanel
                analysis={selectedAnalysis}
                onCreateInitiative={(rec) => {
                  toast.success(`Rekomendacja "${rec.title}" zaakceptowana`);
                }}
              />
            </div>
          )}
          {activeTab === 'financial' && selectedAnalysis && (
            <FinancialAnalysisPanel analysis={selectedAnalysis} onUpdate={handleAnalysisUpdate} />
          )}
          {activeTab === 'compare' && <AnalysisCompareView />}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <AnalysisCreateModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateAnalysis}
        />
      )}

      {/* Import Wizard */}
      {showImportWizard && (
        <ExcelImportWizard
          onClose={() => setShowImportWizard(false)}
          onImportComplete={handleImportComplete}
        />
      )}

      {/* PDF Export Modal */}
      {showPDFExport && selectedAnalysis && (
        <PDFExportModal analysis={selectedAnalysis} onClose={() => setShowPDFExport(false)} />
      )}

      {/* Version History Panel */}
      {showVersionHistory && selectedAnalysis && (
        <VersionHistoryPanel
          analysis={selectedAnalysis}
          onClose={() => setShowVersionHistory(false)}
          onRestore={() => {
            // Refresh analysis after restore
            Api.getDigitizationAnalysis(selectedAnalysis.id).then((updated) => {
              setSelectedAnalysis(updated);
              setRefreshKey((k) => k + 1);
            });
          }}
        />
      )}
    </SplitLayout>
  );
};

export default EconomicsView;
