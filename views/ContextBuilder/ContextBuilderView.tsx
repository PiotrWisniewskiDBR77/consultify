import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, FileText, Layout, Lightbulb, TrendingUp, ShieldAlert, Target } from 'lucide-react';
import { CompanyProfileModule } from './modules/CompanyProfileModule';
import { GoalsExpectationsModule } from './modules/GoalsExpectationsModule';
import { ChallengeMapModule } from './modules/ChallengeMapModule';
import { MegatrendScannerModule } from './modules/MegatrendScannerModule';
import { StrategicSynthesisModule } from './modules/StrategicSynthesisModule';
import { SplitLayout } from '../../components/SplitLayout';

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
            <SplitLayout>
                {/* Main Content Area (Tabs + Active View) */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10 h-full">
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
            </SplitLayout>
        </div>
    );
};
