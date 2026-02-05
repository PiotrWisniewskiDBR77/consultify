/**
 * ToolsMenu
 *
 * Dropdown menu for AI tools and integrations:
 * - AI Modes (toggles with visual feedback)
 * - Knowledge Sources (toggles for data sources)
 *
 * @version 2.1.0
 */

import {
  BookOpen,
  Brain,
  Building2,
  Check,
  ChevronRight,
  Database,
  Globe,
  GraduationCap,
  MessageSquare,
  Pen,
  Search,
  Settings,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Volume2,
  Zap,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../store/useAppStore';

interface ToolsMenuProps {
  onToolSelect: (tool: string) => void;
  disabled?: boolean;
  icon?: React.ElementType;
}

interface ToolMode {
  id: string;
  icon: React.ElementType;
  labelKey: string;
  descKey: string;
  enabled?: boolean;
}

interface KnowledgeSource {
  id: string;
  icon: React.ElementType;
  labelKey: string;
  descKey: string;
  enabled: boolean;
}

// Response Style definitions
type ResponseStyle = 'normal' | 'learning' | 'concise' | 'explanatory' | 'formal';

interface StyleOption {
  id: ResponseStyle;
  icon: React.ElementType;
  labelKey: string;
}

const RESPONSE_STYLES: StyleOption[] = [
  { id: 'normal', icon: MessageSquare, labelKey: 'aiChat.menu.styles.normal' },
  { id: 'learning', icon: GraduationCap, labelKey: 'aiChat.menu.styles.learning' },
  { id: 'concise', icon: Zap, labelKey: 'aiChat.menu.styles.concise' },
  { id: 'explanatory', icon: BookOpen, labelKey: 'aiChat.menu.styles.explanatory' },
  { id: 'formal', icon: Pen, labelKey: 'aiChat.menu.styles.formal' },
];

export const ToolsMenu: React.FC<ToolsMenuProps> = ({
  onToolSelect,
  disabled = false,
  icon: IconComponent = Brain,
}) => {
  const { t } = useTranslation();
  const { aiConfig, setAIConfig } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [showStyleSubmenu, setShowStyleSubmenu] = useState(false);
  const [showTTSSubmenu, setShowTTSSubmenu] = useState(false);
  const [submenuPosition, setSubmenuPosition] = useState<'right' | 'left'>('right');
  const menuRef = useRef<HTMLDivElement>(null);
  const styleButtonRef = useRef<HTMLButtonElement>(null);
  const ttsButtonRef = useRef<HTMLButtonElement>(null);

  // Get available voices
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
      };
      loadVoices();
      window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
      return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    }
    return undefined;
  }, []);

  // Use global store values
  const {
    deepResearch,
    webSearch,
    showReasoning,
    knowledgeSources,
    responseStyle,
    textToSpeech,
    ttsRate,
    ttsVoice,
  } = aiConfig;

  // Count active modes for badge
  const activeModeCount = [deepResearch, webSearch, showReasoning, textToSpeech].filter(
    Boolean
  ).length;
  const activeSourceCount = Object.values(knowledgeSources || {}).filter(Boolean).length;

  // AI Modes - using global store values
  const AI_MODES: ToolMode[] = [
    {
      id: 'deepResearch',
      icon: Search,
      labelKey: 'aiChat.menu.modes.deepResearch.label',
      descKey: 'aiChat.menu.modes.deepResearch.desc',
      enabled: deepResearch,
    },
    {
      id: 'webSearch',
      icon: Globe,
      labelKey: 'aiChat.menu.modes.webSearch.label',
      descKey: 'aiChat.menu.modes.webSearch.desc',
      enabled: webSearch,
    },
    {
      id: 'showReasoning',
      icon: Sparkles,
      labelKey: 'aiChat.menu.modes.showReasoning.label',
      descKey: 'aiChat.menu.modes.showReasoning.desc',
      enabled: showReasoning,
    },
    {
      id: 'textToSpeech',
      icon: Volume2,
      labelKey: 'aiChat.menu.modes.textToSpeech.label',
      descKey: 'aiChat.menu.modes.textToSpeech.desc',
      enabled: textToSpeech,
    },
  ];

  // Knowledge Sources - using global store values (all disabled by default)
  const KNOWLEDGE_SOURCES: KnowledgeSource[] = [
    {
      id: 'pmoDocuments',
      icon: BookOpen,
      labelKey: 'aiChat.menu.sources.pmoDocuments.label',
      descKey: 'aiChat.menu.sources.pmoDocuments.desc',
      enabled: knowledgeSources?.pmoDocuments ?? false,
    },
    {
      id: 'projectData',
      icon: Database,
      labelKey: 'aiChat.menu.sources.projectData.label',
      descKey: 'aiChat.menu.sources.projectData.desc',
      enabled: knowledgeSources?.projectData ?? false,
    },
    {
      id: 'organizationData',
      icon: Building2,
      labelKey: 'aiChat.menu.sources.organizationData.label',
      descKey: 'aiChat.menu.sources.organizationData.desc',
      enabled: knowledgeSources?.organizationData ?? false,
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

  // Toggle AI modes - persists to global store
  const toggleMode = (modeId: string) => {
    const currentValue = aiConfig[modeId as keyof typeof aiConfig];
    const newValue = !currentValue;
    setAIConfig({ [modeId]: newValue });

    // Also sync maxMode when toggling showReasoning
    if (modeId === 'showReasoning') {
      setAIConfig({ maxMode: newValue });
    }

    const label = t(`aiChat.menu.modes.${modeId}.label`, modeId);
    const icon = modeId === 'textToSpeech' ? '🔊' : '✓';
    toast.success(
      t(newValue ? 'aiChat.menu.toast.enabled' : 'aiChat.menu.toast.disabled', { label }),
      { duration: 2000, icon }
    );

    onToolSelect(`toggle:${modeId}`);
  };

  // Toggle knowledge sources - persists to global store
  const toggleKnowledgeSource = (sourceId: string) => {
    const currentValue = knowledgeSources?.[sourceId as keyof typeof knowledgeSources] ?? false;
    const newValue = !currentValue;
    const newSources = {
      ...knowledgeSources,
      [sourceId]: newValue,
    };
    setAIConfig({ knowledgeSources: newSources });

    const label = t(`aiChat.menu.sources.${sourceId}.label`, sourceId);
    toast.success(
      t(newValue ? 'aiChat.menu.toast.enabled' : 'aiChat.menu.toast.disabled', { label }),
      { duration: 2000 }
    );

    onToolSelect(`source:${sourceId}`);
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        data-testid="chat-tools-button"
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
                                    w-full flex items-center gap-3 px-3 py-2 text-left
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
                <div
                  className={`flex-1 text-sm font-medium ${isEnabled ? 'text-primary-700 dark:text-primary-300' : 'text-slate-700 dark:text-slate-300'}`}
                >
                  {t(mode.labelKey)}
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
                                    ${isEnabled ? 'bg-green-50 dark:bg-green-900/20' : 'hover:bg-slate-50 dark:hover:bg-navy-700'}
                                `}
              >
                <div
                  className={`p-1.5 rounded-lg ${isEnabled ? 'bg-green-100 dark:bg-green-900/30' : 'bg-slate-100 dark:bg-navy-700'}`}
                >
                  <Icon
                    size={14}
                    className={isEnabled ? 'text-green-500' : 'text-slate-400 dark:text-slate-500'}
                  />
                </div>
                <div
                  className={`flex-1 text-sm font-medium ${isEnabled ? 'text-green-700 dark:text-green-300' : 'text-slate-700 dark:text-slate-300'}`}
                >
                  {t(source.labelKey)}
                </div>
                {isEnabled ? (
                  <ToggleRight size={22} className="text-green-500 shrink-0" />
                ) : (
                  <ToggleLeft size={22} className="text-slate-300 dark:text-slate-600 shrink-0" />
                )}
              </button>
            );
          })}

          {/* Divider */}
          <div className="my-2 border-t border-slate-200 dark:border-navy-700" />

          {/* Response Style Section */}
          <div className="relative">
            <button
              ref={styleButtonRef}
              onClick={() => {
                // Check if submenu would go off-screen
                if (styleButtonRef.current) {
                  const rect = styleButtonRef.current.getBoundingClientRect();
                  const submenuWidth = 192; // w-48 = 12rem = 192px
                  const wouldOverflow = rect.right + submenuWidth > window.innerWidth;
                  setSubmenuPosition(wouldOverflow ? 'left' : 'right');
                }
                setShowStyleSubmenu(!showStyleSubmenu);
                setShowTTSSubmenu(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors"
            >
              <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-navy-700">
                <Pen size={14} className="text-slate-400 dark:text-slate-500" />
              </div>
              <div className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('aiChat.menu.responseStyle', 'Styl odpowiedzi')}
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {t(`aiChat.menu.styles.${responseStyle || 'normal'}`, 'Normal')}
              </span>
              <ChevronRight
                size={14}
                className={`text-slate-400 shrink-0 transition-transform ${submenuPosition === 'left' ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Style Submenu - positions left or right based on viewport */}
            {showStyleSubmenu && (
              <div
                className={`absolute top-0 w-48 py-1 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl z-50 ${submenuPosition === 'right' ? 'left-full ml-1' : 'right-full mr-1'}`}
              >
                {RESPONSE_STYLES.map((style) => {
                  const StyleIcon = style.icon;
                  const isSelected = responseStyle === style.id;

                  return (
                    <button
                      key={style.id}
                      onClick={() => {
                        setAIConfig({ responseStyle: style.id });
                        setShowStyleSubmenu(false);
                        const styleLabel = t(style.labelKey);
                        toast.success(t('aiChat.menu.toast.responseStyle', { style: styleLabel }), {
                          duration: 2000,
                        });
                        onToolSelect(`style:${style.id}`);
                      }}
                      className={`
                        w-full flex items-center gap-3 px-3 py-2 text-left transition-colors
                        ${isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-slate-50 dark:hover:bg-navy-700'}
                      `}
                    >
                      <StyleIcon
                        size={14}
                        className={
                          isSelected ? 'text-primary-500' : 'text-slate-400 dark:text-slate-500'
                        }
                      />
                      <span
                        className={`flex-1 text-sm ${isSelected ? 'text-primary-700 dark:text-primary-300 font-medium' : 'text-slate-700 dark:text-slate-300'}`}
                      >
                        {t(style.labelKey)}
                      </span>
                      {isSelected && <Check size={14} className="text-primary-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* TTS Settings Section - only show when TTS is enabled */}
          {textToSpeech && (
            <>
              <div className="my-2 border-t border-slate-200 dark:border-navy-700" />
              <div className="relative">
                <button
                  ref={ttsButtonRef}
                  onClick={() => {
                    if (ttsButtonRef.current) {
                      const rect = ttsButtonRef.current.getBoundingClientRect();
                      const submenuWidth = 240;
                      const wouldOverflow = rect.right + submenuWidth > window.innerWidth;
                      setSubmenuPosition(wouldOverflow ? 'left' : 'right');
                    }
                    setShowTTSSubmenu(!showTTSSubmenu);
                    setShowStyleSubmenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors"
                >
                  <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-navy-700">
                    <Settings size={14} className="text-slate-400 dark:text-slate-500" />
                  </div>
                  <div className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                    {t('aiChat.menu.ttsSettings', 'Ustawienia głosu')}
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{ttsRate}x</span>
                  <ChevronRight
                    size={14}
                    className={`text-slate-400 shrink-0 transition-transform ${submenuPosition === 'left' ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* TTS Settings Submenu */}
                {showTTSSubmenu && (
                  <div
                    className={`absolute top-0 w-60 py-2 px-3 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl z-50 ${submenuPosition === 'right' ? 'left-full ml-1' : 'right-full mr-1'}`}
                  >
                    {/* Speed slider */}
                    <div className="mb-3">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
                        {t('aiChat.menu.ttsSpeed', 'Szybkość')} ({ttsRate}x)
                      </label>
                      <input
                        type="range"
                        min="0.5"
                        max="2"
                        step="0.1"
                        value={ttsRate ?? 1}
                        onChange={(e) => {
                          const newRate = parseFloat(e.target.value);
                          setAIConfig({ ttsRate: newRate });
                        }}
                        className="w-full h-2 bg-slate-200 dark:bg-navy-600 rounded-lg appearance-none cursor-pointer accent-primary-500"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                        <span>0.5x</span>
                        <span>1x</span>
                        <span>2x</span>
                      </div>
                    </div>

                    {/* Voice selection */}
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
                        {t('aiChat.menu.ttsVoice', 'Głos')}
                      </label>
                      <select
                        value={ttsVoice || ''}
                        onChange={(e) => {
                          setAIConfig({ ttsVoice: e.target.value || null });
                          toast.success(t('aiChat.menu.ttsVoiceChanged', 'Voice changed'), {
                            duration: 1500,
                            icon: '🔊',
                          });
                        }}
                        className="w-full px-2 py-1.5 text-sm bg-slate-100 dark:bg-navy-700 border-0 rounded-lg text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="">
                          {t('aiChat.menu.ttsAutoVoice', 'Auto (wykryj język)')}
                        </option>
                        {availableVoices
                          .filter((v) => v.lang.startsWith('pl') || v.lang.startsWith('en'))
                          .map((voice) => (
                            <option key={voice.voiceURI} value={voice.voiceURI}>
                              {voice.name} ({voice.lang})
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Test button */}
                    <button
                      onClick={() => {
                        if ('speechSynthesis' in window) {
                          window.speechSynthesis.cancel();
                          const utterance = new SpeechSynthesisUtterance(
                            t('aiChat.menu.ttsTestUtterance', 'Hi, this is a voice test.')
                          );
                          utterance.rate = ttsRate ?? 1;
                          if (ttsVoice) {
                            const voice = availableVoices.find((v) => v.voiceURI === ttsVoice);
                            if (voice) {
                              utterance.voice = voice;
                              utterance.lang = voice.lang;
                            }
                          } else {
                            const polishVoice = availableVoices.find((v) =>
                              v.lang.startsWith('pl')
                            );
                            if (polishVoice) {
                              utterance.voice = polishVoice;
                              utterance.lang = 'pl-PL';
                            }
                          }
                          window.speechSynthesis.speak(utterance);
                        }
                      }}
                      className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 rounded-lg transition-colors"
                    >
                      <Volume2 size={14} />
                      {t('aiChat.menu.ttsTest', 'Testuj głos')}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ToolsMenu;
