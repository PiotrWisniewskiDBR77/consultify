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

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import {
    FileText,
    Map,
    FileOutput,
    Lightbulb,
    Plus,
    ArrowRight,
    Activity,
    Cpu,
    Database,
    Layers,
    Workflow,
    ChevronRight,
    LayoutDashboard,
    Loader2,
    Save,
    Check,
    AlertCircle,
    History
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';
import { useDeviceType } from '../../hooks/useDeviceType';

// Sub-components
import { AssessmentTable } from './AssessmentTable';
import { ReportsTable } from './ReportsTable';
import { InitiativesTable } from './InitiativesTable';
import { AssessmentSummaryWorkspace } from './AssessmentSummaryWorkspace';
import { AssessmentAxisWorkspace } from './AssessmentAxisWorkspace';
import { VersionHistoryPanel } from './panels/VersionHistoryPanel';
import { WorkflowStatusBar } from './WorkflowStatusBar';
import { DocumentTabsBar, OpenDocument, DocumentType } from './DocumentTabsBar';
import { ReportEditor } from './ReportEditor';
import { ReportBuilderWorkspace } from './ReportBuilderWorkspace';
import { InitiativeDetailsModal } from './modals/InitiativeDetailsModal';
import { DRDAxis } from '../../types';

// Type for axis selection including dashboard
type AxisSelection = 'dashboard' | DRDAxis;

// Type matching WorkflowStatusBar's expected status type
type WorkflowStatus = 'DRAFT' | 'IN_REVIEW' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED';

export type HubTab = 'assessment' | 'map' | 'reports' | 'initiatives';
export type AssessmentFramework = 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';

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
        description: 'Manage your assessments'
    },
    {
        id: 'map',
        label: 'Map',
        icon: <Map size={16} />,
        description: 'Assessment Editor'
    },
    {
        id: 'reports',
        label: 'Reports',
        icon: <FileOutput size={16} />,
        description: 'Assessment reports'
    },
    {
        id: 'initiatives',
        label: 'Initiatives',
        icon: <Lightbulb size={16} />,
        description: 'Transformation initiatives'
    }
];

// Framework metadata
const FRAMEWORK_CONFIG: Record<AssessmentFramework, { name: string; icon: React.ReactNode; color: string; description: string }> = {
    DRD: {
        name: 'Digital Readiness Diagnosis',
        icon: <Activity size={24} />,
        color: 'purple',
        description: '7-axis digital maturity assessment'
    },
    SIRI: {
        name: 'Smart Industry Readiness Index',
        icon: <Cpu size={24} />,
        color: 'blue',
        description: 'Industry 4.0 readiness assessment'
    },
    ADMA: {
        name: 'Advanced Digital Maturity Assessment',
        icon: <Database size={24} />,
        color: 'green',
        description: 'Comprehensive digital maturity model'
    },
    CMMI: {
        name: 'Capability Maturity Model Integration',
        icon: <Layers size={24} />,
        color: 'orange',
        description: 'Process improvement framework'
    },
    LEAN: {
        name: 'Lean 4.0',
        icon: <Workflow size={24} />,
        color: 'cyan',
        description: 'Lean manufacturing maturity assessment'
    }
};

interface AssessmentModuleHubProps {
    framework: AssessmentFramework;
    initialTab?: HubTab;
    initialAssessmentId?: string;
    onNavigate?: (view: AppView, params?: any) => void;
}

