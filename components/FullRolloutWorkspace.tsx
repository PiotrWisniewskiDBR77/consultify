import {
    Activity,
    AlertOctagon,
    BarChart3,
    Calendar,
    CheckCircle2,
    FileText,
    Flag,
    GitBranch,
    Layers,
    Layout,
    Megaphone,
    Shield,
    TrendingUp,
    UserCog,
    Users,
} from 'lucide-react';
import React, { useState } from 'react';

import { FullInitiative, FullSession, Language } from '../types';
import { FullStep5Workspace } from './FullStep5Workspace'; // Reuse Kanban
import { CapacityView, DecisionBoard, StatusReportBuilder } from './Implementation';
import { GateStatus } from './PMO/GateStatus';
import { PMOHealthSection } from './PMO/PMOHealthSection';
import { RACIMatrix } from './PMO/RACIMatrix';
import { WorkstreamBoard } from './PMO/WorkstreamBoard';
import { RolloutChangeTab } from './RolloutChangeTab';
import { RolloutClosureTab } from './RolloutClosureTab';
import { RolloutKPITab } from './RolloutKPITab';
import { RolloutPlanTab } from './RolloutPlanTab';
import { RolloutRisksTab } from './RolloutRisksTab';
import { RolloutStrategyTab } from './RolloutStrategyTab';
import { RolloutTeamsTab } from './RolloutTeamsTab';

interface FullRolloutWorkspaceProps {
    fullSession: FullSession;
    onUpdateInitiative: (initiative: FullInitiative) => void;
    onUpdateSession?: (session: FullSession) => void; // New prop
    onNextStep: () => void;
    language: Language;
    projectId?: string;
}

type RolloutTab =
    | 'dashboard'
    | 'governance'
    | 'workstreams'
    | 'teams'
    | 'capacity'
    | 'plan'
    | 'risks'
    | 'change'
    | 'reports'
    | 'closure';

