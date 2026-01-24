/**
 * AssessmentHub
 * New simplified Assessment module with 3 tabs (Assessment, Reports, Initiatives)
 * Uses shared ModuleHub components
 */

import { Activity, Cpu, Database, FileText, Layers, Lightbulb, Workflow } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { Api } from '@/services/api';

import {
  FilterableTable,
  FilterChip,
  GridItem,
  GridView,
  ModuleHub,
  ModuleTab,
  OpenDocument,
  TableColumn,
  ViewMode,
} from '../shared/ModuleHub';

// Assessment Framework Types
type AssessmentFramework = 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';
type ItemStatus = 'draft' | 'in_review' | 'approved' | 'completed';

// Framework metadata
const FRAMEWORK_META: Record<
  AssessmentFramework,
  {
    name: string;
    shortName: string;
    icon: React.ReactNode;
    color: string;
    filterColor: string;
  }
> = {
  DRD: {
    name: 'Digital Readiness Diagnosis',
    shortName: 'DRD',
    icon: <Activity size={16} />,
    color: 'purple',
    filterColor: 'border-l-purple-500',
  },
  SIRI: {
    name: 'Smart Industry Readiness Index',
    shortName: 'SIRI',
    icon: <Cpu size={16} />,
    color: 'blue',
    filterColor: 'border-l-blue-500',
  },
  ADMA: {
    name: 'Advanced Digital Maturity Assessment',
    shortName: 'ADMA',
    icon: <Database size={16} />,
    color: 'teal',
    filterColor: 'border-l-teal-500',
  },
  CMMI: {
    name: 'Capability Maturity Model Integration',
    shortName: 'CMMI',
    icon: <Layers size={16} />,
    color: 'orange',
    filterColor: 'border-l-orange-500',
  },
  LEAN: {
    name: 'Lean 4.0',
    shortName: 'LEAN',
    icon: <Workflow size={16} />,
    color: 'green',
    filterColor: 'border-l-green-500',
  },
};

// API Response interface
interface AssessmentFromAPI {
  id: string;
  name: string;
  description?: string;
  status: string;
  type?: string;
  progress?: number;
  overallScore?: number;
  createdAt?: string;
  updatedAt?: string;
  organizationId?: string;
}

// Map API status to local ItemStatus
const mapApiStatus = (status: string): ItemStatus => {
  const statusMap: Record<string, ItemStatus> = {
    DRAFT: 'draft',
    IN_REVIEW: 'in_review',
    AWAITING_APPROVAL: 'in_review',
    APPROVED: 'approved',
    COMPLETED: 'completed',
  };
  return statusMap[status?.toUpperCase()] || 'draft';
};

// Map API type to AssessmentFramework
const mapApiFramework = (type: string | undefined): AssessmentFramework => {
  if (!type) return 'DRD';
  const upper = type.toUpperCase();
  if (['DRD', 'SIRI', 'ADMA', 'CMMI', 'LEAN'].includes(upper)) {
    return upper as AssessmentFramework;
  }
  return 'DRD';
};

interface AssessmentHubProps {
  initialTab?: ModuleTab;
}

