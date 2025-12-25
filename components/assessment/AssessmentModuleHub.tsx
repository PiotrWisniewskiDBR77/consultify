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

import React, { useState, useCallback } from 'react';
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
    LayoutDashboard
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
import { DRDAxis } from '../../types';

// Type for axis selection including dashboard
type AxisSelection = 'dashboard' | DRDAxis;

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
                        framework={framework}
                        onOpenInMap={handleOpenInMap}
                        onNewAssessment={handleNewAssessment}
                        onCreateReport={handleCreateReport}
                    />
                );

            case 'map':
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
                        />
                    );
                }
                return null;

            case 'reports':
                return (
                    <ReportsTable
                        projectId={currentProjectId || ''}
                        framework={framework}
                        onCreateInitiatives={handleCreateInitiatives}
                        pendingAssessmentId={selectedAssessmentId}
                    />
                );

            case 'initiatives':
                return (
                    <InitiativesTable
                        projectId={currentProjectId || ''}
                        framework={framework}
                        pendingReportId={selectedReportId}
                    />
                );

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
                                onClick={() => setActiveTab(tab.id)}
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

            {/* DRD Axes Navigation Bar - visible on ALL tabs */}
            {framework === 'DRD' && (
                <div className={`shrink-0 bg-slate-100 dark:bg-navy-950/50 border-b border-slate-200 dark:border-white/10 ${isCompact ? 'px-4 py-1.5' : 'px-6 py-1.5'}`}>
                    <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide scroll-snap-x momentum-scroll">
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
                                            : 'bg-white dark:bg-navy-900 text-slate-600 dark:text-slate-400 active:bg-purple-50 dark:active:bg-purple-900/20 border border-slate-200 dark:border-white/10'
                                        }
                                    `}
                                >
                                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${isActive
                                        ? 'bg-white/20 text-white'
                                        : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                                        }`}>
                                        {index + 1}
                                    </span>
                                    {isCompact ? axis.label.slice(0, 3) : axis.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Content Area */}
            <div className="flex-1 overflow-hidden momentum-scroll">
                {renderContent()}
            </div>
        </div>
    );
};

export default AssessmentModuleHub;

