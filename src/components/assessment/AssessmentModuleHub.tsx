/**
 * AssessmentModuleHub
 *
 * Main hub component for Assessment Module with 4-button top menu:
 * 1. Assessment - Table of assessments (done/in progress/new)
 * 2. Map - Assessment editor tool (context-specific for each framework)
 * 3. Reports - Table of reports (created from approved assessments)
 * 4. Initiatives - Table of initiatives (created from approved reports)
 *
 * Each submodule (DRD, SIRI, ADMA, CMMI, Lean) uses this hub with its own context.
 */

import {
  Activity,
  AlertCircle,
  ArrowRight,
  Check,
  ChevronRight,
  Cpu,
  Database,
  FileOutput,
  FileText,
  History,
  Layers,
  LayoutDashboard,
  Lightbulb,
  Loader2,
  Map,
  Plus,
  Save,
  Workflow,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/shared/states';
import { V8AssessmentApi } from '@/services/api/v8';

import { useDeviceType } from '../../hooks/useDeviceType';
import { useAppStore } from '../../store/useAppStore';
// Multi-framework store
import { AssessmentFramework, useMultiFrameworkStore } from '../../store/useMultiFrameworkStore';
import { AppView } from '../../types';
import { DRDAxis } from '../../types';
import { SplitLayout } from '../layout/SplitLayout';
import { AssessmentAxisWorkspace } from './AssessmentAxisWorkspace';
import { AssessmentInitiativesDrawer } from './AssessmentInitiativesDrawer';
import { AssessmentSummaryWorkspace } from './AssessmentSummaryWorkspace';
// Sub-components
// Sub-components
import { AssessmentTable } from './AssessmentTable';
import { DocumentTabsBar, DocumentType, OpenDocument } from './DocumentTabsBar';
// Multi-framework assessment maps
import { InitiativeDetailsModal } from './modals/InitiativeDetailsModal';
import { VersionHistoryPanel } from './panels/VersionHistoryPanel';
import { ReportEditor } from './ReportEditor';
import { WorkflowStatusBar } from './WorkflowStatusBar';

// Lazy load heavy components
const InitiativesTable = React.lazy(() =>
  import('./InitiativesTable').then((m) => ({ default: m.InitiativesTable }))
);
const ADMAAssessmentMap = React.lazy(() =>
  import('./maps/ADMAAssessmentMap').then((m) => ({ default: m.ADMAAssessmentMap }))
);
const CMPracticeMap = React.lazy(() =>
  import('./maps/CMPracticeMap').then((m) => ({ default: m.CMPracticeMap }))
);
const DBR77LeanMap = React.lazy(() =>
  import('./maps/DBR77LeanMap').then((m) => ({ default: m.DBR77LeanMap }))
);
const SIRIAssessmentMap = React.lazy(() =>
  import('./maps/SIRIAssessmentMap').then((m) => ({ default: m.SIRIAssessmentMap }))
);
const ReportsTable = React.lazy(() =>
  import('./ReportsTable').then((m) => ({ default: m.ReportsTable }))
);

// Type for axis selection including dashboard
type AxisSelection = 'dashboard' | DRDAxis;

// Type matching WorkflowStatusBar's expected status type
type WorkflowStatus = 'DRAFT' | 'IN_REVIEW' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED';

const COMPLETED_AXES: DRDAxis[] = [
  'processes',
  'digitalProducts',
  'businessModels',
  'dataManagement',
  'culture',
  'cybersecurity',
  'aiMaturity',
];

export type HubTab = 'assessment' | 'map' | 'reports' | 'initiatives';
// REMOVED DUPLICATE TYPE DEFINITION: export type AssessmentFramework = 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';

interface TabConfig {
  id: HubTab;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const TABS: TabConfig[] = [
  {
    id: 'assessment',
    label: 'Assessment',
    icon: <FileText size={16} />,
    description: 'Manage your assessments',
  },
  {
    id: 'map',
    label: 'Map',
    icon: <Map size={16} />,
    description: 'Assessment Editor',
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: <FileOutput size={16} />,
    description: 'Assessment reports',
  },
  {
    id: 'initiatives',
    label: 'Initiatives',
    icon: <Lightbulb size={16} />,
    description: 'Transformation initiatives',
  },
];

// Framework metadata
const FRAMEWORK_CONFIG: Record<
  string,
  { name: string; icon: React.ReactNode; color: string; description: string }
> = {
  DRD: {
    name: 'Digital Readiness Diagnosis',
    icon: <Activity size={24} />,
    color: 'purple',
    description: '7-axis digital maturity assessment',
  },
  SIRI: {
    name: 'Smart Industry Readiness Index',
    icon: <Cpu size={24} />,
    color: 'blue',
    description: 'Industry 4.0 readiness assessment',
  },
  ADMA: {
    name: 'Advanced Digital Maturity Assessment',
    icon: <Database size={24} />,
    color: 'green',
    description: 'Comprehensive digital maturity model',
  },
  CMMI: {
    name: 'Capability Maturity Model Integration',
    icon: <Layers size={24} />,
    color: 'orange',
    description: 'Process improvement framework',
  },
  LEAN: {
    name: 'Lean 4.0',
    icon: <Workflow size={24} />,
    color: 'cyan',
    description: 'Lean manufacturing maturity assessment',
  },
};

interface AssessmentModuleHubProps {
  framework: AssessmentFramework;
  initialTab?: HubTab;
  initialAssessmentId?: string;
  onNavigate?: (view: AppView, params?: any) => void;
}

interface OpenAssessmentEntry {
  id: string;
  name: string;
  status?: WorkflowStatus;
}

export const AssessmentModuleHub: React.FC<AssessmentModuleHubProps> = ({
  framework,
  initialTab = 'assessment',
  initialAssessmentId,
  onNavigate,
}) => {
  const { t } = useTranslation();
  const { currentProjectId, setCurrentView } = useAppStore();
  const { isTablet, isMobile, isTouchDevice } = useDeviceType();
  const isCompact = isTablet || isMobile;

  // State
  const [activeTab, setActiveTab] = useState<HubTab>(initialTab);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(
    initialAssessmentId || null
  );
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedAxis, setSelectedAxis] = useState<AxisSelection>('dashboard');
  const [isLoadingAssessment, setIsLoadingAssessment] = useState(false);
  const [assessmentMeta, setAssessmentMeta] = useState<{
    name: string;
    isNew: boolean;
    status?: WorkflowStatus;
  } | null>(null);
  const [openAssessments, setOpenAssessments] = useState<OpenAssessmentEntry[]>([]);
  const [isInitiativesDrawerOpen, setIsInitiativesDrawerOpen] = useState(false);

  // SAFE ACCESS: Handle potential missing config
  const frameworkConfig = FRAMEWORK_CONFIG[framework];

  // Document tabs state - for reports and initiatives
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [showListView, setShowListView] = useState(true);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);

  // DRD Axes configuration for navigation bar
  const drdAxes: { id: DRDAxis; label: string; view: AppView }[] = [
    { id: 'processes', label: 'Procesy', view: AppView.FULL_STEP1_PROCESSES },
    { id: 'digitalProducts', label: 'Produkty', view: AppView.FULL_STEP1_DIGITAL },
    { id: 'businessModels', label: 'Modele', view: AppView.FULL_STEP1_MODELS },
    { id: 'dataManagement', label: 'Dane', view: AppView.FULL_STEP1_DATA },
    { id: 'culture', label: 'Kultura', view: AppView.FULL_STEP1_CULTURE },
    { id: 'cybersecurity', label: 'Cyber', view: AppView.FULL_STEP1_CYBERSECURITY },
    { id: 'aiMaturity', label: 'AI', view: AppView.FULL_STEP1_AI },
  ];

  // Navigation handler
  const handleNavigate = useCallback(
    (view: AppView, params?: any) => {
      if (onNavigate) {
        onNavigate(view, params);
      } else {
        setCurrentView(view);
      }
    },
    [onNavigate, setCurrentView]
  );

  // Open assessment in Map editor
  const handleOpenInMap = useCallback((assessmentId: string) => {
    setSelectedAssessmentId(assessmentId);
    setActiveTab('map');
  }, []);

  // Create new assessment and open in Map
  const handleNewAssessment = useCallback(() => {
    // Will create new assessment and open in Map
    setSelectedAssessmentId(null); // null = new
    setActiveTab('map');
  }, []);

  // Create report from approved assessment
  const handleCreateReport = useCallback((assessmentId: string) => {
    setSelectedAssessmentId(assessmentId);
    setActiveTab('reports');
    // Will trigger report creation flow
  }, []);

  const handleCloseOpenAssessment = useCallback(
    (assessmentId: string) => {
      setOpenAssessments((prev) => {
        const next = prev.filter((item) => item.id !== assessmentId);
        if (selectedAssessmentId === assessmentId) {
          const nextSelected = next[0]?.id || null;
          setSelectedAssessmentId(nextSelected);
          if (!nextSelected) {
            setActiveTab('assessment');
          }
        }
        return next;
      });
    },
    [selectedAssessmentId]
  );

  const handleSelectOpenAssessment = useCallback((assessmentId: string) => {
    setSelectedAssessmentId(assessmentId);
    setActiveTab('map');
  }, []);

  // Create initiatives from approved report
  const handleCreateInitiatives = useCallback((reportId: string) => {
    setSelectedReportId(reportId);
    setActiveTab('initiatives');
    // Will trigger initiative generation flow
  }, []);

  // Open document in a new tab
  const handleOpenDocument = useCallback(
    (id: string, type: DocumentType, name: string, status?: string) => {
      setOpenDocuments((prev) => {
        // Check if already open
        const existing = prev.find((doc) => doc.id === id);
        if (existing) {
          return prev;
        }
        return [...prev, { id, type, name, status }];
      });
      setActiveDocumentId(id);
      setShowListView(false);
    },
    []
  );

  // Close document tab
  const handleCloseDocument = useCallback(
    (id: string) => {
      setOpenDocuments((prev) => {
        const filtered = prev.filter((doc) => doc.id !== id);
        // If closing active document, select another one or show list
        if (activeDocumentId === id) {
          if (filtered.length > 0) {
            setActiveDocumentId(filtered[filtered.length - 1].id);
          } else {
            setActiveDocumentId(null);
            setShowListView(true);
          }
        }
        return filtered;
      });
    },
    [activeDocumentId]
  );

  // Select document tab
  const handleSelectDocument = useCallback((id: string) => {
    setActiveDocumentId(id);
    setShowListView(false);
  }, []);

  // Close all document tabs
  const handleCloseAllDocuments = useCallback(() => {
    setOpenDocuments([]);
    setActiveDocumentId(null);
    setShowListView(true);
  }, []);

  // Show list view (table)
  const handleShowList = useCallback(() => {
    setActiveDocumentId(null);
    setShowListView(true);
  }, []);

  // Open report in tab
  const handleOpenReport = useCallback(
    (reportId: string, reportName: string, status?: string) => {
      handleOpenDocument(reportId, 'report', reportName, status);
    },
    [handleOpenDocument]
  );

  // Open initiative in tab
  const handleOpenInitiative = useCallback(
    (initiativeId: string, initiativeName: string, status?: string) => {
      handleOpenDocument(initiativeId, 'initiative', initiativeName, status);
    },
    [handleOpenDocument]
  );

  // Clear tabs when switching main tabs (Assessment/Map/Reports/Initiatives)
  const handleTabChange = useCallback(
    (tab: HubTab) => {
      // Only clear tabs when switching between Reports and Initiatives
      if (
        (activeTab === 'reports' || activeTab === 'initiatives') &&
        (tab === 'reports' || tab === 'initiatives') &&
        activeTab !== tab
      ) {
        setOpenDocuments([]);
        setActiveDocumentId(null);
        setShowListView(true);
      }
      setActiveTab(tab);
    },
    [activeTab]
  );

  // Calculate assessment progress based on filled axes
  const calculateProgress = useCallback(() => {
    const assessmentData = useAppStore.getState().fullSessionData?.assessment || {};
    const axes: DRDAxis[] = [
      'processes',
      'digitalProducts',
      'businessModels',
      'dataManagement',
      'culture',
      'cybersecurity',
      'aiMaturity',
    ];

    let filledAxes = 0;
    axes.forEach((axis) => {
      const axisData = assessmentData[axis];
      if (axisData && (axisData.actual > 0 || axisData.target > 0 || axisData.areaScores)) {
        filledAxes++;
      }
    });

    return Math.round((filledAxes / 7) * 100);
  }, []);

  // Get axis progress status for navigation bar indicators
  const getAxisProgressStatus = useCallback((axisId: DRDAxis): 'empty' | 'partial' | 'complete' => {
    const assessmentData = useAppStore.getState().fullSessionData?.assessment || {};
    const axisData = assessmentData[axisId];

    if (!axisData) return 'empty';

    if (axisData.areaScores) {
      const areaKeys = Object.keys(axisData.areaScores);
      if (areaKeys.length === 0) return 'empty';

      let worked = 0;
      let rated = 0;

      areaKeys.forEach((key) => {
        const scores = axisData.areaScores?.[key] || [0, 0];
        if (scores[0] > 0 || scores[1] > 0) worked++;
        if (scores[0] > 0 && scores[1] > 0) rated++;
      });

      if (rated === areaKeys.length) return 'complete';
      if (worked > 0) return 'partial';
      return 'empty';
    }

    // Fallback to aggregate values
    const hasActual = (axisData.actual || 0) > 0;
    const hasTarget = (axisData.target || 0) > 0;

    if (hasActual && hasTarget) return 'complete';
    if (hasActual || hasTarget) return 'partial';
    return 'empty';
  }, []);

  // Save assessment to database
  const handleSaveAssessment = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const assessmentData = useAppStore.getState().fullSessionData?.assessment || {};
      const name = assessmentMeta?.name || 'Nowy Assessment';
      const payload = {
        name,
        answers: assessmentData,
        completionPercent: calculateProgress(),
        navigation: { selectedAxis, framework },
      };

      const token = localStorage.getItem('token');
      const legacyHeaders = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      let assessmentId = selectedAssessmentId;

      if (!assessmentId) {
        try {
          const created = await V8AssessmentApi.createAssessment({
            assessmentType: framework,
            name,
            projectId: currentProjectId ?? null,
          });
          assessmentId = created.id || created.assessment?.id || null;
        } catch {
          const createResponse = await fetch('/api/assessment-workflow-v2', {
            method: 'POST',
            headers: legacyHeaders,
            body: JSON.stringify({
              assessmentType: framework,
              name,
              projectId: currentProjectId ?? null,
            }),
          });
          if (!createResponse.ok) {
            const errorData = await createResponse.json().catch(() => ({}));
            throw new Error(
              errorData.error || t('assessment.hub.createFailed', 'Failed to create assessment')
            );
          }
          const created = await createResponse.json();
          assessmentId = created.id || null;
        }
      }

      if (!assessmentId) {
        throw new Error(t('assessment.hub.missingId', 'Missing assessment id'));
      }

      try {
        await V8AssessmentApi.updateAssessment(assessmentId, payload);
      } catch {
        const updateResponse = await fetch(`/api/assessment-workflow-v2/${assessmentId}`, {
          method: 'PUT',
          headers: legacyHeaders,
          body: JSON.stringify(payload),
        });
        if (!updateResponse.ok) {
          const errorData = await updateResponse.json().catch(() => ({}));
          throw new Error(
            errorData.error || t('assessment.hub.saveFailed', 'Failed to save assessment')
          );
        }
      }

      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      toast.success('Assessment zapisany');

      if (assessmentId !== selectedAssessmentId) {
        setSelectedAssessmentId(assessmentId);
      }
      setAssessmentMeta((prev) =>
        prev ? { ...prev, name, isNew: false } : { name, isNew: false }
      );
    } catch (error) {
      console.error('[AssessmentModuleHub] Save error:', error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : t('assessment.hub.connectionError', 'Connection error');
      setSaveError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  }, [
    selectedAssessmentId,
    currentProjectId,
    assessmentMeta,
    framework,
    calculateProgress,
    selectedAxis,
    t,
  ]);

  // Handle assessment name change
  const handleNameChange = useCallback((newName: string) => {
    setAssessmentMeta((prev) =>
      prev ? { ...prev, name: newName } : { name: newName, isNew: true }
    );
    setHasUnsavedChanges(true);
  }, []);

  // Track changes in assessment data
  useEffect(() => {
    if (activeTab === 'map') {
      // Mark as having unsaved changes when data changes
      const unsubscribe = useAppStore.subscribe(() => {
        setHasUnsavedChanges(true);
      });
      return unsubscribe;
    }
    return undefined;
  }, [activeTab]);

  // Auto-save every 30 seconds when there are unsaved changes
  useEffect(() => {
    if (activeTab !== 'map' || !hasUnsavedChanges) return;

    const autoSaveInterval = setInterval(async () => {
      if (hasUnsavedChanges && !isSaving) {
        await handleSaveAssessment();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(autoSaveInterval);
  }, [activeTab, hasUnsavedChanges, isSaving, handleSaveAssessment]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts in Map tab
      if (activeTab !== 'map') return;

      // Cmd/Ctrl + S - Save assessment
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (!isSaving && hasUnsavedChanges) {
          handleSaveAssessment();
        }
      }

      // Escape - Close version history panel
      if (e.key === 'Escape') {
        setShowVersionHistory(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, isSaving, hasUnsavedChanges, handleSaveAssessment]);

  // Load assessment data when switching to Map tab with selected assessment
  const loadAssessmentData = useCallback(async (assessmentId: string) => {
    setIsLoadingAssessment(true);
    try {
      let assessmentRecord: Record<string, any> | null = null;

      try {
        const data = await V8AssessmentApi.getAssessment(assessmentId);
        assessmentRecord = data.assessment as Record<string, any>;
      } catch {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/assessment-workflow-v2/${assessmentId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          assessmentRecord = await response.json();
        }
      }

      if (!assessmentRecord) {
        console.warn('[AssessmentModuleHub] Assessment not found or error');
        setAssessmentMeta({ name: 'Nowy Assessment', isNew: true });
        return;
      }

      const answers = assessmentRecord.answers || assessmentRecord.axisData || {};
      const completionPercent = Number(
        assessmentRecord.completion_percent ?? assessmentRecord.completionPercent ?? 0
      );

      const { setFullSessionData, fullSessionData } = useAppStore.getState();
      setFullSessionData({
        ...fullSessionData,
        assessment: {
          ...fullSessionData.assessment,
          ...answers,
          completedAxes:
            completionPercent >= 100
              ? COMPLETED_AXES
              : fullSessionData.assessment?.completedAxes || [],
        },
      });

      setAssessmentMeta({
        name: assessmentRecord.name || 'Nowy Assessment',
        isNew: false,
        status: (assessmentRecord.backendStatus || assessmentRecord.status || undefined) as
          | WorkflowStatus
          | undefined,
      });
    } catch (error) {
      console.error('[AssessmentModuleHub] Error loading assessment:', error);
      setAssessmentMeta({ name: 'Nowy Assessment', isNew: true });
    } finally {
      setIsLoadingAssessment(false);
    }
  }, []);

  // Effect: Load assessment data when switching to Map tab
  useEffect(() => {
    if (activeTab === 'map' && selectedAssessmentId) {
      loadAssessmentData(selectedAssessmentId);
    } else if (activeTab === 'map' && !selectedAssessmentId) {
      // New assessment - reset to default
      setAssessmentMeta({ name: 'Nowy Assessment', isNew: true });
    }
  }, [activeTab, selectedAssessmentId, loadAssessmentData]);

  useEffect(() => {
    if (activeTab !== 'map') {
      setIsInitiativesDrawerOpen(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!selectedAssessmentId) {
      setIsInitiativesDrawerOpen(false);
    }
  }, [selectedAssessmentId]);

  useEffect(() => {
    if (!selectedAssessmentId || !assessmentMeta?.name || assessmentMeta?.isNew) return;
    setOpenAssessments((prev) => {
      const exists = prev.find((item) => item.id === selectedAssessmentId);
      if (exists) {
        return prev.map((item) =>
          item.id === selectedAssessmentId
            ? { ...item, name: assessmentMeta.name, status: assessmentMeta.status }
            : item
        );
      }
      return [
        ...prev,
        { id: selectedAssessmentId, name: assessmentMeta.name, status: assessmentMeta.status },
      ];
    });
  }, [selectedAssessmentId, assessmentMeta?.name, assessmentMeta?.status, assessmentMeta?.isNew]);

  // Check if framework is implemented - all frameworks now supported
  const isFrameworkImplemented = ['DRD', 'SIRI', 'ADMA', 'CMMI', 'LEAN'].includes(framework);

  // Render content based on active tab
  const renderContent = () => {
    // If framework not yet implemented, show in development message
    if (!isFrameworkImplemented && activeTab === 'map') {
      return (
        <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-navy-950/50">
          <div className="text-center max-w-md">
            <div
              className={`w-20 h-20 rounded-xl bg-${frameworkConfig.color}-100 dark:bg-${frameworkConfig.color}-900/30 flex items-center justify-center mx-auto mb-6`}
            >
              {frameworkConfig.icon}
            </div>
            <h2 className="text-2xl font-bold text-c-text mb-3">{frameworkConfig.name}</h2>
            <p className="text-c-text-secondary mb-2">{frameworkConfig.description}</p>
            <span className="inline-block px-4 py-2 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-full text-sm font-medium">
              In Development
            </span>
          </div>
        </div>
      );
    }

    const FallbackLoader = () => (
      <div className="h-full p-6">
        <LoadingState template="panel" />
      </div>
    );

    switch (activeTab) {
      case 'assessment':
        return (
          <AssessmentTable
            projectId={currentProjectId || ''}
            onOpenInMap={handleOpenInMap}
            onNewAssessment={handleNewAssessment}
            onCreateReport={handleCreateReport}
          />
        );

      case 'map':
        // Show loading spinner while fetching assessment data
        if (isLoadingAssessment) {
          return (
            <div className="h-full bg-[var(--c-surface)]">
              <LoadingState
                variant="progress"
                label={t('assessment.hub.loadingData', 'Loading assessment data…')}
              />
            </div>
          );
        }

        const renderMapWithSidebar = (content: React.ReactNode) => (
          <div className="flex h-full">
            {/* Dynamiczne submenu z otwartymi assessmentami */}
            <div className="w-56 shrink-0 border-r border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950/50 hidden lg:flex flex-col">
              <div className="px-3 py-3 border-b border-slate-200 dark:border-navy-700">
                <div className="text-xs font-semibold text-c-text-secondary">
                  Otwarte assessmenty
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
                {openAssessments.length === 0 ? (
                  <div className="text-xs text-c-text-muted px-2 py-2">
                    Brak aktywnych assessmentow
                  </div>
                ) : (
                  openAssessments.map((item) => {
                    const isActive = item.id === selectedAssessmentId;
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between gap-2 px-2 py-2 rounded-md text-xs transition-colors ${
                          isActive
                            ? 'bg-navy-900 text-white'
                            : 'bg-white dark:bg-navy-900 text-c-text-secondary hover:bg-slate-100 dark:hover:bg-navy-800'
                        }`}
                      >
                        <button
                          className="flex-1 text-left truncate"
                          onClick={() => handleSelectOpenAssessment(item.id)}
                          title={item.name}
                        >
                          {item.name}
                        </button>
                        <button
                          className={`p-1 rounded ${
                            isActive
                              ? 'hover:bg-white/20'
                              : 'hover:bg-slate-200 dark:hover:bg-white/10'
                          }`}
                          onClick={() => handleCloseOpenAssessment(item.id)}
                          title="Close"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Workspace */}
            <div className="flex-1 overflow-hidden">{content}</div>
          </div>
        );

        // Map shows either Dashboard or specific Axis Workspace
        if (framework === 'DRD') {
          // Get assessment data from store
          const assessmentData = useAppStore.getState().fullSessionData?.assessment || {};

          // If dashboard selected, show Gap Map + Matrices overview
          if (selectedAxis === 'dashboard') {
            const handleAxisNavigate = (axis: DRDAxis) => {
              setSelectedAxis(axis);
            };
            const dashboard = (
              <AssessmentSummaryWorkspace
                assessment={assessmentData}
                onNavigate={handleAxisNavigate}
                assessmentName={assessmentMeta?.name || 'Nowy Assessment'}
                isNewAssessment={assessmentMeta?.isNew ?? !selectedAssessmentId}
                onNameChange={handleNameChange}
              />
            );
            return renderMapWithSidebar(dashboard);
          }

          // Otherwise show the specific axis workspace
          const axisData = assessmentData[selectedAxis] || {};

          const handleAxisChange = (newData: any) => {
            const { setFullSessionData, fullSessionData } = useAppStore.getState();
            setFullSessionData({
              ...fullSessionData,
              assessment: {
                ...fullSessionData.assessment,
                [selectedAxis as DRDAxis]: newData,
              },
            });
          };

          const handleAxisNext = () => {
            const currentIndex = drdAxes.findIndex((a) => a.id === selectedAxis);
            if (currentIndex < drdAxes.length - 1) {
              setSelectedAxis(drdAxes[currentIndex + 1].id);
            } else {
              setSelectedAxis('dashboard');
            }
          };

          const axisWorkspace = (
            <AssessmentAxisWorkspace
              axis={selectedAxis as DRDAxis}
              data={axisData}
              onChange={handleAxisChange}
              onNext={handleAxisNext}
              context={{
                goals: [],
                challenges: [],
                industry: '',
              }}
              projectId={currentProjectId || undefined}
              assessmentId={selectedAssessmentId || undefined}
            />
          );
          return renderMapWithSidebar(axisWorkspace);
        }

        const frameworkMap = (
          <React.Suspense fallback={<FallbackLoader />}>
            {/* SIRI Assessment Map */}
            {framework === 'SIRI' && (
              <SIRIAssessmentMap
                data={useMultiFrameworkStore.getState().siriData || undefined}
                onChange={(data) => {
                  setHasUnsavedChanges(true);
                  useMultiFrameworkStore.getState().setFrameworkData('SIRI', data);
                }}
                readOnly={false}
                showLegalNotice={true}
              />
            )}

            {/* ADMA Assessment Map */}
            {framework === 'ADMA' && (
              <ADMAAssessmentMap
                data={useMultiFrameworkStore.getState().admaData || undefined}
                onChange={(data) => {
                  setHasUnsavedChanges(true);
                  useMultiFrameworkStore.getState().setFrameworkData('ADMA', data);
                }}
                readOnly={false}
                showLegalNotice={true}
              />
            )}

            {/* CMMI Assessment Map */}
            {framework === 'CMMI' && (
              <CMPracticeMap
                data={useMultiFrameworkStore.getState().cmmiData || undefined}
                onChange={(data) => {
                  setHasUnsavedChanges(true);
                  useMultiFrameworkStore.getState().setFrameworkData('CMMI', data);
                }}
                readOnly={false}
                showLegalNotice={true}
              />
            )}

            {/* Lean 4.0 / DBR77 Assessment Map */}
            {framework === 'LEAN' && (
              <DBR77LeanMap
                data={useMultiFrameworkStore.getState().leanData || undefined}
                onChange={(data) => {
                  setHasUnsavedChanges(true);
                  useMultiFrameworkStore.getState().setFrameworkData('LEAN', data);
                }}
                readOnly={false}
              />
            )}
          </React.Suspense>
        );
        return renderMapWithSidebar(frameworkMap);

      case 'reports': {
        // Get active document if it's a report
        const activeReport = openDocuments.find(
          (doc) => doc.id === activeDocumentId && doc.type === 'report'
        );

        // If a report is selected and we're not in list view, show the full Report Builder
        if (activeReport && !showListView) {
          return (
            <ReportEditor
              reportId={activeReport.id}
              onClose={() => handleCloseDocument(activeReport.id)}
              onSaved={() => {}}
              onFinalized={() => {}}
            />
          );
        }

        // Otherwise show the table
        return (
          <React.Suspense fallback={<FallbackLoader />}>
            <ReportsTable
              projectId={currentProjectId || ''}
              framework={framework}
              onCreateInitiatives={handleCreateInitiatives}
              pendingAssessmentId={selectedAssessmentId}
              onOpenReport={handleOpenReport}
              showAllStatuses
            />
          </React.Suspense>
        );
      }

      case 'initiatives': {
        // Get active document if it's an initiative
        const activeInitiative = openDocuments.find(
          (doc) => doc.id === activeDocumentId && doc.type === 'initiative'
        );

        // If an initiative is selected and we're not in list view, show the details
        if (activeInitiative && !showListView) {
          return (
            <InitiativeDetailsModal
              initiativeId={activeInitiative.id}
              embedded={true}
              onClose={() => handleCloseDocument(activeInitiative.id)}
              onEdit={(id) => {
                // Keep in the same view
              }}
              onApprove={async (id) => {
                // Handle approval
              }}
              onDelete={(id) => {
                handleCloseDocument(id);
              }}
              onAddToRoadmap={(id) => {
                // Handle roadmap transfer
              }}
            />
          );
        }

        // Otherwise show the table
        return (
          <React.Suspense fallback={<FallbackLoader />}>
            <InitiativesTable
              projectId={currentProjectId || ''}
              framework={framework}
              pendingReportId={selectedReportId}
              onOpenInitiative={handleOpenInitiative}
            />
          </React.Suspense>
        );
      }

      default:
        return null;
    }
  };
  // Safety check - if framework is unknown, show error instead of crashing
  if (!frameworkConfig) {
    return (
      <SplitLayout title="Assessment" currentView={AppView.ASSESSMENT_OVERVIEW}>
        <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-navy-950 p-8">
          <div className="text-center max-w-md bg-white dark:bg-navy-900 p-8 rounded-xl shadow-lg border border-danger-200 dark:border-danger-900/30">
            <div className="w-16 h-16 rounded-full bg-danger-100 dark:bg-danger-900/20 flex items-center justify-center mx-auto mb-4 text-danger-600 dark:text-danger-400">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-xl font-bold text-c-text mb-2">Unknown Framework</h2>
            <p className="text-c-text-secondary">
              The assessment framework "{framework}" is not recognized or configured.
            </p>
          </div>
        </div>
      </SplitLayout>
    );
  }

  return (
    <SplitLayout
      title={`${framework} - ${frameworkConfig.name}`}
      currentView={AppView.ASSESSMENT_OVERVIEW}
    >
      <div className="flex flex-col h-full bg-white dark:bg-navy-900">
        {/* Framework Header - Compact on mobile */}
        <div
          className={`shrink-0 bg-gradient-to-r from-slate-50 to-white dark:from-navy-950 dark:to-navy-900 border-b border-slate-200 dark:border-navy-700 ${isCompact ? 'px-4 py-3' : 'px-6 py-4'}`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`rounded-xl bg-c-accent-soft flex items-center justify-center text-c-accent ${isCompact ? 'w-10 h-10' : 'w-12 h-12'}`}
            >
              {React.cloneElement(frameworkConfig.icon as React.ReactElement<{ size?: number }>, {
                size: isCompact ? 20 : 24,
              })}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className={`font-bold text-c-text truncate ${isCompact ? 'text-lg' : 'text-xl'}`}>
                {framework}
              </h1>
              <p className={`text-c-text-secondary truncate ${isCompact ? 'text-xs' : 'text-sm'}`}>
                {frameworkConfig.name}
              </p>
            </div>
          </div>
        </div>

        {/* Top Menu - Horizontal scrollable on mobile/tablet */}
        <div className="shrink-0 border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950">
          <div
            className={`flex items-center gap-2 overflow-x-auto scrollbar-hide scroll-snap-x momentum-scroll ${isCompact ? 'p-2 px-4' : 'p-2 px-6'}`}
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`
                                    scroll-snap-item touch-target touch-ripple flex items-center justify-center gap-2
                                    rounded-lg font-medium transition-colors duration-200 whitespace-nowrap shrink-0
                                    ${
                                      isCompact
                                        ? 'px-3 py-2.5 text-xs min-w-[90px]'
                                        : 'px-4 py-2 text-sm min-w-[130px]'
                                    }
                                    ${
                                      isActive
                                        ? 'bg-slate-900/[0.07] text-slate-900 border border-slate-300 dark:bg-white/10 dark:text-slate-100 dark:border-white/25'
                                        : 'bg-white dark:bg-navy-900 text-c-text-secondary active:bg-slate-100 dark:active:bg-white/10 border border-c-border-subtle'
                                    }
                                `}
                >
                  {React.cloneElement(tab.icon as React.ReactElement<{ size?: number }>, {
                    size: isCompact ? 14 : 16,
                  })}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Secondary Navigation Bar - always visible for DRD */}
        {framework === 'DRD' && (
          <div
            className={`shrink-0 bg-slate-100 dark:bg-navy-950/50 border-b border-slate-200 dark:border-navy-700 ${isCompact ? 'px-4 py-1' : 'px-6 py-1'} relative`}
          >
            {/* Scroll fade indicators */}
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-100 dark:from-navy-950/50 to-transparent z-10 opacity-0 peer-scroll-left:opacity-100" />
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-100 dark:from-navy-950/50 to-transparent z-10" />
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide scroll-snap-x momentum-scroll min-h-[28px] px-1 -mx-1">
              {/* DRD Axes Buttons - only shown for Map tab */}
              {activeTab === 'map' && (
                <>
                  {/* Dashboard Button */}
                  <button
                    onClick={() => setSelectedAxis('dashboard')}
                    className={`
                                        scroll-snap-item touch-target touch-ripple flex items-center gap-1
                                        rounded-md font-medium transition-colors duration-200 whitespace-nowrap shrink-0
                                        ${isCompact ? 'px-2.5 py-1' : 'px-3 py-1'} text-xs
                                        ${
                                          selectedAxis === 'dashboard'
                                            ? 'bg-slate-900/[0.07] text-slate-900 border border-slate-300 dark:bg-white/10 dark:text-slate-100 dark:border-white/25'
                                            : 'bg-white dark:bg-navy-900 text-c-text-secondary active:bg-primary-50 dark:active:bg-primary-900/20 border border-c-border-subtle'
                                        }
                                    `}
                  >
                    <LayoutDashboard size={14} />
                    {isCompact ? 'Dash' : 'Dashboard'}
                  </button>

                  {/* Axis Buttons */}
                  {drdAxes.map((axis, index) => {
                    const isActive = selectedAxis === axis.id;
                    const progressStatus = getAxisProgressStatus(axis.id);

                    // Determine indicator styles based on progress
                    const getIndicatorClasses = () => {
                      if (isActive)
                        return 'bg-slate-900/10 text-slate-900 dark:bg-white/20 dark:text-white';
                      switch (progressStatus) {
                        case 'complete':
                          return 'bg-green-500 text-white';
                        case 'partial':
                          return 'bg-yellow-500 text-white';
                        default:
                          return 'bg-c-accent-soft text-c-accent';
                      }
                    };

                    return (
                      <button
                        key={axis.id}
                        onClick={() => setSelectedAxis(axis.id)}
                        className={`
                                                scroll-snap-item touch-target touch-ripple flex items-center gap-1
                                                rounded-md font-medium transition-colors duration-200 whitespace-nowrap shrink-0
                                                ${isCompact ? 'px-2.5 py-1' : 'px-3 py-1'} text-xs
                                                ${
                                                  isActive
                                                    ? 'bg-slate-900/[0.07] text-slate-900 border border-slate-300 dark:bg-white/10 dark:text-slate-100 dark:border-white/25'
                                                    : progressStatus === 'complete'
                                                      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/30'
                                                      : progressStatus === 'partial'
                                                        ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-500/30'
                                                        : 'bg-white dark:bg-navy-900 text-c-text-secondary active:bg-primary-50 dark:active:bg-primary-900/20 border border-c-border-subtle'
                                                }
                                            `}
                      >
                        <span
                          className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${getIndicatorClasses()}`}
                        >
                          {progressStatus === 'complete' && !isActive ? '✓' : index + 1}
                        </span>
                        {isCompact ? axis.label.slice(0, 3) : axis.label}
                      </button>
                    );
                  })}
                </>
              )}

              {/* Placeholder for other tabs - module-specific buttons will go here */}
              {activeTab === 'assessment' && (
                <span className="text-xs text-c-text-muted italic">
                  {/* Assessment tab actions placeholder */}
                </span>
              )}
              {activeTab === 'reports' && (
                <span className="text-xs text-c-text-muted italic">
                  {/* Reports tab actions placeholder */}
                </span>
              )}
              {activeTab === 'initiatives' && (
                <span className="text-xs text-c-text-muted italic">
                  {/* Initiatives tab actions placeholder */}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Workflow Status Bar - Always visible in Map tab */}
        {activeTab === 'map' && (
          <WorkflowStatusBar
            assessmentId={selectedAssessmentId || ''}
            currentStatus={assessmentMeta?.status || 'DRAFT'}
          />
        )}

        {/* Initiatives Drawer Toggle */}
        {activeTab === 'map' && (
          <div className="shrink-0 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700 px-4 py-2 flex justify-end">
            <button
              onClick={() => setIsInitiativesDrawerOpen((prev) => !prev)}
              disabled={!selectedAssessmentId}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                selectedAssessmentId
                  ? 'bg-amber-500 text-white hover:bg-amber-400'
                  : 'bg-c-surface-raised text-c-text-muted cursor-not-allowed'
              }`}
            >
              <Lightbulb size={14} />
              Initiatives drawer
            </button>
          </div>
        )}

        {/* Document Tabs Bar - visible for Reports and Initiatives tabs when documents are open */}
        {(activeTab === 'reports' || activeTab === 'initiatives') && (
          <DocumentTabsBar
            openDocuments={openDocuments.filter((doc) =>
              activeTab === 'reports' ? doc.type === 'report' : doc.type === 'initiative'
            )}
            activeDocumentId={activeDocumentId}
            onSelectDocument={handleSelectDocument}
            onCloseDocument={handleCloseDocument}
            onCloseAll={handleCloseAllDocuments}
            showListButton={!showListView}
            onShowList={handleShowList}
          />
        )}

        {/* Save Bar - Only visible in Map tab */}
        {activeTab === 'map' && framework === 'DRD' && (
          <div
            className={`shrink-0 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700 ${isCompact ? 'px-4 py-2' : 'px-6 py-2'}`}
          >
            <div className="flex items-center justify-between">
              {/* Progress Indicator */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-c-text-secondary">
                  {t('assessment.hub.progress', 'Progress:')}
                </span>
                <div className="w-32 h-2 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-navy-900 rounded-full transition-all duration-300"
                    style={{ width: `${calculateProgress()}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-c-text">{calculateProgress()}%</span>
                {hasUnsavedChanges && (
                  <span className="text-xs text-amber-500 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle size={12} />
                    Unsaved changes
                    <span className="text-c-text-muted ml-1">(auto-save in 30s)</span>
                  </span>
                )}
                {lastSaved && !hasUnsavedChanges && (
                  <span className="text-xs text-green-500 dark:text-green-400 flex items-center gap-1">
                    <Check size={12} />
                    Auto-saved{' '}
                    {lastSaved.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>

              {/* Save Button & Status */}
              <div className="flex items-center gap-3">
                {saveError && (
                  <span className="text-xs text-danger-500 dark:text-danger-400">{saveError}</span>
                )}
                {lastSaved && !saveError && (
                  <span className="text-xs text-c-text-muted">
                    Saved:{' '}
                    {lastSaved.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {/* Version History Button */}
                {selectedAssessmentId && (
                  <button
                    onClick={() => setShowVersionHistory(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-c-surface-raised text-c-text-secondary hover:bg-c-surface-raised rounded-lg font-medium text-sm transition-colors"
                    title="Version history"
                  >
                    <History size={16} />
                    History
                  </button>
                )}
                <button
                  onClick={handleSaveAssessment}
                  disabled={isSaving}
                  className={`
                                    flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors duration-200
                                    ${
                                      isSaving
                                        ? 'bg-c-surface-raised text-c-text-muted cursor-not-allowed'
                                        : hasUnsavedChanges
                                          ? 'bg-green-600 hover:bg-green-500 text-white shadow-md shadow-green-600/20'
                                          : 'bg-c-surface-raised text-c-text-secondary hover:bg-slate-200 dark:hover:bg-navy-700'
                                    }
                                `}
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {t('assessment.hub.saving', 'Saving...')}
                    </>
                  ) : lastSaved && !hasUnsavedChanges ? (
                    <>
                      <Check size={16} />
                      Saved
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Save
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative">
          {renderContent()}
          <AssessmentInitiativesDrawer
            isOpen={isInitiativesDrawerOpen}
            onClose={() => setIsInitiativesDrawerOpen(false)}
            projectId={currentProjectId || ''}
            assessmentId={selectedAssessmentId}
            framework={framework}
          />
        </div>

        {/* Version History Panel */}
        {selectedAssessmentId && (
          <VersionHistoryPanel
            assessmentId={selectedAssessmentId}
            assessmentName={assessmentMeta?.name || 'Assessment'}
            isOpen={showVersionHistory}
            onClose={() => setShowVersionHistory(false)}
            onRestored={() => {
              // Reload assessment data after restoring
              loadAssessmentData(selectedAssessmentId);
              setShowVersionHistory(false);
            }}
          />
        )}
      </div>
    </SplitLayout>
  );
};
