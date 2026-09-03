/**
 * ToolsMenu
 *
 * ChatGPT/Grok-style tools dropdown:
 * - AI Modes (checkmark toggles, no background boxes)
 * - Response Style + Custom Instructions (Grok-style modal with card grid)
 * - Add to project
 *
 * @version 5.0.0
 */

import {
  BarChart3,
  Brain,
  Briefcase,
  Check,
  ChevronRight,
  FolderPlus,
  GraduationCap,
  Lightbulb,
  Lock,
  MessageSquare,
  Pen,
  Search,
  Sparkles,
  Users,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../store/useAppStore';
import { Button } from '../ui/primitives/Button';

interface ToolsMenuProps {
  onToolSelect: (tool: string) => void;
  disabled?: boolean;
  icon?: React.ElementType;
  hasActiveConversation?: boolean;
}

interface ToolMode {
  id: string;
  icon: React.ElementType;
  labelKey: string;
  descKey: string;
  enabled?: boolean;
}

type ResponseStyle =
  | 'normal'
  | 'executive'
  | 'analyst'
  | 'coach'
  | 'concise'
  | 'formal'
  | 'professional'
  | 'friendly';

interface StyleOption {
  id: ResponseStyle;
  labelKey: string;
  descKey: string;
  presetKey: string;
}

const RESPONSE_STYLES: StyleOption[] = [
  {
    id: 'normal',
    labelKey: 'aiChat.menu.styles.normal',
    descKey: 'aiChat.menu.styles.normalDesc',
    presetKey: 'aiChat.menu.stylePresets.normal',
  },
  {
    id: 'concise',
    labelKey: 'aiChat.menu.styles.concise',
    descKey: 'aiChat.menu.styles.conciseDesc',
    presetKey: 'aiChat.menu.stylePresets.concise',
  },
  {
    id: 'executive',
    labelKey: 'aiChat.menu.styles.executive',
    descKey: 'aiChat.menu.styles.executiveDesc',
    presetKey: 'aiChat.menu.stylePresets.executive',
  },
  {
    id: 'analyst',
    labelKey: 'aiChat.menu.styles.analyst',
    descKey: 'aiChat.menu.styles.analystDesc',
    presetKey: 'aiChat.menu.stylePresets.analyst',
  },
  {
    id: 'formal',
    labelKey: 'aiChat.menu.styles.formal',
    descKey: 'aiChat.menu.styles.formalDesc',
    presetKey: 'aiChat.menu.stylePresets.formal',
  },
  {
    id: 'coach',
    labelKey: 'aiChat.menu.styles.coach',
    descKey: 'aiChat.menu.styles.coachDesc',
    presetKey: 'aiChat.menu.stylePresets.coach',
  },
  {
    id: 'professional',
    labelKey: 'aiChat.menu.styles.professional',
    descKey: 'aiChat.menu.styles.professionalDesc',
    presetKey: 'aiChat.menu.stylePresets.professional',
  },
  {
    id: 'friendly',
    labelKey: 'aiChat.menu.styles.friendly',
    descKey: 'aiChat.menu.styles.friendlyDesc',
    presetKey: 'aiChat.menu.stylePresets.friendly',
  },
];

export const ToolsMenu: React.FC<ToolsMenuProps> = ({
  onToolSelect,
  disabled = false,
  icon: IconComponent = Brain,
  hasActiveConversation = true,
}) => {
  const { t } = useTranslation();
  const { aiConfig, setAIConfig } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  const [customInstructionsLoaded, setCustomInstructionsLoaded] = useState(false);
  const [isSavingInstructions, setIsSavingInstructions] = useState(false);
  const [menuMaxHeight, setMenuMaxHeight] = useState<number | undefined>(undefined);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const availableAbove = rect.top - 24;
      setMenuMaxHeight(Math.max(240, availableAbove));
    }
  }, [isOpen]);

  // Load custom instructions
  React.useEffect(() => {
    if ((isOpen || isStyleModalOpen) && !customInstructionsLoaded) {
      fetch('/api/ai-memory', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
        .then((r) => r.json())
        .then((data) => {
          const ci = data.memories?.find((m: any) => m.key === 'custom_instructions');
          if (ci?.value) {
            setCustomInstructions(ci.value);
            // Mirror into global aiConfig so the chat payload can send it (contract: customInstructions)
            setAIConfig({ customInstructions: ci.value } as any);
          }
          setCustomInstructionsLoaded(true);
        })
        .catch(() => setCustomInstructionsLoaded(true));
    }
  }, [isOpen, isStyleModalOpen, customInstructionsLoaded]);

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
      // Mirror into global aiConfig so it flows into the chat payload immediately
      setAIConfig({ customInstructions: customInstructions.trim() } as any);
      toast.success(t('aiChat.menu.instructionsSaved', 'Instrukcje zapisane'));
    } catch {
      toast.error(t('aiChat.menu.instructionsSaveError', 'Nie udalo sie zapisac'));
    } finally {
      setIsSavingInstructions(false);
    }
  };

  // TTS voices
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => setAvailableVoices(window.speechSynthesis.getVoices());
      loadVoices();
      window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
      return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    }
    return undefined;
  }, []);

  const {
    deepResearch,
    showReasoning,
    responseStyle,
    textToSpeech,
    ttsRate,
    ttsVoice,
    privateMode,
    chatSuggestionsEnabled,
  } = aiConfig as any;

  const activeModeCount = [
    deepResearch,
    showReasoning,
    textToSpeech,
    privateMode,
    aiConfig.multiAgent,
  ].filter(Boolean).length;

  const AI_MODES: ToolMode[] = [
    {
      id: 'deepResearch',
      icon: Search,
      labelKey: 'aiChat.menu.modes.deepResearch.label',
      descKey: 'aiChat.menu.modes.deepResearch.desc',
      enabled: deepResearch,
    },
    {
      id: 'showReasoning',
      icon: Sparkles,
      labelKey: 'aiChat.menu.modes.showReasoning.label',
      descKey: 'aiChat.menu.modes.showReasoning.desc',
      enabled: showReasoning,
    },
    {
      id: 'multiAgent',
      icon: Users,
      labelKey: 'aiChat.menu.modes.multiAgent.label',
      descKey: 'aiChat.menu.modes.multiAgent.desc',
      enabled: aiConfig.multiAgent ?? false,
    },
    {
      id: 'privateMode',
      icon: Lock,
      labelKey: 'aiChat.menu.modes.privateMode.label',
      descKey: 'aiChat.menu.modes.privateMode.desc',
      enabled: privateMode,
    },
    {
      id: 'textToSpeech',
      icon: Volume2,
      labelKey: 'aiChat.menu.modes.textToSpeech.label',
      descKey: 'aiChat.menu.modes.textToSpeech.desc',
      enabled: textToSpeech,
    },
    // D-104 (2026-08-30) — owner: "chipy sugestii ... możemy gdzieś jakoś
    // kontekstowo to włączać, wyłączać ... wyrzucenie tego całkiem nie jest
    // okej". Placed here (not next to the "+" attachments menu — that menu is
    // specifically file/cloud sources, a suggestions toggle there would be a
    // false match) because this is the existing, established home for
    // persisted chat-display preferences (checkmark list, same aiConfig
    // slice). Default ON, so nobody's chips disappear from under them; a
    // user who finds them noisy switches this off here, once, and it stays
    // off (persisted via aiConfig, same as every mode above).
    {
      id: 'chatSuggestionsEnabled',
      icon: Lightbulb,
      labelKey: 'aiChat.menu.modes.chatSuggestionsEnabled.label',
      descKey: 'aiChat.menu.modes.chatSuggestionsEnabled.desc',
      enabled: chatSuggestionsEnabled ?? true,
    },
  ];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const toggleMode = (modeId: string) => {
    const currentValue = aiConfig[modeId as keyof typeof aiConfig];
    const newValue = !currentValue;
    setAIConfig({ [modeId]: newValue });

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
              ? 'text-slate-900 dark:text-white bg-slate-200/70 dark:bg-white/[0.1]'
              : 'text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
          }
          ${disabled ? 'cursor-not-allowed opacity-50' : ''}
        `}
        title={t('aiChat.menu.tools', 'Narzędzia AI')}
      >
        <IconComponent size={20} />
        {activeModeCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-[10px] font-bold text-white bg-navy-900 rounded-full">
            {activeModeCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-label="AI tools"
          className="
            absolute left-0 bottom-full mb-2 z-50
            w-[250px] py-1.5
            bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl
            border border-slate-200/40 dark:border-white/[0.08]
            rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]
            animate-in fade-in-0 slide-in-from-bottom-2 duration-150
            overflow-y-auto overflow-x-visible
          "
          style={{ maxHeight: menuMaxHeight ? `${menuMaxHeight}px` : '70vh' }}
        >
          {/* Section header */}
          <div className="px-3.5 pt-1.5 pb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-500 uppercase tracking-wider">
              {t('aiChat.menu.aiModes', 'AI MODES')}
            </span>
            {activeModeCount > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-c-surface-raised dark:bg-c-surface-raised text-c-text-secondary dark:text-c-text-secondary font-medium">
                {activeModeCount} {t('common.active', 'active')}
              </span>
            )}
          </div>

          {/* AI Modes */}
          {AI_MODES.map((mode) => {
            const Icon = mode.icon;
            const isEnabled = mode.enabled;
            return (
              <button
                key={mode.id}
                onClick={() => toggleMode(mode.id)}
                title={
                  mode.id === 'showReasoning'
                    ? t(
                        'aiChat.menu.modes.showReasoning.tooltip',
                        'Pokazuje tok myślenia modelu (wolniejsze, droższe)'
                      )
                    : undefined
                }
                className={`
                  w-full flex items-center gap-3 px-3.5 py-2 text-left transition-colors
                  ${isEnabled ? 'bg-slate-100 dark:bg-white/[0.07]' : 'hover:bg-slate-50/80 dark:hover:bg-white/[0.04]'}
                `}
              >
                <Icon
                  size={16}
                  className={`shrink-0 ${isEnabled ? 'text-slate-700 dark:text-slate-200' : 'text-slate-600 dark:text-slate-500'}`}
                />
                <span
                  className={`flex-1 text-[13px] ${isEnabled ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-700 dark:text-slate-200'}`}
                >
                  {t(mode.labelKey)}
                </span>
                {isEnabled && (
                  <Check size={16} className="shrink-0 text-slate-700 dark:text-slate-200" />
                )}
              </button>
            );
          })}

          {/* Divider */}
          <div className="mx-3 my-1 border-t border-slate-200 dark:border-white/[0.06]" />

          {/* Steering section header — first-class "how Teresa should answer" surface */}
          <div className="px-3.5 pt-1.5 pb-1">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-500 uppercase tracking-wider">
              {t('aiChat.menu.steeringHeading', 'Jak Teresa ma odpowiadać')}
            </span>
          </div>

          {/* Response style — opens Grok-style modal */}
          <button
            onClick={() => {
              setIsStyleModalOpen(true);
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2 text-left hover:bg-slate-50/80 dark:hover:bg-white/[0.04] transition-colors"
          >
            <Pen size={16} className="shrink-0 text-slate-600 dark:text-slate-500" />
            <span className="flex-1 text-[13px] text-slate-700 dark:text-slate-200">
              {t('aiChat.menu.responseStyle', 'Response style')}
              {customInstructions.trim() && (
                <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-c-surface-raised dark:bg-c-surface-raised text-c-text-secondary dark:text-c-text-secondary font-medium align-middle">
                  {t('aiChat.menu.customSet', 'instrukcje')}
                </span>
              )}
            </span>
            <span className="text-[11px] text-slate-600 dark:text-slate-500 mr-1">
              {t(`aiChat.menu.styles.${responseStyle || 'normal'}`, 'Normal')}
            </span>
            <ChevronRight size={13} className="shrink-0 text-slate-600 dark:text-slate-500" />
          </button>

          {/* Divider */}
          <div className="mx-3 my-1 border-t border-slate-200 dark:border-white/[0.06]" />

          {/* Add to project */}
          <button
            onClick={() => {
              if (!hasActiveConversation) {
                toast.error(
                  t(
                    'aiChat.conversation.addToProjectRequiresConversation',
                    'Najpierw wyślij pierwszą wiadomość, aby dodać rozmowę do projektu.'
                  )
                );
                onToolSelect('addToProject');
                setIsOpen(false);
                return;
              }
              onToolSelect('addToProject');
              setIsOpen(false);
              toast(t('aiChat.conversation.addToProject', 'Add to project'), {
                icon: '📁',
                duration: 2000,
                style: { borderRadius: '10px', background: '#334155', color: '#fff' },
              });
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2 text-left hover:bg-slate-50/80 dark:hover:bg-white/[0.04] transition-colors"
            aria-disabled={!hasActiveConversation}
          >
            <FolderPlus size={16} className="shrink-0 text-slate-600 dark:text-slate-500" />
            <span className="flex-1 text-[13px] text-slate-700 dark:text-slate-200">
              {t('aiChat.conversation.addToProject', 'Add to project')}
            </span>
            <ChevronRight size={13} className="shrink-0 text-slate-600 dark:text-slate-500" />
          </button>

          {/* TTS Settings — only when TTS is enabled */}
          {textToSpeech && (
            <>
              <div className="mx-3 my-1 border-t border-slate-200 dark:border-white/[0.06]" />
              <TTSSettings
                ttsRate={ttsRate}
                ttsVoice={ttsVoice}
                availableVoices={availableVoices}
                setAIConfig={setAIConfig}
                t={t}
              />
            </>
          )}
        </div>
      )}

      {/* ─── Grok-style Response Style + Custom Instructions Modal ─── */}
      {isStyleModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsStyleModalOpen(false)}
          />

          {/* Panel */}
          <div
            className="relative w-full max-w-[540px] max-h-[85vh] overflow-y-auto
            bg-white dark:bg-navy-900
            border border-slate-200/40 dark:border-white/[0.08]
            rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.2)] dark:shadow-[0_24px_64px_rgba(0,0,0,0.6)]
            animate-in fade-in-0 zoom-in-95 duration-200"
          >
            {/* Close button */}
            <button
              onClick={() => setIsStyleModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-600 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors z-10"
            >
              <X size={18} />
            </button>

            <div className="p-6">
              {/* Title */}
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                {t('aiChat.menu.personalizeTitle', 'Personalize AI responses')}
              </h2>
              <p className="text-[12px] text-slate-600 dark:text-slate-500 mb-5">
                {t(
                  'aiChat.menu.steeringSubtitle',
                  'Ustaw, jak Teresa ma odpowiadać — styl i własne instrukcje obowiązują w każdej rozmowie.'
                )}
              </p>

              {/* Section: Response style */}
              <h3 className="text-[13px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2.5">
                {t('aiChat.menu.responseStyle', 'Response style')}
              </h3>

              {/* Style cards — 2-column grid (last card spans full width if odd count) */}
              <div className="grid grid-cols-2 gap-2.5 mb-6">
                {RESPONSE_STYLES.map((style, idx) => {
                  const isSelected = (responseStyle || 'normal') === style.id;
                  const isLastOdd =
                    RESPONSE_STYLES.length % 2 === 1 && idx === RESPONSE_STYLES.length - 1;
                  return (
                    <button
                      key={style.id}
                      onClick={() => {
                        setAIConfig({ responseStyle: style.id });
                        const preset = t(style.presetKey, style.presetKey);
                        if (preset) setCustomInstructions(preset);
                        const styleLabel = t(style.labelKey);
                        toast.success(t('aiChat.menu.toast.responseStyle', { style: styleLabel }), {
                          duration: 2000,
                        });
                        onToolSelect(`style:${style.id}`);
                      }}
                      className={`
                        relative text-left p-3.5 rounded-xl border transition-all duration-150
                        ${isLastOdd ? 'col-span-1' : ''}
                        ${
                          isSelected
                            ? 'border-slate-400 dark:border-white/40 bg-slate-100/60 dark:bg-white/[0.07] ring-1 ring-slate-300/60 dark:ring-white/10'
                            : 'border-slate-200/60 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/[0.15] hover:bg-slate-50/50 dark:hover:bg-white/[0.04]'
                        }
                      `}
                    >
                      <div
                        className={`text-[13px] font-medium mb-1 pr-6 ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-800 dark:text-slate-200'}`}
                      >
                        {t(style.labelKey)}
                      </div>
                      <div className="text-[11px] leading-snug text-slate-600 dark:text-slate-500 pr-4">
                        {t(style.descKey)}
                      </div>
                      {isSelected && (
                        <div className="absolute top-3 right-3">
                          <Check size={16} className="text-slate-700 dark:text-slate-200" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Divider */}
              <div className="border-t border-slate-200 dark:border-white/[0.06] mb-5" />

              {/* Custom Instructions */}
              <div>
                <h3 className="text-[14px] font-medium text-slate-800 dark:text-slate-200 mb-3">
                  {t('aiChat.menu.personalizeInstructions', 'Custom instructions')}
                </h3>

                <textarea
                  value={customInstructions}
                  onChange={(e) => setCustomInstructions(e.target.value.slice(0, 1000))}
                  placeholder={t(
                    'aiChat.menu.personalizeInstructionsPlaceholder',
                    'How should AI respond?'
                  )}
                  className="w-full min-h-[120px] px-4 py-3 text-[13px] leading-relaxed
                    bg-slate-50/60 dark:bg-white/[0.03]
                    border border-slate-200/60 dark:border-white/[0.08]
                    rounded-xl text-slate-800 dark:text-slate-200
                    placeholder-slate-400 dark:placeholder-slate-600
                    focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-400
                    resize-y transition-colors"
                />

                <div className="mt-1.5 text-right">
                  <span className="text-[11px] text-slate-600 dark:text-slate-500">
                    {customInstructions.length}/1000
                  </span>
                </div>
              </div>

              {/* Footer — Reset + Save */}
              <div className="flex items-center justify-end gap-3 mt-6 pt-5 border-t border-slate-200 dark:border-white/[0.06]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setCustomInstructions('');
                    setAIConfig({ responseStyle: 'normal', customInstructions: '' } as any);
                  }}
                  disabled={isSavingInstructions}
                >
                  Reset
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={async () => {
                    await handleSaveInstructions();
                    setIsStyleModalOpen(false);
                  }}
                  loading={isSavingInstructions}
                >
                  {t('common.save', 'Save')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── TTS Settings (inline expandable) ────────────────────────────────────────

const TTSSettings: React.FC<{
  ttsRate: number;
  ttsVoice: string | null;
  availableVoices: SpeechSynthesisVoice[];
  setAIConfig: (cfg: any) => void;
  t: any;
}> = ({ ttsRate, ttsVoice, availableVoices, setAIConfig, t }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3.5 py-2 text-left hover:bg-slate-50/80 dark:hover:bg-white/[0.04] transition-colors"
      >
        <Volume2 size={16} className="shrink-0 text-slate-600 dark:text-slate-500" />
        <span className="flex-1 text-[13px] text-slate-700 dark:text-slate-200">
          {t('aiChat.menu.ttsSettings', 'Voice settings')}
        </span>
        <span className="text-[11px] text-slate-600 dark:text-slate-500">{ttsRate}x</span>
        <ChevronRight
          size={13}
          className={`shrink-0 text-slate-600 dark:text-slate-500 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {expanded && (
        <div className="px-3.5 pb-2 pt-1 space-y-3">
          <div>
            <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 block">
              {t('aiChat.menu.ttsSpeed', 'Speed')} ({ttsRate}x)
            </label>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={ttsRate ?? 1}
              onChange={(e) => setAIConfig({ ttsRate: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-c-focus-solid"
            />
            <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
              <span>0.5x</span>
              <span>1x</span>
              <span>2x</span>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 block">
              {t('aiChat.menu.ttsVoice', 'Voice')}
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
              className="w-full px-2 py-1.5 text-[12px] bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/[0.08] rounded-lg text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none"
            >
              <option value="">{t('aiChat.menu.ttsAutoVoice', 'Auto (detect language)')}</option>
              {availableVoices
                .filter((v) => v.lang.startsWith('pl') || v.lang.startsWith('en'))
                .map((voice) => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name} ({voice.lang})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 block">
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
                { id: 'calm', label: t('aiChat.menu.voiceCalm', 'Calm'), rate: 0.85, pitch: 0.95 },
              ].map((style) => {
                const isActive = (ttsRate ?? 1) === style.rate;
                return (
                  <button
                    key={style.id}
                    onClick={() => {
                      setAIConfig({ ttsRate: style.rate, ttsPitch: style.pitch } as any);
                      toast.success(`${style.label} voice style`, { duration: 1200, icon: '🎙️' });
                    }}
                    className={`px-2 py-1.5 text-[11px] rounded-lg border transition-colors ${
                      isActive
                        ? 'bg-slate-200/70 dark:bg-white/[0.1] border-slate-400 dark:border-white/30 text-slate-900 dark:text-white font-medium'
                        : 'bg-slate-50/60 dark:bg-white/[0.03] border-slate-200/60 dark:border-white/[0.06] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                    }`}
                  >
                    {style.label}
                  </button>
                );
              })}
            </div>
          </div>

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
                  const polishVoice = availableVoices.find((v) => v.lang.startsWith('pl'));
                  if (polishVoice) {
                    utterance.voice = polishVoice;
                    utterance.lang = 'pl-PL';
                  }
                }
                window.speechSynthesis.speak(utterance);
              }
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-[12px] font-medium text-c-text-secondary dark:text-c-text-secondary bg-c-surface-raised dark:bg-c-surface-raised hover:bg-c-surface-hover dark:hover:bg-c-surface-hover rounded-lg transition-colors"
          >
            <Volume2 size={13} />
            {t('aiChat.menu.ttsTest', 'Test voice')}
          </button>
        </div>
      )}
    </div>
  );
};

export default ToolsMenu;
