/**
 * AssessmentModuleLayout
 * Main layout component for Assessment Module with 5 tabs
 */

import React from 'react';
import { 
    LayoutDashboard, 
    FileText, 
    Eye, 
    BarChart3, 
    FileOutput,
    Sparkles
} from 'lucide-react';
import { AssessmentTab } from '../../types';

interface AssessmentModuleLayoutProps {
    activeTab: AssessmentTab;
    onTabChange: (tab: AssessmentTab) => void;
    children: React.ReactNode;
    showGenerateButton?: boolean;
    onGenerateClick?: () => void;
}

interface TabConfig {
    id: AssessmentTab;
    label: string;
    icon: React.ReactNode;
    description: string;
}

const TABS: TabConfig[] = [
    {
        id: 'dashboard',
        label: 'Dashboard',
        icon: <LayoutDashboard size={18} />,
        description: 'Overview and quick actions'
    },
    {
        id: 'assessments',
        label: 'My Assessments',
        icon: <FileText size={18} />,
        description: 'All your assessments'
    },
    {
        id: 'reviews',
        label: 'Reviews',
        icon: <Eye size={18} />,
        description: 'Pending reviews'
    },
    {
        id: 'gap-map',
        label: 'Gap Map',
        icon: <BarChart3 size={18} />,
        description: 'Gap analysis'
    },
    {
        id: 'reports',
        label: 'Reports',
        icon: <FileOutput size={18} />,
        description: 'Reports archive'
    }
];

export const AssessmentModuleLayout: React.FC<AssessmentModuleLayoutProps> = ({
    activeTab,
    onTabChange,
    children,
    showGenerateButton = false,
    onGenerateClick
}) => {
    return (
        <div className="flex flex-col h-full bg-white dark:bg-navy-900">
            {/* Tab Navigation Header */}
            <div className="shrink-0 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900">
                <div className="flex items-center justify-between px-6">
                    {/* Tabs */}
                    <div className="flex items-center gap-1">
                        {TABS.map((tab) => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => onTabChange(tab.id)}
                                    className={`
                                        flex items-center gap-2 px-4 py-4 border-b-2 transition-all
                                        ${isActive 
                                            ? 'border-purple-600 text-purple-600 dark:text-purple-400' 
                                            : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                                        }
                                    `}
                                    title={tab.description}
                                >
                                    <span className={isActive ? 'text-purple-600 dark:text-purple-400' : ''}>
                                        {tab.icon}
                                    </span>
                                    <span className="font-medium text-sm">{tab.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Generate Initiatives Button */}
                    {showGenerateButton && onGenerateClick && (
                        <button
                            onClick={onGenerateClick}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-500 hover:to-emerald-400 text-white rounded-lg text-sm font-semibold shadow-lg shadow-green-900/20 transition-all"
                        >
                            <Sparkles size={16} />
                            Generate Initiatives
                        </button>
                    )}
                </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
                {children}
            </div>
        </div>
    );
};

export default AssessmentModuleLayout;

