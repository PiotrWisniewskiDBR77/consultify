import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, FileText, Layout, Lightbulb, TrendingUp, ShieldAlert, Target } from 'lucide-react';
import { CompanyProfileModule } from './modules/CompanyProfileModule';
import { GoalsExpectationsModule } from './modules/GoalsExpectationsModule';
import { ChallengeMapModule } from './modules/ChallengeMapModule';
import { MegatrendScannerModule } from './modules/MegatrendScannerModule';
import { StrategicSynthesisModule } from './modules/StrategicSynthesisModule';

interface ContextBuilderProps {
    initialTab?: number;
}

export const ContextBuilderView: React.FC<ContextBuilderProps> = ({ initialTab = 1 }) => {
    const { t } = useTranslation();
    const [activeModule, setActiveModule] = useState<number>(initialTab);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    // Update active module if prop changes (e.g. navigation from sidebar)
    React.useEffect(() => {
        setActiveModule(initialTab);
    }, [initialTab]);

    const renderActiveModule = () => {
        switch (activeModule) {
            case 1: return <CompanyProfileModule />;
            case 2: return <GoalsExpectationsModule />;
            case 3: return <ChallengeMapModule />;
            case 4: return <MegatrendScannerModule />;
            case 5: return <StrategicSynthesisModule />;
            default: return (
                <div className="mt-8 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-12 text-center">
                    <Layout className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-navy-900 dark:text-white">Module {activeModule} Under Construction</h3>
                    <p className="text-slate-500 text-sm mt-1">This module is part of the planned roadmap.</p>
                </div>
            );
        }
    };

    return (
        <div className="flex h-full w-full bg-slate-50 dark:bg-navy-950 overflow-hidden relative">
            {/* Left Panel: AI Consultant Chat */}
            <div className="w-1/3 min-w-[320px] max-w-[450px] border-r border-slate-200 dark:border-white/10 flex flex-col bg-white dark:bg-navy-900 z-10">
                <div className="h-14 border-b border-slate-200 dark:border-white/10 flex items-center px-4 bg-white dark:bg-navy-900">
                    <MessageSquare className="w-5 h-5 text-purple-600 mr-2" />
                    <span className="font-semibold text-navy-900 dark:text-white">AI Strategy Consultant</span>
                </div>
                <div className="flex-1 p-4 overflow-y-auto">
                    {/* Chat Placeholder */}
                    <div className="flex flex-col gap-4">
                        <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg rounded-tl-none self-start max-w-[85%]">
                            <p className="text-sm text-navy-800 dark:text-slate-200">
                                Hello! I am ready to help you build the strategic context. Which module should we start with?
                            </p>
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900">
                    <input
                        type="text"
                        placeholder="Type your message..."
                        className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-navy-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                </div>
            </div>

            {/* Right Panel: Workbench */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-navy-950 relative">

                {/* Top Module Selector REMOVED - Navigation moved to Sidebar */}
                {/* 
                <div className="h-16 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900 flex items-center px-4 gap-2 overflow-x-auto no-scrollbar">
                   ... removed ...
                </div> 
                */}

                {/* Main Content Area (Tabs + Active View) */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10">
                    <div className="max-w-6xl mx-auto">
                        <div className="mb-6">
                            <h1 className="text-2xl font-bold text-navy-900 dark:text-white">
                                {activeModule === 1 && 'Company Profile'}
                                {activeModule === 2 && 'Goals & Expectations'}
                                {activeModule === 3 && 'Challenge Map'}
                                {activeModule === 4 && 'Megatrend Scanner'}
                                {activeModule === 5 && 'Strategic Synthesis'}
                            </h1>
                            <p className="text-slate-500 dark:text-slate-400">
                                {activeModule === 1 && 'Define the "as-is" state of the organization.'}
                                {activeModule === 2 && 'Set strategic objectives and success metrics.'}
                                {activeModule === 3 && 'Map operational pain points and root causes.'}
                                {activeModule === 4 && 'Analyze external trends and pressures.'}
                                {activeModule === 5 && 'Synthesize findings into a strategic roadmap.'}
                            </p>
                        </div>

                        {renderActiveModule()}
                    </div>
                </div>

                {/* Document Hub Toggle / Drawer */}
                <div className={`absolute top-0 right-0 h-full bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-white/10 shadow-xl transition-all duration-300 z-20 ${isSidebarOpen ? 'w-80 translate-x-0' : 'w-0 translate-x-full'}`}>
                    <div className="h-full flex flex-col">
                        <div className="h-14 border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-4">
                            <div className="flex items-center gap-2 font-semibold text-sm text-navy-900 dark:text-white">
                                <FileText size={16} className="text-blue-500" />
                                Document Hub
                            </div>
                            <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-navy-900">
                                {/* Close Icon */}
                                <span className="text-xl">&times;</span>
                            </button>
                        </div>
                        <div className="flex-1 p-4 overflow-y-auto">
                            <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg p-6 text-center hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer">
                                <p className="text-xs text-slate-500">Drag & Drop documents here</p>
                            </div>

                            <div className="mt-6">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Processed Files</h4>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-100 dark:border-white/5">
                                        <div className="w-8 h-8 rounded bg-red-100 flex items-center justify-center text-red-500 text-xs font-bold">PDF</div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-navy-900 dark:text-white truncate">Annual Report 2024.pdf</div>
                                            <div className="text-[10px] text-green-600">Processed • 12 key facts</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Toggle Button for Doc Hub (visible when closed) */}
                {!isSidebarOpen && (
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="absolute right-0 top-20 bg-white dark:bg-navy-800 border-l border-t border-b border-slate-200 dark:border-white/10 p-2 rounded-l-lg shadow-md z-10 text-slate-500 hover:text-blue-600"
                    >
                        <FileText size={20} />
                    </button>
                )}

            </div>
        </div>
    );
};
