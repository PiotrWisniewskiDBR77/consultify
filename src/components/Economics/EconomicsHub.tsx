/**
 * EconomicsHub
 * Economics & Value Realization module with ModuleHub UI pattern
 * Uses shared ModuleHub components for consistent UX
 *
 * Tabs: Catalog, Evaluations, Results
 * Views: Table, Grid
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
  Loader2,
  Plus,
  Sparkles,
  Target,
  Upload,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import {
  FilterableTable,
  FilterChip,
  GridItem,
  GridView,
  ItemStatus,
  ModuleHub,
  ModuleTab,
  OpenDocument,
  TableColumn,
  ViewMode,
} from '../shared/ModuleHub';
import { AIRecommendationsPanel } from './AIRecommendationsPanel';
import { AnalysisCompareView } from './AnalysisCompareView';
import { AnalysisCreateModal } from './AnalysisCreateModal';
import { AnalysisResultsPanel } from './AnalysisResultsPanel';
import { DigitizationToolTab } from './DigitizationToolTab';
import { ExcelImportWizard } from './ExcelImportWizard';
import { FinancialAnalysisPanel } from './FinancialAnalysisPanel';
import { PDFExportModal } from './PDFExportModal';
import { DigitizationAnalysis } from './types';
import { VersionHistoryPanel } from './VersionHistoryPanel';

// Analysis status mapping
const getStatusMeta = (
  t: (key: string, fallback?: string) => string
): Record<string, { label: string; dotColor: string; itemStatus: ItemStatus }> => ({
  DRAFT: {
    label: t('economics.status.draft', 'Draft'),
    dotColor: 'bg-c-text-muted',
    itemStatus: 'DRAFT',
  },
  REVIEW: {
    label: t('economics.status.inReview', 'In Review'),
    dotColor: 'bg-amber-400',
    itemStatus: 'REVIEW',
  },
  APPROVED: {
    label: t('economics.status.completed', 'Completed'),
    dotColor: 'bg-emerald-400',
    itemStatus: 'DONE',
  },
});

// Type codes for analysis types
const getTypeCode = (analysisType: string): string => {
  const codes: Record<string, string> = {
    maturity: 'MAT',
    financial: 'FIN',
    digitization: 'DIG',
    value: 'VAL',
  };
  return codes[analysisType?.toLowerCase()] || 'ECO';
};

interface EconomicsHubProps {
  initialTab?: ModuleTab;
}

export const EconomicsHub: React.FC<EconomicsHubProps> = ({ initialTab = 'list' }) => {
  const { t } = useTranslation();
  const STATUS_META = useMemo(
    () => getStatusMeta((key: string, fallback?: string) => t(key, { defaultValue: fallback })),
    [t]
  );

  // State
  const [activeTab, setActiveTab] = useState<ModuleTab>(initialTab);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

  // Data state
  const [analyses, setAnalyses] = useState<DigitizationAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAnalysis, setSelectedAnalysis] = useState<DigitizationAnalysis | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showPDFExport, setShowPDFExport] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // Fetch analyses
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const response = await Api.get('/api/digitization-analyses');
        const data = response.analyses || response.data?.analyses || [];
        setAnalyses(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('[EconomicsHub] Failed to load:', err);
        toast.error('Failed to load analyses');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Calculate stats
  const stats = useMemo(
    () => ({
      total: analyses.length,
      draft: analyses.filter((a) => a.status === 'DRAFT').length,
      review: analyses.filter((a) => a.status === 'REVIEW').length,
      approved: analyses.filter((a) => a.status === 'APPROVED').length,
    }),
    [analyses]
  );

  // Filter analyses
  const filteredAnalyses = useMemo(() => {
    let result = analyses;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(query) ||
          (a.projectName || '').toLowerCase().includes(query)
      );
    }

    activeFilters.forEach((filter: FilterChip) => {
      if (filter.column === 'status') {
        result = result.filter((a) => a.status === filter.value);
      }
    });

    return result;
  }, [analyses, searchQuery, activeFilters]);

  // Tab configuration
  const tabs = useMemo(
    () => [
      {
        id: 'list' as ModuleTab,
        label: t('economics.tabs.catalog', 'Catalog'),
        icon: <FolderOpen size={16} />,
        count: filteredAnalyses.length,
      },
      {
        id: 'reports' as ModuleTab,
        label: t('economics.tabs.results', 'Results'),
        icon: <BarChart3 size={16} />,
        count: stats.approved,
      },
      {
        id: 'initiatives' as ModuleTab,
        label: t('economics.tabs.compare', 'Compare'),
        icon: <GitCompare size={16} />,
      },
    ],
    [t, filteredAnalyses.length, stats.approved]
  );

  // Table columns
  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'type',
        label: t('economics.columns.type', 'Type'),
        width: '80px',
        render: (row: DigitizationAnalysis) => {
          const code = getTypeCode(row.analysisType || '');
          return (
            <div className="flex items-center gap-2">
              <Calculator size={14} className="text-emerald-400" />
              <span className="font-mono text-xs font-bold text-c-text-secondary">{code}</span>
            </div>
          );
        },
      },
      {
        id: 'name',
        label: t('economics.columns.name', 'Name'),
        render: (row: DigitizationAnalysis) => (
          <div>
            <span className="text-sm text-c-text font-medium">{row.name}</span>
            {row.projectName && <p className="text-xs text-c-text-muted mt-0.5">{row.projectName}</p>}
          </div>
        ),
      },
      {
        id: 'status',
        label: t('economics.columns.status', 'Status'),
        width: '130px',
        filterable: true,
        filterOptions: Object.entries(STATUS_META).map(([value, meta]) => ({
          value,
          label: meta.label,
          color: meta.dotColor,
        })),
        render: (row: DigitizationAnalysis) => {
          const meta = STATUS_META[row.status] || STATUS_META.DRAFT;
          return (
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${meta.dotColor}`} />
              <span className="text-sm text-c-text-secondary">{meta.label}</span>
            </div>
          );
        },
      },
      {
        id: 'score',
        label: t('economics.columns.score', 'Score'),
        width: '100px',
        render: (row: DigitizationAnalysis) => {
          const score = row.overallScore || 0;
          return (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-c-border rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    score >= 5 ? 'bg-c-success' : score >= 3 ? 'bg-c-warning' : 'bg-c-text-muted'
                  }`}
                  style={{ width: `${(score / 7) * 100}%` }}
                />
              </div>
              <span className="text-xs text-c-text-muted">{score.toFixed(1)}/7</span>
            </div>
          );
        },
      },
      {
        id: 'updatedAt',
        label: t('economics.columns.updated', 'Updated'),
        width: '100px',
        sortable: true,
      },
    ],
    [t]
  );

  // Handlers
  const handleOpenDocument = useCallback((row: DigitizationAnalysis) => {
    const code = getTypeCode(row.analysisType || '');
    const statusMeta = STATUS_META[row.status] || STATUS_META.DRAFT;

    const doc: OpenDocument = {
      id: row.id,
      type: 'assessment',
      subType: code,
      name: row.name,
      status: statusMeta.itemStatus,
    };

    setOpenDocuments((prev) => {
      if (prev.find((d) => d.id === doc.id)) return prev;
      return [...prev, doc];
    });
    setActiveDocumentId(row.id);
    setSelectedAnalysis(row);
  }, []);

  const handleCloseDocument = useCallback(
    (id: string) => {
      setOpenDocuments((prev) => prev.filter((d) => d.id !== id));
      if (activeDocumentId === id) {
        setActiveDocumentId(null);
        setSelectedAnalysis(null);
      }
    },
    [activeDocumentId]
  );

  const handleShowList = useCallback(() => {
    setActiveDocumentId(null);
    setSelectedAnalysis(null);
  }, []);

  const handleRemoveFilter = useCallback((id: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

  const handleRowAction = useCallback(
    (action: string, row: DigitizationAnalysis) => {
      if (action === 'preview' || action === 'view' || action === 'edit') {
        handleOpenDocument(row);
      }
    },
    [handleOpenDocument]
  );

  const handleNewAnalysis = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  const handleCreateAnalysis = useCallback(
    (newAnalysis: DigitizationAnalysis) => {
      setAnalyses((prev) => [newAnalysis, ...prev]);
      setShowCreateModal(false);
      handleOpenDocument(newAnalysis);
    },
    [handleOpenDocument]
  );

  const handleImportComplete = useCallback(
    (analysis: DigitizationAnalysis) => {
      setAnalyses((prev) => [analysis, ...prev]);
      setShowImportWizard(false);
      handleOpenDocument(analysis);
    },
    [handleOpenDocument]
  );

  const handleAnalysisUpdate = useCallback((updated: DigitizationAnalysis) => {
    setSelectedAnalysis(updated);
    setAnalyses((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
  }, []);

  const handleExcelExport = useCallback(async () => {
    if (!selectedAnalysis) return;
    try {
      const result = await Api.exportDigitizationAnalysis(selectedAnalysis.id);
      toast.success(t('economics.toast.excelGenerated', 'Excel generated'));
      if (result.downloadUrl) {
        window.open(result.downloadUrl, '_blank');
      }
    } catch (err: any) {
      toast.error(err.message || t('economics.toast.exportFailed', 'Failed to export'));
    }
  }, [selectedAnalysis]);

  // Convert to grid items
  const gridItems: GridItem[] = useMemo(() => {
    return filteredAnalyses.map((item) => {
      const statusMeta = STATUS_META[item.status] || STATUS_META.DRAFT;
      return {
        id: item.id,
        name: item.name,
        type: getTypeCode(item.analysisType || ''),
        typeColor: 'emerald',
        status: statusMeta.itemStatus,
        progress: Math.round(((item.overallScore || 0) / 7) * 100),
        updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
      };
    });
  }, [filteredAnalyses]);

  // Render analysis detail view
  const renderAnalysisDetail = () => {
    if (!selectedAnalysis) return null;

    return (
      <div className="flex flex-col h-full">
        {/* Context Bar */}
        <div className="bg-gradient-to-r from-emerald-600/10 to-blue-600/10 border-b border-emerald-500/20 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Calculator size={20} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-c-text">{selectedAnalysis.name}</h3>
              <p className="text-xs text-c-text-muted">
                {selectedAnalysis.projectName
                  ? t('economics.detail.project', 'Project: {{name}}', {
                      name: selectedAnalysis.projectName,
                    })
                  : t('economics.detail.noProject', 'No project')}{' '}
                • {t('economics.detail.score', 'Score:')}{' '}
                <span className="text-emerald-400 font-medium">
                  {selectedAnalysis.overallScore?.toFixed(1) || '0'}/7
                </span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowVersionHistory(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-c-text-muted hover:text-c-text hover:bg-c-surface-raised rounded-lg transition-colors"
              title="Version History"
            >
              <History size={14} />
              {t('economics.actions.versions', 'Versions')}
            </button>
            <button
              onClick={handleExcelExport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-c-text-muted hover:text-c-text hover:bg-c-surface-raised rounded-lg transition-colors"
              title="Export Excel"
            >
              <Download size={14} />
              {t('economics.actions.excel', 'Excel')}
            </button>
            <button
              onClick={() => setShowPDFExport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-c-text-muted hover:text-c-text hover:bg-c-surface-raised rounded-lg transition-colors"
              title="Export PDF"
            >
              <FileText size={14} />
              {t('economics.actions.pdf', 'PDF')}
            </button>
          </div>
        </div>

        {/* Analysis Content */}
        <div className="flex-1 overflow-auto p-6">
          {selectedAnalysis.analysisType === 'financial' ? (
            <FinancialAnalysisPanel analysis={selectedAnalysis} onUpdate={handleAnalysisUpdate} />
          ) : (
            <div className="space-y-6">
              <DigitizationToolTab analysis={selectedAnalysis} onUpdate={handleAnalysisUpdate} />
              <AnalysisResultsPanel analysis={selectedAnalysis} />
              <AIRecommendationsPanel
                analysis={selectedAnalysis}
                onCreateInitiative={(rec) => {
                  toast.success(`Recommendation "${rec.title}" accepted`);
                }}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render content
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
        </div>
      );
    }

    // Show analysis detail if document is open
    if (activeDocumentId && selectedAnalysis) {
      return renderAnalysisDetail();
    }

    // Tab: Catalog (default)
    if (activeTab === 'list') {
      if (viewMode === 'grid') {
        return (
          <GridView
            items={gridItems}
            onItemClick={(item: GridItem) => {
              const analysis = analyses.find((a) => a.id === item.id);
              if (analysis) handleOpenDocument(analysis);
            }}
            onItemAction={(action: string, item: GridItem) => {
              const analysis = analyses.find((a) => a.id === item.id);
              if (analysis) handleRowAction(action, analysis);
            }}
            onNewItem={handleNewAnalysis}
            newItemLabel={t('economics.actions.newAnalysis', 'New Analysis')}
            emptyMessage={t(
              'economics.empty.noAnalyses',
              'No analyses yet. Create your first analysis.'
            )}
          />
        );
      }
      return (
        <FilterableTable
          columns={columns}
          data={filteredAnalyses}
          onRowClick={(row: any) => handleOpenDocument(row as DigitizationAnalysis)}
          onRowAction={(action: string, row: any) =>
            handleRowAction(action, row as DigitizationAnalysis)
          }
          activeFilters={activeFilters}
          onFilterChange={setActiveFilters}
          emptyMessage={t(
            'economics.empty.noAnalyses',
            'No analyses yet. Create your first analysis.'
          )}
        />
      );
    }

    // Tab: Results
    if (activeTab === 'reports') {
      const approvedAnalyses = analyses.filter((a) => a.status === 'APPROVED');

      if (approvedAnalyses.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <BarChart3 className="w-16 h-16 text-c-text-muted mb-4" />
            <h3 className="text-lg font-semibold text-c-text mb-2">
              {t('economics.empty.noCompleted', 'No completed analyses')}
            </h3>
            <p className="text-sm text-c-text-muted mb-6">
              {t(
                'economics.empty.completeToSee',
                'Complete analyses to see results and recommendations.'
              )}
            </p>
          </div>
        );
      }

      return (
        <div className="p-6 space-y-6">
          {approvedAnalyses.map((analysis) => (
            <div
              key={analysis.id}
              className="bg-c-surface border border-c-border-subtle rounded-xl overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-c-border-subtle flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Target className="text-emerald-400" size={18} />
                  <h3 className="font-semibold text-c-text">{analysis.name}</h3>
                </div>
                <button
                  onClick={() => handleOpenDocument(analysis)}
                  className="text-sm text-emerald-400 hover:text-emerald-300"
                >
                  {t('economics.actions.viewDetails', 'View Details')}
                </button>
              </div>
              <div className="p-4">
                <AnalysisResultsPanel analysis={analysis} />
              </div>
            </div>
          ))}
        </div>
      );
    }

    // Tab: Compare
    if (activeTab === 'initiatives') {
      return <AnalysisCompareView />;
    }

    return null;
  };

  // Category buttons for import
  const categoryButtons = useMemo(
    () => [
      {
        id: 'import',
        label: t('economics.actions.importExcel', 'Import Excel'),
        icon: <Upload size={16} />,
        count: 0,
        onClick: () => setShowImportWizard(true),
      },
    ],
    [t]
  );

  return (
    <>
      <ModuleHub
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={setSearchQuery}
        openDocuments={openDocuments}
        activeDocumentId={activeDocumentId}
        onSelectDocument={(id) => {
          setActiveDocumentId(id);
          const analysis = analyses.find((a) => a.id === id);
          if (analysis) setSelectedAnalysis(analysis);
        }}
        onCloseDocument={handleCloseDocument}
        onShowList={handleShowList}
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        onClearFilters={handleClearFilters}
        onNewItem={handleNewAnalysis}
        newItemLabel={t('economics.actions.newAnalysis', 'New Analysis')}
        categoryButtons={categoryButtons}
        availableViewModes={['table', 'grid']}
      >
        {renderContent()}
      </ModuleHub>

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
            Api.getDigitizationAnalysis(selectedAnalysis.id).then((updated) => {
              setSelectedAnalysis(updated);
              setAnalyses((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
            });
          }}
        />
      )}
    </>
  );
};

export default EconomicsHub;
