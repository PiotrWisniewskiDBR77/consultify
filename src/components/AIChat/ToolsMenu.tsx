/**
 * ToolsMenu
 *
 * Dropdown menu for AI tools (Gemini-style, opens downward):
 * - AI Modes (toggles with visual feedback)
 * - Response Style
 * - Custom Instructions
 *
 * Knowledge Sources removed — always enabled by default.
 *
 * @version 3.0.0
 */

import {
  BarChart3,
  Brain,
  Briefcase,
  Check,
  ChevronRight,
  Globe,
  GraduationCap,
  LineChart,
  MessageSquare,
  Pen,
  Search,
  Settings,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Users,
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

// Response Style definitions — domain-specific presets for PMO/consulting
type ResponseStyle = 'normal' | 'executive' | 'analyst' | 'coach' | 'concise' | 'formal';

interface StyleOption {
  id: ResponseStyle;
  icon: React.ElementType;
  labelKey: string;
  descKey: string;
}

const RESPONSE_STYLES: StyleOption[] = [
  {
    id: 'normal',
    icon: MessageSquare,
    labelKey: 'aiChat.menu.styles.normal',
    descKey: 'aiChat.menu.styles.normalDesc',
  },
  {
    id: 'executive',
    icon: Briefcase,
    labelKey: 'aiChat.menu.styles.executive',
    descKey: 'aiChat.menu.styles.executiveDesc',
  },
  {
    id: 'analyst',
    icon: BarChart3,
    labelKey: 'aiChat.menu.styles.analyst',
    descKey: 'aiChat.menu.styles.analystDesc',
  },
  {
    id: 'coach',
    icon: GraduationCap,
    labelKey: 'aiChat.menu.styles.coach',
    descKey: 'aiChat.menu.styles.coachDesc',
  },
  {
    id: 'concise',
    icon: Zap,
    labelKey: 'aiChat.menu.styles.concise',
    descKey: 'aiChat.menu.styles.conciseDesc',
  },
  {
    id: 'formal',
    icon: Pen,
    labelKey: 'aiChat.menu.styles.formal',
    descKey: 'aiChat.menu.styles.formalDesc',
  },
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
  const [showCustomInstructions, setShowCustomInstructions] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  const [customInstructionsLoaded, setCustomInstructionsLoaded] = useState(false);
  const [isSavingInstructions, setIsSavingInstructions] = useState(false);
  const [menuMaxHeight, setMenuMaxHeight] = useState<number | undefined>(undefined);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const styleButtonRef = useRef<HTMLButtonElement>(null);
  const ttsButtonRef = useRef<HTMLButtonElement>(null);

  // Calculate available space above the trigger button for menu positioning
  // (menu opens upward to avoid overflowing the bottom of the viewport)
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // Available space above trigger minus some padding
      const availableAbove = rect.top - 24;
      setMenuMaxHeight(Math.max(200, availableAbove));
    }
  }, [isOpen]);

  // Load custom instructions from AI memory on first open
  React.useEffect(() => {
    if (isOpen && !customInstructionsLoaded) {
      fetch('/api/ai-memory', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
        .then((r) => r.json())
        .then((data) => {
          const ci = data.memories?.find((m: any) => m.key === 'custom_instructions');
          if (ci?.value) setCustomInstructions(ci.value);
          setCustomInstructionsLoaded(true);
        })
        .catch(() => setCustomInstructionsLoaded(true));
    }
  }, [isOpen, customInstructionsLoaded]);

  // Save custom instructions to AI memory
  const handleSaveInstructions = async () => {
    setIsSavingInstructions(true);
    try {
      await fetch('/api/ai-memory/custom_instructions', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          value: customInstructions.trim(),
          source: 'user',
          context: 'Custom instructions set by user via AI preferences',
        }),
      });
      toast.success(t('aiChat.menu.instructionsSaved', 'Instrukcje zapisane'));
    } catch {
      toast.error(t('aiChat.menu.instructionsSaveError', 'Nie udalo sie zapisac'));
    } finally {
      setIsSavingInstructions(false);
    }
  };

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
    responseStyle,
    textToSpeech,
    ttsRate,
    ttsVoice,
    marketResearch,
    coThinkerMode,
  } = aiConfig as any;

  // Count active modes for badge
  const activeModeCount = [
    deepResearch,
    webSearch,
    showReasoning,
    textToSpeech,
    marketResearch,
  ].filter(Boolean).length;

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
      id: 'marketResearch',
      icon: LineChart,
      labelKey: 'aiChat.menu.modes.marketResearch.label',
      descKey: 'aiChat.menu.modes.marketResearch.desc',
      enabled: marketResearch ?? false,
    },
    {
      id: 'multiAgent',
      icon: Users,
      labelKey: 'aiChat.menu.modes.multiAgent.label',
      descKey: 'aiChat.menu.modes.multiAgent.desc',
      enabled: aiConfig.multiAgent ?? false,
    },
    {
      id: 'textToSpeech',
      icon: Volume2,
      labelKey: 'aiChat.menu.modes.textToSpeech.label',
      descKey: 'aiChat.menu.modes.textToSpeech.desc',
      enabled: textToSpeech,
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

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
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

      {/* Dropdown Menu — opens upward so it doesn't overflow bottom of viewport */}
      {isOpen && (
        <div
          className="
                        absolute left-0 bottom-full mb-2 z-50
                        w-72 py-1
                        bg-white dark:bg-navy-800
                        border border-slate-200 dark:border-navy-700
                        rounded-xl shadow-xl
                        animate-in fade-in-0 slide-in-from-bottom-2 duration-150
                        overflow-y-auto
                    "
          style={{ maxHeight: menuMaxHeight ? `${menuMaxHeight}px` : '70vh' }}
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

          {/* Co-Thinker Section */}
          <div className="my-2 border-t border-slate-200 dark:border-navy-700" />
          <div className="px-3 py-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t('chat.coThinker.title', 'Co-Thinker')}
            </span>
          </div>
          <div className="px-3 pb-2 flex flex-wrap gap-1.5">
            {[
              {
                id: 'multi_consultant',
                label: t('chat.coThinker.multiConsultant', 'Multi-Consultant Panel'),
                icon: '👥',
              },
              { id: 'idea_maker', label: t('chat.coThinker.ideaMaker', 'Idea Maker'), icon: '💡' },
              {
                id: 'competitive_analyst',
                label: t('chat.coThinker.competitiveAnalyst', 'Competitive Analyst'),
                icon: '🎯',
              },
              {
                id: 'risk_challenger',
                label: t('chat.coThinker.riskChallenger', 'Risk Challenger'),
                icon: '⚠️',
              },
              {
                id: 'executive_editor',
                label: t('chat.coThinker.executiveEditor', 'Executive Editor'),
                icon: '📋',
              },
            ].map((mode) => {
              const isActive = coThinkerMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => {
                    const newMode = isActive ? null : mode.id;
                    setAIConfig({ coThinkerMode: newMode } as any);
                    if (newMode) {
                      toast.success(
                        t('chat.coThinker.activated', 'Co-Thinker: {{mode}}', { mode: mode.label }),
                        { duration: 2000, icon: mode.icon }
                      );
                    } else {
                      toast.success(t('chat.coThinker.deactivated', 'Co-Thinker disabled'), {
                        duration: 1500,
                      });
                    }
                    onToolSelect(`cothinker:${newMode || 'off'}`);
                  }}
                  className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 text-primary-600 dark:text-primary-400 font-medium'
                      : 'bg-slate-50 dark:bg-navy-700 border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-600'
                  }`}
                >
                  <span>{mode.icon}</span>
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>

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
                className={`absolute top-0 w-56 py-1 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl shadow-xl z-50 ${submenuPosition === 'right' ? 'left-full ml-1' : 'right-full mr-1'}`}
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
                        w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors
                        ${isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-slate-50 dark:hover:bg-navy-700'}
                      `}
                    >
                      <StyleIcon
                        size={14}
                        className={`mt-0.5 shrink-0 ${
                          isSelected ? 'text-primary-500' : 'text-slate-400 dark:text-slate-500'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <span
                          className={`block text-sm ${isSelected ? 'text-primary-700 dark:text-primary-300 font-medium' : 'text-slate-700 dark:text-slate-300'}`}
                        >
                          {t(style.labelKey)}
                        </span>
                        <span className="block text-[10px] text-slate-400 dark:text-slate-500 leading-tight mt-0.5">
                          {t(style.descKey)}
                        </span>
                      </div>
                      {isSelected && (
                        <Check size={14} className="text-primary-500 shrink-0 mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Custom Instructions Section */}
          <div className="my-2 border-t border-slate-200 dark:border-navy-700" />
          <div className="px-3 py-1">
            <button
              onClick={() => setShowCustomInstructions(!showCustomInstructions)}
              className="w-full flex items-center gap-3 py-2 text-left"
            >
              <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-navy-700">
                <Settings size={14} className="text-slate-400 dark:text-slate-500" />
              </div>
              <div className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('aiChat.menu.customInstructions', 'Moje instrukcje')}
              </div>
              <ChevronRight
                size={14}
                className={`text-slate-400 shrink-0 transition-transform ${showCustomInstructions ? 'rotate-90' : ''}`}
              />
            </button>
            {showCustomInstructions && (
              <div className="mt-1 mb-2">
                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value.slice(0, 1000))}
                  placeholder={t(
                    'aiChat.menu.customInstructionsPlaceholder',
                    'np. "Zawsze odpowiadaj po polsku", "Preferuję tabele nad tekstem", "Jestem CTO w firmie produkcyjnej"'
                  )}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-navy-700 border border-slate-200 dark:border-navy-600 rounded-lg text-slate-700 dark:text-slate-300 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                  rows={3}
                />
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[10px] text-slate-400">
                    {customInstructions.length}/1000
                  </span>
                  <button
                    onClick={handleSaveInstructions}
                    disabled={isSavingInstructions}
                    className="px-3 py-1 text-xs font-medium bg-primary-600 hover:bg-primary-500 disabled:bg-slate-300 dark:disabled:bg-navy-700 text-white rounded-lg transition-colors"
                  >
                    {isSavingInstructions
                      ? t('common.saving', 'Zapisuję...')
                      : t('common.save', 'Zapisz')}
                  </button>
                </div>
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

                    {/* C7.2: Voice style presets */}
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1 block">
                        {t('aiChat.menu.voiceStyle', 'Voice style')}
                      </label>
                      <div className="grid grid-cols-2 gap-1">
                        {[
                          {
                            id: 'formal',
                            label: t('aiChat.menu.voiceFormal', 'Formal'),
                            rate: 0.9,
                            pitch: 0.9,
                          },
                          {
                            id: 'normal',
                            label: t('aiChat.menu.voiceNormal', 'Normal'),
                            rate: 1.0,
                            pitch: 1.0,
                          },
                          {
                            id: 'cheerful',
                            label: t('aiChat.menu.voiceCheerful', 'Cheerful'),
                            rate: 1.1,
                            pitch: 1.15,
                          },
                          {
                            id: 'calm',
                            label: t('aiChat.menu.voiceCalm', 'Calm'),
                            rate: 0.85,
                            pitch: 0.95,
                          },
                        ].map((style) => {
                          const isActive = (ttsRate ?? 1) === style.rate;
                          return (
                            <button
                              key={style.id}
                              onClick={() => {
                                setAIConfig({ ttsRate: style.rate, ttsPitch: style.pitch } as any);
                                toast.success(`${style.label} voice style`, {
                                  duration: 1200,
                                  icon: '🎙️',
                                });
                              }}
                              className={`px-2 py-1.5 text-xs rounded-lg border transition-colors ${
                                isActive
                                  ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 text-primary-600 dark:text-primary-400 font-medium'
                                  : 'bg-slate-50 dark:bg-navy-700 border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-600'
                              }`}
                            >
                              {style.label}
                            </button>
                          );
                        })}
                      </div>
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