export const AssessmentModuleHub: React.FC<AssessmentModuleHubProps> = ({
    framework,
    initialTab = 'assessment',
    initialAssessmentId,
    onNavigate
}) => {
    const { currentProjectId, setCurrentView } = useAppStore();
    const frameworkConfig = FRAMEWORK_CONFIG[framework];
    const { isTablet, isMobile, isTouchDevice } = useDeviceType();
    const isCompact = isTablet || isMobile;

    // State
    const [activeTab, setActiveTab] = useState<HubTab>(initialTab);
    const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(initialAssessmentId || null);
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [selectedAxis, setSelectedAxis] = useState<AxisSelection>('dashboard');
    const [isLoadingAssessment, setIsLoadingAssessment] = useState(false);
    const [assessmentMeta, setAssessmentMeta] = useState<{ name: string; isNew: boolean; status?: WorkflowStatus } | null>(null);

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
    const handleNavigate = useCallback((view: AppView, params?: any) => {
        if (onNavigate) {
            onNavigate(view, params);
        } else {
            setCurrentView(view);
        }
    }, [onNavigate, setCurrentView]);

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

    // Create initiatives from approved report
    const handleCreateInitiatives = useCallback((reportId: string) => {
        setSelectedReportId(reportId);
        setActiveTab('initiatives');
        // Will trigger initiative generation flow
    }, []);

    // Open document in a new tab
    const handleOpenDocument = useCallback((id: string, type: DocumentType, name: string, status?: string) => {
        setOpenDocuments(prev => {
            // Check if already open
            const existing = prev.find(doc => doc.id === id);
            if (existing) {
                return prev;
            }
            return [...prev, { id, type, name, status }];
        });
        setActiveDocumentId(id);
        setShowListView(false);
    }, []);

    // Close document tab
    const handleCloseDocument = useCallback((id: string) => {
        setOpenDocuments(prev => {
            const filtered = prev.filter(doc => doc.id !== id);
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
    }, [activeDocumentId]);

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
    const handleOpenReport = useCallback((reportId: string, reportName: string, status?: string) => {
        handleOpenDocument(reportId, 'report', reportName, status);
    }, [handleOpenDocument]);

    // Open initiative in tab
    const handleOpenInitiative = useCallback((initiativeId: string, initiativeName: string, status?: string) => {
        handleOpenDocument(initiativeId, 'initiative', initiativeName, status);
    }, [handleOpenDocument]);

    // Clear tabs when switching main tabs (Assessment/Map/Reports/Initiatives)
    const handleTabChange = useCallback((tab: HubTab) => {
        // Only clear tabs when switching between Reports and Initiatives
        if ((activeTab === 'reports' || activeTab === 'initiatives') && 
            (tab === 'reports' || tab === 'initiatives') &&
            activeTab !== tab) {
            setOpenDocuments([]);
            setActiveDocumentId(null);
            setShowListView(true);
        }
        setActiveTab(tab);
    }, [activeTab]);

    // Calculate assessment progress based on filled axes
    const calculateProgress = useCallback(() => {
        const assessmentData = useAppStore.getState().fullSessionData?.assessment || {};
        const axes: DRDAxis[] = ['processes', 'digitalProducts', 'businessModels', 'dataManagement', 'culture', 'cybersecurity', 'aiMaturity'];

        let filledAxes = 0;
        axes.forEach(axis => {
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

            areaKeys.forEach(key => {
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
            const token = localStorage.getItem('token');
            const assessmentData = useAppStore.getState().fullSessionData?.assessment || {};

            // Determine endpoint - use project-based or assessment-based
            const endpoint = selectedAssessmentId
                ? `/api/assessment/${selectedAssessmentId}`
                : `/api/assessment/${currentProjectId}`;

            const response = await fetch(endpoint, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: assessmentMeta?.name || 'Nowy Assessment',
                    axisData: assessmentData,
                    projectId: currentProjectId,
                    framework: framework
                })
            });

            if (response.ok) {
                const data = await response.json();
                setLastSaved(new Date());
                setHasUnsavedChanges(false);
                toast.success('Assessment zapisany');

                // If new assessment was created, update the selected ID
                if (data.id && !selectedAssessmentId) {
                    setSelectedAssessmentId(data.id);
                    setAssessmentMeta(prev => prev ? { ...prev, isNew: false } : null);
                }
            } else {
                const errorData = await response.json();
                setSaveError(errorData.error || 'Nie udało się zapisać');
                toast.error('Nie udało się zapisać assessment');
            }
        } catch (error) {
            console.error('[AssessmentModuleHub] Save error:', error);
            setSaveError('Błąd połączenia');
            toast.error('Błąd połączenia');
        } finally {
            setIsSaving(false);
        }
    }, [selectedAssessmentId, currentProjectId, assessmentMeta, framework]);

    // Handle assessment name change
    const handleNameChange = useCallback((newName: string) => {
        setAssessmentMeta(prev => prev ? { ...prev, name: newName } : { name: newName, isNew: true });
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
    }, [activeTab]);

    // Auto-save every 30 seconds when there are unsaved changes
    useEffect(() => {
        if (activeTab !== 'map' || !hasUnsavedChanges) return;

        const autoSaveInterval = setInterval(async () => {
            if (hasUnsavedChanges && !isSaving) {
                console.log('[AutoSave] Saving...');
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
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/assessments/${assessmentId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();

                // Update store with loaded assessment data
                const { setFullSessionData, fullSessionData } = useAppStore.getState();
                setFullSessionData({
                    ...fullSessionData,
                    assessment: {
                        ...fullSessionData.assessment,
                        ...data.axisData,
                        completedAxes: data.isComplete
                            ? ['processes', 'digitalProducts', 'businessModels', 'dataManagement', 'culture', 'cybersecurity', 'aiMaturity']
                            : fullSessionData.assessment?.completedAxes || []
                    }
                });

                setAssessmentMeta({
                    name: data.name,
                    isNew: false
                });
            } else {
                console.warn('[AssessmentModuleHub] Assessment not found or error');
                setAssessmentMeta({ name: 'Nowy Assessment', isNew: true });
            }
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

    // Check if framework is implemented (only DRD for now)
    const isFrameworkImplemented = framework === 'DRD';

    // Render content based on active tab
    const renderContent = () => {
        // If framework not yet implemented, show coming soon
        if (!isFrameworkImplemented && activeTab === 'map') {
            return (
                <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-navy-950/50">
                    <div className="text-center max-w-md">
                        <div className={`w-20 h-20 rounded-2xl bg-${frameworkConfig.color}-100 dark:bg-${frameworkConfig.color}-900/30 flex items-center justify-center mx-auto mb-6`}>
                            {frameworkConfig.icon}
                        </div>
                        <h2 className="text-2xl font-bold text-navy-900 dark:text-white mb-3">
                            {frameworkConfig.name}
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 mb-2">
                            {frameworkConfig.description}
                        </p>
                        <span className="inline-block px-4 py-2 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-full text-sm font-medium">
                            Coming Soon
                        </span>
                    </div>
                </div>
            );
        }

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
                        <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-navy-950/50">
                            <div className="text-center">
                                <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-3" />
                                <p className="text-sm text-slate-500 dark:text-slate-400">
                                    Ładowanie danych assessmentu...
                                </p>
                            </div>
                        </div>
                    );
                }

                // Map shows either Dashboard or specific Axis Workspace
                if (framework === 'DRD') {
                    // Get assessment data from store
                    const assessmentData = useAppStore.getState().fullSessionData?.assessment || {};

                    // If dashboard selected, show Gap Map + Matrices overview
                    if (selectedAxis === 'dashboard') {
                        const handleAxisNavigate = (axis: DRDAxis) => {
                            setSelectedAxis(axis);
                        };
                        return (
                            <AssessmentSummaryWorkspace
                                assessment={assessmentData}
                                onNavigate={handleAxisNavigate}
                                assessmentName={assessmentMeta?.name || 'Nowy Assessment'}
                                isNewAssessment={assessmentMeta?.isNew ?? !selectedAssessmentId}
                                onNameChange={handleNameChange}
                            />
                        );
                    }

                    // Otherwise show the specific axis workspace
                    const axisData = assessmentData[selectedAxis] || {};

                    const handleAxisChange = (newData: any) => {
                        const { setFullSessionData, fullSessionData } = useAppStore.getState();
                        setFullSessionData({
                            ...fullSessionData,
                            assessment: {
                                ...fullSessionData.assessment,
                                [selectedAxis as DRDAxis]: newData
                            }
                        });
                    };

                    const handleAxisNext = () => {
                        const currentIndex = drdAxes.findIndex(a => a.id === selectedAxis);
                        if (currentIndex < drdAxes.length - 1) {
                            setSelectedAxis(drdAxes[currentIndex + 1].id);
                        } else {
                            setSelectedAxis('dashboard');
                        }
                    };

                    return (
                        <AssessmentAxisWorkspace
                            axis={selectedAxis as DRDAxis}
                            data={axisData}
                            onChange={handleAxisChange}
                            onNext={handleAxisNext}
                            context={{
                                goals: [],
                                challenges: [],
                                industry: ''
                            }}
                            projectId={currentProjectId || undefined}
                            assessmentId={selectedAssessmentId || undefined}
                        />
                    );
                }
                return null;

            case 'reports': {
                // Get active document if it's a report
                const activeReport = openDocuments.find(
                    doc => doc.id === activeDocumentId && doc.type === 'report'
                );

                // If a report is selected and we're not in list view, show the full Report Builder
                if (activeReport && !showListView) {
                    return (
                        <ReportBuilderWorkspace
                            reportId={activeReport.id}
                            onClose={() => handleCloseDocument(activeReport.id)}
                        />
                    );
                }

                // Otherwise show the table
                return (
                    <ReportsTable
                        projectId={currentProjectId || ''}
                        framework={framework}
                        onCreateInitiatives={handleCreateInitiatives}
                        pendingAssessmentId={selectedAssessmentId}
                        onOpenReport={handleOpenReport}
                    />
                );
            }

            case 'initiatives': {
                // Get active document if it's an initiative
                const activeInitiative = openDocuments.find(
                    doc => doc.id === activeDocumentId && doc.type === 'initiative'
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
                    <InitiativesTable
                        projectId={currentProjectId || ''}
                        framework={framework}
                        pendingReportId={selectedReportId}
                        onOpenInitiative={handleOpenInitiative}
                    />
                );
            }

            default:
                return null;
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-navy-900">
            {/* Framework Header - Compact on mobile */}
            <div className={`shrink-0 bg-gradient-to-r from-slate-50 to-white dark:from-navy-950 dark:to-navy-900 border-b border-slate-200 dark:border-white/10 ${isCompact ? 'px-4 py-3' : 'px-6 py-4'}`}>
                <div className="flex items-center gap-3">
                    <div className={`rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 ${isCompact ? 'w-10 h-10' : 'w-12 h-12'}`}>
                        {React.cloneElement(frameworkConfig.icon as React.ReactElement<{ size?: number }>, { size: isCompact ? 20 : 24 })}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className={`font-bold text-navy-900 dark:text-white truncate ${isCompact ? 'text-lg' : 'text-xl'}`}>{framework}</h1>
                        <p className={`text-slate-500 dark:text-slate-400 truncate ${isCompact ? 'text-xs' : 'text-sm'}`}>{frameworkConfig.name}</p>
                    </div>
                </div>
            </div>

            {/* Top Menu - Horizontal scrollable on mobile/tablet */}
            <div className="shrink-0 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-950">
                <div className={`flex items-center gap-2 overflow-x-auto scrollbar-hide scroll-snap-x momentum-scroll ${isCompact ? 'p-2 px-4' : 'p-2 px-6'}`}>
                    {TABS.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={`
                                    scroll-snap-item touch-target touch-ripple flex items-center justify-center gap-2 
                                    rounded-lg font-medium transition-all whitespace-nowrap shrink-0
                                    ${isCompact
                                        ? 'px-3 py-2.5 text-xs min-w-[90px]'
                                        : 'px-4 py-2 text-sm min-w-[130px]'
                                    }
                                    ${isActive
                                        ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                                        : 'bg-white dark:bg-navy-900 text-slate-600 dark:text-slate-400 active:bg-slate-100 dark:active:bg-white/10 border border-slate-200 dark:border-white/10'
                                    }
                                `}
                            >
                                {React.cloneElement(tab.icon as React.ReactElement<{ size?: number }>, { size: isCompact ? 14 : 16 })}
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Secondary Navigation Bar - always visible for DRD */}
            {framework === 'DRD' && (
                <div className={`shrink-0 bg-slate-100 dark:bg-navy-950/50 border-b border-slate-200 dark:border-white/10 ${isCompact ? 'px-4 py-1' : 'px-6 py-1'} relative`}>
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
                                        rounded-md font-medium transition-all whitespace-nowrap shrink-0
                                        ${isCompact ? 'px-2.5 py-1' : 'px-3 py-1'} text-xs
                                        ${selectedAxis === 'dashboard'
                                            ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20'
                                            : 'bg-white dark:bg-navy-900 text-slate-600 dark:text-slate-400 active:bg-purple-50 dark:active:bg-purple-900/20 border border-slate-200 dark:border-white/10'
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
                                        if (isActive) return 'bg-white/20 text-white';
                                        switch (progressStatus) {
                                            case 'complete':
                                                return 'bg-green-500 text-white';
                                            case 'partial':
                                                return 'bg-yellow-500 text-white';
                                            default:
                                                return 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400';
                                        }
                                    };

                                    return (
                                        <button
                                            key={axis.id}
                                            onClick={() => setSelectedAxis(axis.id)}
                                            className={`
                                                scroll-snap-item touch-target touch-ripple flex items-center gap-1 
                                                rounded-md font-medium transition-all whitespace-nowrap shrink-0
                                                ${isCompact ? 'px-2.5 py-1' : 'px-3 py-1'} text-xs
                                                ${isActive
                                                    ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/20'
                                                    : progressStatus === 'complete'
                                                        ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/30'
                                                        : progressStatus === 'partial'
                                                            ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-500/30'
                                                            : 'bg-white dark:bg-navy-900 text-slate-600 dark:text-slate-400 active:bg-purple-50 dark:active:bg-purple-900/20 border border-slate-200 dark:border-white/10'
                                                }
                                            `}
                                        >
                                            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${getIndicatorClasses()}`}>
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
                            <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                                {/* Assessment tab actions placeholder */}
                            </span>
                        )}
                        {activeTab === 'reports' && (
                            <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                                {/* Reports tab actions placeholder */}
                            </span>
                        )}
                        {activeTab === 'initiatives' && (
                            <span className="text-xs text-slate-400 dark:text-slate-500 italic">
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

            {/* Document Tabs Bar - visible for Reports and Initiatives tabs when documents are open */}
            {(activeTab === 'reports' || activeTab === 'initiatives') && (
                <DocumentTabsBar
                    openDocuments={openDocuments.filter(doc => 
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
                <div className={`shrink-0 bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-white/10 ${isCompact ? 'px-4 py-2' : 'px-6 py-2'}`}>
                    <div className="flex items-center justify-between">
                        {/* Progress Indicator */}
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-500 dark:text-slate-400">Postęp:</span>
                            <div className="w-32 h-2 bg-slate-200 dark:bg-navy-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-purple-500 rounded-full transition-all duration-300"
                                    style={{ width: `${calculateProgress()}%` }}
                                />
                            </div>
                            <span className="text-sm font-medium text-navy-900 dark:text-white">
                                {calculateProgress()}%
                            </span>
                            {hasUnsavedChanges && (
                                <span className="text-xs text-amber-500 dark:text-amber-400 flex items-center gap-1">
                                    <AlertCircle size={12} />
                                    Niezapisane zmiany
                                    <span className="text-slate-400 ml-1">(auto-save za 30s)</span>
                                </span>
                            )}
                            {lastSaved && !hasUnsavedChanges && (
                                <span className="text-xs text-green-500 dark:text-green-400 flex items-center gap-1">
                                    <Check size={12} />
                                    Auto-saved {lastSaved.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                        </div>

                        {/* Save Button & Status */}
                        <div className="flex items-center gap-3">
                            {saveError && (
                                <span className="text-xs text-red-500 dark:text-red-400">
                                    {saveError}
                                </span>
                            )}
                            {lastSaved && !saveError && (
                                <span className="text-xs text-slate-400 dark:text-slate-500">
                                    Zapisano: {lastSaved.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                            {/* Version History Button */}
                            {selectedAssessmentId && (
                                <button
                                    onClick={() => setShowVersionHistory(true)}
                                    className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700 rounded-lg font-medium text-sm transition-colors"
                                    title="Historia wersji"
                                >
                                    <History size={16} />
                                    Historia
                                </button>
                            )}
                            <button
                                onClick={handleSaveAssessment}
                                disabled={isSaving}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all
                                    ${isSaving
                                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                        : hasUnsavedChanges
                                            ? 'bg-green-600 hover:bg-green-500 text-white shadow-md shadow-green-600/20'
                                            : 'bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'
                                    }
                                `}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        Zapisuję...
                                    </>
                                ) : lastSaved && !hasUnsavedChanges ? (
                                    <>
                                        <Check size={16} />
                                        Zapisano
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        Zapisz
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-hidden momentum-scroll">
                {renderContent()}
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
    );
};