export const FullRolloutWorkspace: React.FC<FullRolloutWorkspaceProps> = ({
    fullSession,
    onUpdateInitiative,
    onUpdateSession,
    onNextStep,
    language,
    projectId = 'default',
}) => {
    const [activeTab, setActiveTab] = useState<RolloutTab>('dashboard'); // Default to Dashboard (Kanban) which is most used
    const [showChangeModal, setShowChangeModal] = useState(false);

    // Governance Tab - Decisions, Stage Gates, RACI
    const renderGovernance = () => (
        <div className="space-y-8 p-6">
            {/* PMO Health Banner */}
            <PMOHealthSection projectId={projectId} {...({ compact: true } as any)} />

            {/* Stage Gate Status */}
            <div className="bg-navy-900 rounded-xl border border-white/10 p-6">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Shield size={20} className="text-purple-400" />
                    Current Stage Gate
                </h3>
                <GateStatus projectId={projectId} />
            </div>

            {/* Decision Board */}
            <DecisionBoard projectId={projectId} {...({ canApprove: true } as any)} />

            {/* RACI Matrix */}
            <div className="bg-navy-900 rounded-xl border border-white/10 p-6">
                <RACIMatrix projectId={projectId} {...({ compact: false } as any)} />
            </div>
        </div>
    );

    // Workstreams Tab
    const renderWorkstreams = () => (
        <div className="p-6">
            <WorkstreamBoard projectId={projectId} canManage={true} />
        </div>
    );

    const renderTeams = () => (
        <RolloutTeamsTab
            data={fullSession.rollout || {}}
            onUpdate={(updatedData) => {
                if (onUpdateSession) {
                    onUpdateSession({
                        ...fullSession,
                        rollout: { ...fullSession.rollout, ...updatedData },
                    });
                }
            }}
        />
    );

    // Capacity Planning Tab
    const renderCapacity = () => (
        <div className="p-6">
            <CapacityView projectId={projectId} />
        </div>
    );

    const renderPlan = () => (
        <RolloutPlanTab
            data={fullSession.rollout || {}}
            initiatives={fullSession.initiatives}
            onUpdate={(updatedData) => {
                if (onUpdateSession) {
                    onUpdateSession({
                        ...fullSession,
                        rollout: { ...fullSession.rollout, ...updatedData },
                    });
                }
            }}
        />
    );

    const renderDashboard = () => (
        <div className="h-full flex flex-col">
            {/* Reusing existing Kanban Workspace */}
            <FullStep5Workspace
                fullSession={fullSession}
                onUpdateInitiative={onUpdateInitiative}
                onNextStep={onNextStep}
            />
        </div>
    );

    const renderRisks = () => (
        <RolloutRisksTab
            data={fullSession.rollout || {}}
            initiatives={fullSession.initiatives}
            onUpdate={(updatedData) => {
                if (onUpdateSession) {
                    onUpdateSession({
                        ...fullSession,
                        rollout: { ...fullSession.rollout, ...updatedData },
                    });
                }
            }}
        />
    );

    const renderChange = () => (
        <RolloutChangeTab
            data={fullSession.rollout || {}}
            onUpdate={(updatedData) => {
                if (onUpdateSession) {
                    onUpdateSession({
                        ...fullSession,
                        rollout: { ...fullSession.rollout, ...updatedData },
                    });
                }
            }}
        />
    );

    // Status Reports Tab
    const renderReports = () => (
        <div className="p-6">
            <StatusReportBuilder
                projectId={projectId}
                {...({ projectName: (fullSession.rollout as any)?.projectName || 'Digital Transformation' } as any)}
            />
        </div>
    );

    const renderClosure = () => (
        <RolloutClosureTab
            data={fullSession.rollout || {}}
            onUpdate={(updatedData) => {
                if (onUpdateSession) {
                    onUpdateSession({
                        ...fullSession,
                        rollout: { ...fullSession.rollout, ...updatedData },
                    });
                }
            }}
            onCloseProgram={() => {
                if (onUpdateSession) {
                    onUpdateSession({
                        ...fullSession,
                        rollout: {
                            ...fullSession.rollout,
                            closure: {
                                checklist: [],
                                lessonsLearned: [],
                                ...fullSession.rollout?.closure,
                                isClosed: true,
                                closedAt: new Date().toISOString(),
                            },
                        },
                    });
                }
            }}
        />
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return renderDashboard();
            case 'governance':
                return renderGovernance();
            case 'workstreams':
                return renderWorkstreams();
            case 'teams':
                return renderTeams();
            case 'capacity':
                return renderCapacity();
            case 'plan':
                return renderPlan();
            case 'risks':
                return renderRisks();
            case 'change':
                return renderChange();
            case 'reports':
                return renderReports();
            case 'closure':
                return renderClosure();
            default:
                return null;
        }
    };

    return (
        <div className="flex flex-col h-full bg-navy-950 text-white">
            {/* Header */}
            <div className="h-16 border-b border-white/10 px-6 flex items-center justify-between bg-navy-900/50 backdrop-blur-sm sticky top-0 z-10">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <CheckCircle2 className="text-purple-500" size={24} />
                    Implementation - Full PMO
                </h1>
                <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">
                        ISO 21500 | PMBOK 7 | PRINCE2
                    </span>
                </div>
            </div>

            {/* Navigation Tabs (Scrollable) - Reorganized for Full PMO */}
            <div className="flex border-b border-white/10 px-6 gap-6 mt-2 overflow-x-auto scrollbar-thin scrollbar-thumb-white/10">
                {[
                    { id: 'dashboard', label: 'Dashboard', icon: Activity, group: 'delivery' },
                    { id: 'governance', label: 'Governance', icon: Shield, group: 'governance' },
                    { id: 'workstreams', label: 'Workstreams', icon: Layers, group: 'delivery' },
                    { id: 'teams', label: 'Teams', icon: Users, group: 'resources' },
                    { id: 'capacity', label: 'Capacity', icon: UserCog, group: 'resources' },
                    { id: 'plan', label: 'Plan', icon: Calendar, group: 'delivery' },
                    { id: 'risks', label: 'Risks', icon: AlertOctagon, group: 'monitoring' },
                    { id: 'change', label: 'Changes', icon: GitBranch, group: 'governance' },
                    { id: 'reports', label: 'Reports', icon: BarChart3, group: 'monitoring' },
                    { id: 'closure', label: 'Closure', icon: Flag, group: 'governance' },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as RolloutTab)}
                        className={`pb-3 flex items-center gap-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === tab.id ? 'border-purple-500 text-purple-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden bg-navy-950 relative">
                {/* For Dashboard, we want full height without padding if possible, or handle inside */}
                <div className={`h-full ${activeTab === 'dashboard' ? '' : 'p-6 overflow-y-auto'}`}>
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};