export const AssessmentHub: React.FC<AssessmentHubProps> = ({ initialTab = 'list' }) => {
  // State
  const [activeTab, setActiveTab] = useState<ModuleTab>(initialTab);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [showNewAssessmentModal, setShowNewAssessmentModal] = useState(false);

  // API data state
  const [assessments, setAssessments] = useState<AssessmentFromAPI[]>([]);
  const [reports, setReports] = useState<AssessmentFromAPI[]>([]);
  const [initiatives, setInitiatives] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data from API
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch assessments
        const assessmentResponse = await Api.get('/assessments/my-assessments');
        const assessmentData = assessmentResponse?.assessments || [];
        setAssessments(Array.isArray(assessmentData) ? assessmentData : []);

        // TODO: Fetch reports when API is ready
        // const reportsResponse = await Api.get('/assessment-reports');
        // setReports(reportsResponse?.reports || []);
        setReports([]);

        // TODO: Fetch initiatives when API is ready
        // const initiativesResponse = await Api.get('/initiatives?source=assessment');
        // setInitiatives(initiativesResponse?.initiatives || []);
        setInitiatives([]);
      } catch (err: any) {
        const message = err?.message || 'Failed to load assessments';
        setError(message);
        console.error('[AssessmentHub] Load error:', err);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Refresh function for manual reload
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await Api.get('/assessments/my-assessments');
      setAssessments(response?.assessments || []);
    } catch (err: any) {
      toast.error('Failed to refresh');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Tab configuration
  const tabs = useMemo(
    () => [
      {
        id: 'list' as ModuleTab,
        label: 'Assessment',
        icon: <FileText size={16} />,
        count: assessments.length,
      },
      {
        id: 'reports' as ModuleTab,
        label: 'Reports',
        icon: <FileText size={16} />,
        count: reports.length,
      },
      {
        id: 'initiatives' as ModuleTab,
        label: 'Initiatives',
        icon: <Lightbulb size={16} />,
        count: initiatives.length,
      },
    ],
    [assessments.length, reports.length, initiatives.length]
  );

  // Table columns for assessments
  const assessmentColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'framework',
        label: 'Type',
        width: '120px',
        filterable: true,
        filterOptions: Object.entries(FRAMEWORK_META).map(([key, meta]) => ({
          value: key,
          label: meta.shortName,
          color: `bg-${meta.color}-500`,
        })),
        render: (row) => {
          const meta = FRAMEWORK_META[row.framework as AssessmentFramework];
          return (
            <div className="flex items-center gap-2">
              <span className={`text-${meta.color}-400`}>{meta.icon}</span>
              <span className="font-mono text-xs font-bold text-slate-300">{meta.shortName}</span>
            </div>
          );
        },
      },
      {
        id: 'name',
        label: 'Name',
        render: (row) => <span className="text-sm text-white font-medium">{row.name}</span>,
      },
      {
        id: 'status',
        label: 'Status',
        width: '140px',
        filterable: true,
        filterOptions: [
          { value: 'draft', label: 'Draft', color: 'bg-slate-400' },
          { value: 'in_review', label: 'In Review', color: 'bg-amber-400' },
          { value: 'approved', label: 'Approved', color: 'bg-emerald-400' },
          { value: 'completed', label: 'Completed', color: 'bg-emerald-400' },
        ],
      },
      {
        id: 'progress',
        label: 'Progress',
        width: '150px',
      },
      {
        id: 'updatedAt',
        label: 'Updated',
        width: '120px',
        sortable: true,
      },
    ],
    []
  );

  // Handlers
  const handleOpenDocument = useCallback((row: any) => {
    const doc: OpenDocument = {
      id: row.id,
      type: 'assessment',
      subType: row.framework,
      name: row.name,
      status: row.status,
    };

    setOpenDocuments((prev) => {
      if (prev.find((d) => d.id === doc.id)) return prev;
      return [...prev, doc];
    });
    setActiveDocumentId(row.id);
  }, []);

  const handleCloseDocument = useCallback(
    (id: string) => {
      setOpenDocuments((prev) => prev.filter((d) => d.id !== id));
      if (activeDocumentId === id) {
        setActiveDocumentId(null);
      }
    },
    [activeDocumentId]
  );

  const handleShowList = useCallback(() => {
    setActiveDocumentId(null);
  }, []);

  const handleRemoveFilter = useCallback((id: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

  const handleNewAssessment = useCallback(() => {
    setShowNewAssessmentModal(true);
  }, []);

  const handleRowAction = useCallback(
    (action: string, row: any) => {
      console.log('Row action:', action, row);
      if (action === 'view' || action === 'edit') {
        handleOpenDocument(row);
      }
    },
    [handleOpenDocument]
  );

  // Transform API data to display format
  const currentData = useMemo(() => {
    switch (activeTab) {
      case 'list':
        return assessments.map((item) => ({
          id: item.id,
          name: item.name,
          framework: mapApiFramework(item.type),
          status: mapApiStatus(item.status),
          progress: item.progress ?? 0,
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        }));
      case 'reports':
        return reports.map((item) => ({
          id: item.id,
          name: item.name,
          framework: mapApiFramework(item.type),
          status: mapApiStatus(item.status),
          progress: item.progress ?? 100,
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
        }));
      case 'initiatives':
        return initiatives.map((item) => ({
          id: item.id,
          name: item.name || item.title,
          framework: mapApiFramework(item.sourceType),
          status: mapApiStatus(item.status),
          progress: 100,
          updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
          priority: item.priority || 'medium',
          impact: item.impact || 'medium',
        }));
      default:
        return [];
    }
  }, [activeTab, assessments, reports, initiatives]);

  // Convert to grid items
  const gridItems: GridItem[] = useMemo(() => {
    return currentData.map((item) => ({
      ...item,
      type: item.framework,
      typeColor: FRAMEWORK_META[item.framework]?.color || 'slate',
    }));
  }, [currentData]);

  // Render content based on active document or list
  const renderContent = () => {
    if (activeDocumentId) {
      // Show document editor (placeholder for now)
      const doc = openDocuments.find((d) => d.id === activeDocumentId);
      return (
        <div className="flex items-center justify-center h-full text-slate-500">
          <div className="text-center">
            <p className="text-lg">Editing: {doc?.name}</p>
            <p className="text-sm">
              ({doc?.subType} - {doc?.status})
            </p>
            <p className="mt-4 text-xs">Editor placeholder - będzie tu edytor assessmentu</p>
          </div>
        </div>
      );
    }

    // Show list/grid view
    if (viewMode === 'grid') {
      return (
        <GridView
          items={gridItems}
          onItemClick={handleOpenDocument}
          onItemAction={handleRowAction}
          onNewItem={handleNewAssessment}
          newItemLabel="New Assessment"
        />
      );
    }

    return (
      <FilterableTable
        columns={assessmentColumns}
        data={currentData}
        onRowClick={handleOpenDocument}
        onRowAction={handleRowAction}
        activeFilters={activeFilters}
        onFilterChange={setActiveFilters}
        emptyMessage="No assessments found. Create your first assessment to get started."
      />
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading assessments...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

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
        onSelectDocument={setActiveDocumentId}
        onCloseDocument={handleCloseDocument}
        onShowList={handleShowList}
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        onClearFilters={handleClearFilters}
        onNewItem={handleNewAssessment}
        newItemLabel="New Assessment"
      >
        {renderContent()}
      </ModuleHub>

      {/* New Assessment Modal (placeholder) */}
      {showNewAssessmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-navy-900 border border-navy-700 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-white mb-4">Select Framework</h2>
            <div className="space-y-2">
              {Object.entries(FRAMEWORK_META).map(([key, meta]) => (
                <button
                  key={key}
                  onClick={() => {
                    console.log('Create assessment:', key);
                    setShowNewAssessmentModal(false);
                  }}
                  className={`
                    flex items-center gap-3 w-full p-3 rounded-lg
                    bg-navy-800 border border-navy-600
                    hover:border-${meta.color}-500/50 hover:bg-navy-700
                    transition-all text-left
                  `}
                >
                  <span className={`text-${meta.color}-400`}>{meta.icon}</span>
                  <div>
                    <div className="text-white font-medium">{meta.shortName}</div>
                    <div className="text-xs text-slate-400">{meta.name}</div>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowNewAssessmentModal(false)}
              className="mt-4 w-full py-2 text-sm text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default AssessmentHub;
