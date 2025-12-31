/**
 * ToolsMenu
 * 
 * Dropdown menu for AI tools and integrations:
 * - AI Modes (Deep Research, Web Search, Show Reasoning)
 * - PMO Tools (Start Assessment, Generate Initiatives, etc.)
 * - Connections (Connectors, Knowledge Bases)
 */

import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
    Brain, 
    Search, 
    Globe, 
    Sparkles,
    Target,
    Lightbulb,
    Calculator,
    FileText,
    Plug,
    BookOpen,
    ToggleLeft,
    ToggleRight,
    ExternalLink
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { AppView } from '../../types';

interface ToolsMenuProps {
    onToolSelect: (tool: string) => void;
    disabled?: boolean;
    icon?: React.ElementType;
}

interface ToolMode {
    id: string;
    icon: React.ElementType;
    labelKey: string;
    label: string;
    toggle: boolean;
    enabled?: boolean;
}

interface PmoTool {
    id: string;
    icon: React.ElementType;
    labelKey: string;
    label: string;
    view: AppView;
}

export const ToolsMenu: React.FC<ToolsMenuProps> = ({
    onToolSelect,
    disabled = false,
    icon: IconComponent = Brain
}) => {
    const { t } = useTranslation();
    const { setCurrentView, aiConfig, setAIConfig } = useAppStore();
    const [isOpen, setIsOpen] = useState(false);
    const [modes, setModes] = useState({
        deepResearch: false,
        webSearch: false,
        showReasoning: aiConfig.maxMode
    });
    const menuRef = useRef<HTMLDivElement>(null);

    // AI Modes
    const AI_MODES: ToolMode[] = [
        { 
            id: 'deepResearch', 
            icon: Search, 
            labelKey: 'aiChat.menu.deepResearch', 
            label: 'Deep Research',
            toggle: true,
            enabled: modes.deepResearch
        },
        { 
            id: 'webSearch', 
            icon: Globe, 
            labelKey: 'aiChat.menu.webSearch', 
            label: 'Web Search',
            toggle: true,
            enabled: modes.webSearch
        },
        { 
            id: 'showReasoning', 
            icon: Sparkles, 
            labelKey: 'aiChat.menu.showReasoning', 
            label: 'Show Reasoning',
            toggle: true,
            enabled: modes.showReasoning
        }
    ];

    // PMO Tools
    const PMO_TOOLS: PmoTool[] = [
        { 
            id: 'start-assessment', 
            icon: Target, 
            labelKey: 'aiChat.menu.startAssessment', 
            label: 'Start Assessment',
            view: AppView.ASSESSMENT_OVERVIEW
        },
        { 
            id: 'generate-initiatives', 
            icon: Lightbulb, 
            labelKey: 'aiChat.menu.generateInitiatives', 
            label: 'Generate Initiatives',
            view: AppView.INITIATIVE_GENERATOR
        },
        { 
            id: 'calculate-roi', 
            icon: Calculator, 
            labelKey: 'aiChat.menu.calculateRoi', 
            label: 'Calculate ROI',
            view: AppView.ECONOMICS
        },
        { 
            id: 'build-report', 
            icon: FileText, 
            labelKey: 'aiChat.menu.buildReport', 
            label: 'Build Report',
            view: AppView.FULL_STEP6_REPORTS
        }
    ];

    // Handle click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const toggleMode = (modeId: string) => {
        setModes(prev => {
            const newModes = { ...prev, [modeId]: !prev[modeId as keyof typeof prev] };
            
            // Sync showReasoning with MAX Mode
            if (modeId === 'showReasoning') {
                setAIConfig({ maxMode: newModes.showReasoning });
            }
            
            return newModes;
        });
        onToolSelect(`toggle:${modeId}`);
    };

    const handlePmoTool = (tool: PmoTool) => {
        setCurrentView(tool.view);
        setIsOpen(false);
        onToolSelect(`pmo:${tool.id}`);
    };

    return (
        <div className="relative" ref={menuRef}>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled}
                className={`
                    p-2 rounded-lg transition-colors
                    ${Object.values(modes).some(v => v)
                        ? 'text-primary-500 bg-primary-50 dark:bg-primary-900/30'
                        : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                    }
                    ${disabled ? 'cursor-not-allowed opacity-50' : ''}
                `}
                title={t('aiChat.menu.tools', 'Tools & Integrations')}
            >
                <IconComponent size={20} />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="
                    absolute left-0 bottom-full mb-2 z-50
                    w-64 py-1
                    bg-white dark:bg-navy-800
                    border border-slate-200 dark:border-navy-700
                    rounded-xl shadow-xl
                    animate-in fade-in-0 slide-in-from-bottom-2 duration-150
                ">
                    {/* AI Modes Section */}
                    <div className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {t('aiChat.menu.aiModes', 'AI Modes')}
                    </div>

                    {AI_MODES.map(mode => {
                        const Icon = mode.icon;
                        const isEnabled = modes[mode.id as keyof typeof modes];
                        
                        return (
                            <button
                                key={mode.id}
                                onClick={() => toggleMode(mode.id)}
                                className="
                                    w-full flex items-center justify-between px-3 py-2 text-sm
                                    text-slate-700 dark:text-slate-300
                                    hover:bg-slate-100 dark:hover:bg-navy-700
                                    transition-colors
                                "
                            >
                                <div className="flex items-center gap-3">
                                    <Icon size={16} className={isEnabled ? 'text-primary-500' : 'text-slate-400'} />
                                    {t(mode.labelKey, mode.label)}
                                </div>
                                {isEnabled ? (
                                    <ToggleRight size={20} className="text-primary-500" />
                                ) : (
                                    <ToggleLeft size={20} className="text-slate-300 dark:text-slate-600" />
                                )}
                            </button>
                        );
                    })}

                    {/* Divider */}
                    <div className="my-1 border-t border-slate-200 dark:border-navy-700" />

                    {/* PMO Tools Section */}
                    <div className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {t('aiChat.menu.pmoTools', 'PMO Tools')}
                    </div>

                    {PMO_TOOLS.map(tool => {
                        const Icon = tool.icon;
                        
                        return (
                            <button
                                key={tool.id}
                                onClick={() => handlePmoTool(tool)}
                                className="
                                    w-full flex items-center justify-between px-3 py-2 text-sm
                                    text-slate-700 dark:text-slate-300
                                    hover:bg-slate-100 dark:hover:bg-navy-700
                                    transition-colors
                                "
                            >
                                <div className="flex items-center gap-3">
                                    <Icon size={16} className="text-primary-500" />
                                    {t(tool.labelKey, tool.label)}
                                </div>
                                <ExternalLink size={14} className="text-slate-400" />
                            </button>
                        );
                    })}

                    {/* Divider */}
                    <div className="my-1 border-t border-slate-200 dark:border-navy-700" />

                    {/* Connections Section */}
                    <div className="px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {t('aiChat.menu.connections', 'Connections')}
                    </div>

                    <button
                        onClick={() => {
                            onToolSelect('connectors');
                            setIsOpen(false);
                        }}
                        className="
                            w-full flex items-center gap-3 px-3 py-2 text-sm
                            text-slate-700 dark:text-slate-300
                            hover:bg-slate-100 dark:hover:bg-navy-700
                            transition-colors
                        "
                    >
                        <Plug size={16} className="text-slate-400" />
                        {t('aiChat.menu.manageConnectors', 'Manage Connectors')}
                    </button>

                    <button
                        onClick={() => {
                            onToolSelect('knowledge');
                            setIsOpen(false);
                        }}
                        className="
                            w-full flex items-center gap-3 px-3 py-2 text-sm
                            text-slate-700 dark:text-slate-300
                            hover:bg-slate-100 dark:hover:bg-navy-700
                            transition-colors
                        "
                    >
                        <BookOpen size={16} className="text-slate-400" />
                        {t('aiChat.menu.knowledgeBases', 'Knowledge Bases')}
                    </button>
                </div>
            )}
        </div>
    );
};

export default ToolsMenu;

