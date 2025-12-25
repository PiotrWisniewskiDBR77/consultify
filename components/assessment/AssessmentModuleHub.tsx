/**
 * AssessmentModuleHub
 * 
 * Main hub component for Assessment Module with 4-button top menu:
 * 1. Assessment - Table of assessments (done/in progress/new)
 * 2. Map - DRD assessment editor tool
 * 3. Reports - Table of reports (created from approved assessments)
 * 4. Initiatives - Table of initiatives (created from approved reports)
 * 
 * Each button changes the contextual second-level menu/content area.
 */

import React, { useState, useCallback } from 'react';
import {
    FileText,
    Map,
    FileOutput,
    Lightbulb,
    Plus,
    ArrowRight
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';

// Sub-components
import { AssessmentTable } from './AssessmentTable';
import { ReportsTable } from './ReportsTable';
import { InitiativesTable } from './InitiativesTable';

export type HubTab = 'assessment' | 'map' | 'reports' | 'initiatives';

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
        icon: <FileText size={20} />,
        description: 'Manage your assessments'
    },
    {
        id: 'map',
        label: 'Map',
        icon: <Map size={20} />,
        description: 'DRD Assessment Editor'
    },
    {
        id: 'reports',
        label: 'Reports',
        icon: <FileOutput size={20} />,
        description: 'Assessment reports'
    },
    {
        id: 'initiatives',
        label: 'Initiatives',
        icon: <Lightbulb size={20} />,
        description: 'Transformation initiatives'
    }
];

interface AssessmentModuleHubProps {
    initialTab?: HubTab;
    initialAssessmentId?: string;
    onNavigate?: (view: AppView, params?: any) => void;
}

export const AssessmentModuleHub: React.FC<AssessmentModuleHubProps> = ({
    initialTab = 'assessment',
    initialAssessmentId,
    onNavigate
}) => {
    const { currentProjectId, setCurrentView } = useAppStore();
    
    // State
    const [activeTab, setActiveTab] = useState<HubTab>(initialTab);
    const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(initialAssessmentId || null);
    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

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

    // Render content based on active tab
    const renderContent = () => {
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
                // Map shows DRD editor - this will navigate to the axis workspace
                return (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                            <Map className="w-16 h-16 text-purple-500 mx-auto mb-4" />
                            <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-2">
                                DRD Assessment Map
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-md">
                                {selectedAssessmentId 
                                    ? 'Opening assessment editor...' 
                                    : 'Select an assessment from the list or create a new one'
                                }
                            </p>
                            {!selectedAssessmentId && (
                                <button
                                    onClick={handleNewAssessment}
                                    className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg mx-auto transition-colors"
                                >
                                    <Plus size={18} />
                                    Start New Assessment
                                </button>
                            )}
                        </div>
                    </div>
                );
            
            case 'reports':
                return (
                    <ReportsTable
                        projectId={currentProjectId || ''}
                        onCreateInitiatives={handleCreateInitiatives}
                        pendingAssessmentId={selectedAssessmentId}
                    />
                );
            
            case 'initiatives':
                return (
                    <InitiativesTable
                        projectId={currentProjectId || ''}
                        pendingReportId={selectedReportId}
                    />
                );
            
            default:
                return null;
        }
    };

    return (
        <div className="flex flex-col h-full bg-white dark:bg-navy-900">
            {/* Top Menu - 4 Buttons */}
            <div className="shrink-0 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-950">
                <div className="flex items-center justify-center gap-2 p-3">
                    {TABS.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`
                                    flex items-center gap-3 px-6 py-3 rounded-xl font-medium transition-all
                                    ${isActive 
                                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25' 
                                        : 'bg-white dark:bg-navy-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10'
                                    }
                                `}
                            >
                                {tab.icon}
                                <span>{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Workflow Progress Indicator */}
            <div className="shrink-0 px-6 py-2 bg-slate-100 dark:bg-navy-950/50 border-b border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-center gap-4 text-xs">
                    <div className={`flex items-center gap-1 ${activeTab === 'assessment' ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-slate-400'}`}>
                        <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">1</span>
                        Assessment
                    </div>
                    <ArrowRight className="text-slate-300 dark:text-slate-600" size={14} />
                    <div className={`flex items-center gap-1 ${activeTab === 'map' ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-slate-400'}`}>
                        <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">2</span>
                        Map (Edit)
                    </div>
                    <ArrowRight className="text-slate-300 dark:text-slate-600" size={14} />
                    <div className={`flex items-center gap-1 ${activeTab === 'reports' ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-slate-400'}`}>
                        <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">3</span>
                        Reports
                    </div>
                    <ArrowRight className="text-slate-300 dark:text-slate-600" size={14} />
                    <div className={`flex items-center gap-1 ${activeTab === 'initiatives' ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-slate-400'}`}>
                        <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">4</span>
                        Initiatives
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden">
                {renderContent()}
            </div>
        </div>
    );
};

export default AssessmentModuleHub;

