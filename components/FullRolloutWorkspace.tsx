import React, { useState } from 'react';
import { FullSession, FullInitiative, Language } from '../types';
import { translations } from '../translations';
import {
    Layout, Users, Calendar, Activity,
    AlertOctagon, Megaphone, TrendingUp, Flag,
    CheckCircle2
} from 'lucide-react';
import { FullStep5Workspace } from './FullStep5Workspace'; // Reuse Kanban

interface FullRolloutWorkspaceProps {
    fullSession: FullSession;
    onUpdateInitiative: (initiative: FullInitiative) => void;
    onNextStep: () => void;
    language: Language;
}

type RolloutTab = 'strategy' | 'teams' | 'plan' | 'dashboard' | 'risks' | 'change' | 'kpi' | 'closure';

export const FullRolloutWorkspace: React.FC<FullRolloutWorkspaceProps> = ({
    fullSession,
    onUpdateInitiative,
    onNextStep,
    language
}) => {
    const [activeTab, setActiveTab] = useState<RolloutTab>('dashboard'); // Default to Dashboard (Kanban) which is most used

    // Placeholders for PRO MAX tabs
    const renderStrategy = () => (
        <div className="p-8 text-center bg-white dark:bg-navy-900 rounded-xl border border-white/5">
            <Layout className="w-16 h-16 mx-auto text-purple-500 mb-4" />
            <h3 className="text-xl font-bold mb-2">Rollout Scope & Strategy</h3>
            <p className="text-slate-500">Master definition of the transformation program boundaries and strategic pillars.</p>
            {/* Add editable fields for Strategy Summary, Program Goals etc. */}
        </div>
    );

    const renderTeams = () => (
        <div className="p-8 text-center bg-white dark:bg-navy-900 rounded-xl border border-white/5">
            <Users className="w-16 h-16 mx-auto text-blue-500 mb-4" />
            <h3 className="text-xl font-bold mb-2">Workstreams & Teams</h3>
            <p className="text-slate-500">Organizational structure for the rollout: SteerCo, PMO, Stream Leads.</p>
        </div>
    );

    const renderPlan = () => (
        <div className="p-8 text-center bg-white dark:bg-navy-900 rounded-xl border border-white/5">
            <Calendar className="w-16 h-16 mx-auto text-pink-500 mb-4" />
            <h3 className="text-xl font-bold mb-2">Master Rollout Plan</h3>
            <p className="text-slate-500">Gantt Chart view of all initiatives and major phases (Wave 1, 2, 3).</p>
        </div>
    );

    const renderDashboard = () => (
        <div className="h-full flex flex-col">
            {/* Reusing existing Kanban Workspace */}
            <FullStep5Workspace
                fullSession={fullSession}
                onUpdateInitiative={onUpdateInitiative}
                onNextStep={onNextStep}
                language={language}
            />
        </div>
    );

    const renderRisks = () => (
        <div className="p-8 text-center bg-white dark:bg-navy-900 rounded-xl border border-white/5">
            <AlertOctagon className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <h3 className="text-xl font-bold mb-2">Risk & Issues Management</h3>
            <p className="text-slate-500">RAID Log (Risks, Assumptions, Issues, Dependencies).</p>
        </div>
    );

    const renderChange = () => (
        <div className="p-8 text-center bg-white dark:bg-navy-900 rounded-xl border border-white/5">
            <Megaphone className="w-16 h-16 mx-auto text-yellow-500 mb-4" />
            <h3 className="text-xl font-bold mb-2">Change Management Hub</h3>
            <p className="text-slate-500">Communication plans, stakeholder engagement, and training materials.</p>
        </div>
    );

    const renderKPI = () => (
        <div className="p-8 text-center bg-white dark:bg-navy-900 rounded-xl border border-white/5">
            <TrendingUp className="w-16 h-16 mx-auto text-green-500 mb-4" />
            <h3 className="text-xl font-bold mb-2">KPI Tracking</h3>
            <p className="text-slate-500">Operational and Financial performance versus targets.</p>
        </div>
    );

    const renderClosure = () => (
        <div className="p-8 text-center bg-white dark:bg-navy-900 rounded-xl border border-white/5">
            <Flag className="w-16 h-16 mx-auto text-slate-500 mb-4" />
            <h3 className="text-xl font-bold mb-2">Rollout Review & Closure</h3>
            <p className="text-slate-500">Lessons learned, final approvals, and handover to operations.</p>
        </div>
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
