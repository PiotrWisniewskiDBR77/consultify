import React, { useState } from 'react';
import { FullSession, FullInitiative, Language } from '../types';
import {
    Layout, Users, Calendar, Activity,
    AlertOctagon, Megaphone, TrendingUp, Flag,
    CheckCircle2
} from 'lucide-react';
import { FullStep5Workspace } from './FullStep5Workspace'; // Reuse Kanban
import { RolloutStrategyTab } from './RolloutStrategyTab';
import { RolloutTeamsTab } from './RolloutTeamsTab';
import { RolloutPlanTab } from './RolloutPlanTab';
import { RolloutRisksTab } from './RolloutRisksTab';
import { RolloutChangeTab } from './RolloutChangeTab';
import { RolloutKPITab } from './RolloutKPITab';
import { RolloutClosureTab } from './RolloutClosureTab';

interface FullRolloutWorkspaceProps {
    fullSession: FullSession;
    onUpdateInitiative: (initiative: FullInitiative) => void;
    onUpdateSession?: (session: FullSession) => void; // New prop
    onNextStep: () => void;
    language: Language;
}

type RolloutTab = 'strategy' | 'teams' | 'plan' | 'dashboard' | 'risks' | 'change' | 'kpi' | 'closure';

export const FullRolloutWorkspace: React.FC<FullRolloutWorkspaceProps> = ({
    fullSession,
    onUpdateInitiative,
    onUpdateSession,
    onNextStep,
    language
}) => {
    const [activeTab, setActiveTab] = useState<RolloutTab>('dashboard'); // Default to Dashboard (Kanban) which is most used

    // Placeholders for PRO MAX tabs
    const renderStrategy = () => (
        <RolloutStrategyTab
            data={fullSession.rollout || {}}
            onUpdate={(updatedData) => {
                if (onUpdateSession) {
                    onUpdateSession({
                        ...fullSession,
                        rollout: { ...fullSession.rollout, ...updatedData }
                    });
                }
            }}
            isAdmin={true}
        />
    );

    const renderTeams = () => (
        <RolloutTeamsTab
            data={fullSession.rollout || {}}
            onUpdate={(updatedData) => {
                if (onUpdateSession) {
                    onUpdateSession({
                        ...fullSession,
                        rollout: { ...fullSession.rollout, ...updatedData }
                    });
                }
            }}
        />
    );

    const renderPlan = () => (
        <RolloutPlanTab
            data={fullSession.rollout || {}}
            initiatives={fullSession.initiatives}
            onUpdate={(updatedData) => {
                if (onUpdateSession) {
                    onUpdateSession({
                        ...fullSession,
                        rollout: { ...fullSession.rollout, ...updatedData }
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
                        rollout: { ...fullSession.rollout, ...updatedData }
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
                        rollout: { ...fullSession.rollout, ...updatedData }
                    });
                }
            }}
        />
    );

    const renderKPI = () => (
        <RolloutKPITab
            data={fullSession.rollout || {}}
            onUpdate={(updatedData) => {
                if (onUpdateSession) {
                    onUpdateSession({
                        ...fullSession,
                        rollout: { ...fullSession.rollout, ...updatedData }
                    });
                }
            }}
        />
    );

    const renderClosure = () => (
        <RolloutClosureTab
            data={fullSession.rollout || {}}
            onUpdate={(updatedData) => {
                if (onUpdateSession) {
                    onUpdateSession({
                        ...fullSession,
                        rollout: { ...fullSession.rollout, ...updatedData }
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
                                closedAt: new Date().toISOString()
                            }
                        }
                    });
                }
            }}
        />
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'strategy': return renderStrategy();
            case 'teams': return renderTeams();
            case 'plan': return renderPlan();
            case 'dashboard': return renderDashboard();
            case 'risks': return renderRisks();
            case 'change': return renderChange();
            case 'kpi': return renderKPI();
            case 'closure': return renderClosure();
            default: return null;
        }
    };

    return (
        <div className="flex flex-col h-full bg-navy-950 text-white">
            {/* Header */}
            <div className="h-16 border-b border-white/10 px-6 flex items-center justify-between bg-navy-900/50 backdrop-blur-sm sticky top-0 z-10">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <CheckCircle2 className="text-green-500" size={24} />
                    Full Rollout Execution
                </h1>
                <a href="#" onClick={(e) => { e.preventDefault(); /* Would trigger navigation if I had access to router, but here I only have props */ }} className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    Open My Work &rarr;
                </a>
            </div>

            {/* Navigation Tabs (Scrollable) */}
            <div className="flex border-b border-white/10 px-6 gap-6 mt-2 overflow-x-auto scrollbar-thin scrollbar-thumb-white/10">
                {[
                    { id: 'strategy', label: '5.1 Strategy', icon: Layout },
                    { id: 'teams', label: '5.2 Teams', icon: Users },
                    { id: 'plan', label: '5.3 Plan', icon: Calendar },
                    { id: 'dashboard', label: '5.4 Dashboard', icon: Activity },
                    { id: 'risks', label: '5.5 Risks', icon: AlertOctagon },
                    { id: 'change', label: '5.6 Change', icon: Megaphone },
                    { id: 'kpi', label: '5.7 KPIs', icon: TrendingUp },
                    { id: 'closure', label: '5.8 Closure', icon: Flag },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as RolloutTab)}
                        className={`pb-3 flex items-center gap-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === tab.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'}`}
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
