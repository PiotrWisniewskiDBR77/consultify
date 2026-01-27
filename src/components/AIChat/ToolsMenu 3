/**
 * ToolsMenu
 *
 * Redesigned dropdown menu for AI tools and integrations:
 * - AI Modes (toggles with visual feedback)
 * - PMO Actions (quick actions to navigate)
 * - Knowledge Sources (toggles for data sources)
 *
 * @version 2.0.0
 */

import {
  BookOpen,
  Brain,
  Building2,
  Calculator,
  CheckCircle2,
  ChevronRight,
  Database,
  ExternalLink,
  FileText,
  Globe,
  Lightbulb,
  Search,
  Settings,
  Sparkles,
  Target,
  ToggleLeft,
  ToggleRight,
  Users,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
  description: string;
  enabled?: boolean;
}

interface KnowledgeSource {
  id: string;
  icon: React.ElementType;
  labelKey: string;
  label: string;
  description: string;
  enabled: boolean;
}

interface PmoAction {
  id: string;
  icon: React.ElementType;
  labelKey: string;
  label: string;
  view: AppView;
  color: string;
}

export const ToolsMenu: React.FC<ToolsMenuProps> = ({
  onToolSelect,
  disabled = false,
  icon: IconComponent = Brain,
}) => {
  const { t } = useTranslation();
  const { setCurrentView, aiConfig, setAIConfig } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [modes, setModes] = useState({
    deepResearch: false,
    webSearch: false,
    showReasoning: aiConfig.maxMode,
  });
  const [knowledgeSources, setKnowledgeSources] = useState({
    pmoDocuments: true,
    projectData: true,
    organizationData: false,
    webSearch: false,
  });
  const menuRef = useRef<HTMLDivElement>(null);

  // Count active modes for badge
  const activeModeCount = Object.values(modes).filter(Boolean).length;
  const activeSourceCount = Object.values(knowledgeSources).filter(Boolean).length;

  // AI Modes
  const AI_MODES: ToolMode[] = [
    {
      id: 'deepResearch',
      icon: Search,
      labelKey: 'aiChat.menu.deepResearch',
      label: 'Głęboka analiza',
      description: 'Dogłębne badanie tematu',
      enabled: modes.deepResearch,
    },
    {
      id: 'webSearch',
      icon: Globe,
      labelKey: 'aiChat.menu.webSearch',
      label: 'Wyszukiwanie web',
      description: 'Dane w czasie rzeczywistym',
      enabled: modes.webSearch,
    },
    {
      id: 'showReasoning',
      icon: Sparkles,
      labelKey: 'aiChat.menu.showReasoning',
      label: 'Pokaż rozumowanie',
      description: 'Widoczny tok myślenia AI',
      enabled: modes.showReasoning,
    },
  ];

  // Knowledge Sources
  const KNOWLEDGE_SOURCES: KnowledgeSource[] = [
    {
      id: 'pmoDocuments',
      icon: BookOpen,
      labelKey: 'aiChat.menu.pmoDocuments',
      label: 'Dokumenty PMO',
      description: 'ISO 21500, PMBOK, PRINCE2',
      enabled: knowledgeSources.pmoDocuments,
    },
    {
      id: 'projectData',
      icon: Database,
      labelKey: 'aiChat.menu.projectData',
      label: 'Dane projektu',
      description: 'Inicjatywy, zadania, decyzje',
      enabled: knowledgeSources.projectData,
    },
    {
      id: 'organizationData',
      icon: Building2,
      labelKey: 'aiChat.menu.organizationData',
      label: 'Dane organizacji',
      description: 'Zespoły, role, procesy',
      enabled: knowledgeSources.organizationData,
    },
    {
      id: 'webSearch',
      icon: Globe,
      labelKey: 'aiChat.menu.webSearchSource',
      label: 'Wyszukiwanie Web',
      description: 'Aktualne informacje z sieci',
      enabled: knowledgeSources.webSearch,
    },
  ];

  // PMO Actions
  const PMO_ACTIONS: PmoAction[] = [
    {
      id: 'start-assessment',
      icon: Target,
      labelKey: 'aiChat.menu.startAssessment',
      label: 'Rozpocznij Assessment',
      view: AppView.ASSESSMENT_OVERVIEW,
      color: 'text-purple-500',
    },
    {
      id: 'generate-initiatives',
      icon: Lightbulb,
      labelKey: 'aiChat.menu.generateInitiatives',
      label: 'Generuj inicjatywy',
      view: AppView.INITIATIVE_GENERATOR,
      color: 'text-amber-500',
    },
    {
      id: 'calculate-roi',
      icon: Calculator,
      labelKey: 'aiChat.menu.calculateRoi',
      label: 'Oblicz ROI',
      view: AppView.ECONOMICS,
      color: 'text-green-500',
    },
    {
      id: 'build-report',
      icon: FileText,
      labelKey: 'aiChat.menu.buildReport',
      label: 'Zbuduj raport',
      view: AppView.FULL_STEP6_REPORTS,
      color: 'text-blue-500',
    },
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
    setModes((prev) => {
      const newModes = { ...prev, [modeId]: !prev[modeId as keyof typeof prev] };

      // Sync showReasoning with MAX Mode
      if (modeId === 'showReasoning') {
        setAIConfig({ maxMode: newModes.showReasoning });
      }

      return newModes;
    });
    onToolSelect(`toggle:${modeId}`);
  };

  const toggleKnowledgeSource = (sourceId: string) => {
    setKnowledgeSources((prev) => ({
      ...prev,
      [sourceId]: !prev[sourceId as keyof typeof prev],
    }));
    onToolSelect(`source:${sourceId}`);
  };

  const handlePmoAction = (action: PmoAction) => {
    setCurrentView(action.view);
    setIsOpen(false);
    onToolSelect(`pmo:${action.id}`);
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
                    relative p-2 rounded-lg transition-colors
                    ${
                      activeModeCount > 0
                        ? 'text-primary-500 bg-primary-50 dark:bg-primary-900/30'
                        : 'text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                    }
                    ${disabled ? 'cursor-not-allowed opacity-50' : ''}
                `}
        title={t('aiChat.menu.tools', 'Narzędzia AI')}
      >
        <IconComponent size={20} />
        {activeModeCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-[10px] font-bold text-white bg-primary-500 rounded-full">
            {activeModeCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="
                        absolute left-0 bottom-full mb-2 z-50
                        w-72 py-1
                        bg-white dark:bg-navy-800
                        border border-slate-200 dark:border-navy-700
                        rounded-xl shadow-xl
                        animate-in fade-in-0 slide-in-from-bottom-2 duration-150
                        max-h-[70vh] overflow-y-auto
                    "
        >
          {/* AI Modes Section */}
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t('aiChat.menu.aiModes', 'Tryby AI')}
            </span>
            {activeModeCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-medium">
                {activeModeCount} {t('common.active', 'aktywne')}
              </span>
            )}
          </div>

          {AI_MODES.map((mode) => {
            const Icon = mode.icon;
            const isEnabled = mode.enabled;

            return (
              <button
                key={mode.id}
                onClick={() => toggleMode(mode.id)}
                className={`
                                    w-full flex items-center gap-3 px-3 py-2.5 text-left
                                    transition-colors
                                    ${isEnabled ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-slate-50 dark:hover:bg-navy-700'}
                                `}
              >
                <div
                  className={`p-1.5 rounded-lg ${isEnabled ? 'bg-primary-100 dark:bg-primary-900/30' : 'bg-slate-100 dark:bg-navy-700'}`}
                >
                  <Icon
                    size={14}
                    className={
                      isEnabled ? 'text-primary-500' : 'text-slate-400 dark:text-slate-500'
                    }
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-medium ${isEnabled ? 'text-primary-700 dark:text-primary-300' : 'text-slate-700 dark:text-slate-300'}`}
                  >
                    {t(mode.labelKey, mode.label)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {mode.description}
                  </div>
                </div>
                {isEnabled ? (
                  <ToggleRight size={22} className="text-primary-500 shrink-0" />
                ) : (
                  <ToggleLeft size={22} className="text-slate-300 dark:text-slate-600 shrink-0" />
                )}
              </button>
            );
          })}

          {/* Divider */}
          <div className="my-2 border-t border-slate-200 dark:border-navy-700" />

          {/* Knowledge Sources Section */}
          <div className="px-3 py-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t('aiChat.menu.knowledgeSources', 'Źródła wiedzy')}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-navy-700 text-slate-600 dark:text-slate-400 font-medium">
              {activeSourceCount}/{KNOWLEDGE_SOURCES.length}
            </span>
          </div>

          {KNOWLEDGE_SOURCES.map((source) => {
            const Icon = source.icon;
            const isEnabled = source.enabled;

            return (
              <button
                key={source.id}
                onClick={() => toggleKnowledgeSource(source.id)}
                className={`
                                    w-full flex items-center gap-3 px-3 py-2 text-left
                                    transition-colors
                                    ${isEnabled ? 'bg-green-50 dark:bg-green-900/10' : 'hover:bg-slate-50 dark:hover:bg-navy-700'}
                                `}
              >
                <Icon
                  size={14}
                  className={isEnabled ? 'text-green-500' : 'text-slate-400 dark:text-slate-500'}
                />
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm ${isEnabled ? 'text-green-700 dark:text-green-300' : 'text-slate-600 dark:text-slate-400'}`}
                  >
                    {t(source.labelKey, source.label)}
                  </div>
                </div>
                {isEnabled && <CheckCircle2 size={14} className="text-green-500 shrink-0" />}
              </button>
            );
          })}

          {/* Divider */}
          <div className="my-2 border-t border-slate-200 dark:border-navy-700" />

          {/* PMO Actions Section */}
          <div className="px-3 py-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t('aiChat.menu.pmoActions', 'Akcje PMO')}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1 px-2 pb-2">
            {PMO_ACTIONS.map((action) => {
              const Icon = action.icon;

              return (
                <button
                  key={action.id}
                  onClick={() => handlePmoAction(action)}
                  className="
                                        flex flex-col items-center gap-1.5 p-3
                                        bg-slate-50 dark:bg-navy-700/50
                                        hover:bg-slate-100 dark:hover:bg-navy-700
                                        rounded-lg transition-colors text-center
                                    "
                >
                  <Icon size={18} className={action.color} />
                  <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400 leading-tight">
                    {t(action.labelKey, action.label)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Settings Link */}
          <div className="border-t border-slate-200 dark:border-navy-700 mt-1">
            <button
              onClick={() => {
                setCurrentView(AppView.SETTINGS_PROFILE);
                setIsOpen(false);
                onToolSelect('settings');
              }}
              className="
                                w-full flex items-center justify-between px-3 py-2.5 text-sm
                                text-slate-500 dark:text-slate-400
                                hover:bg-slate-50 dark:hover:bg-navy-700
                                transition-colors
                            "
            >
              <div className="flex items-center gap-2">
                <Settings size={14} />
                {t('aiChat.menu.aiSettings', 'Ustawienia AI')}
              </div>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ToolsMenu;
