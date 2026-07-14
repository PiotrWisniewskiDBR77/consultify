/**
 * CoThinkerMenu
 *
 * Dedicated Co-Thinker selector button for chat input (T006).
 * Mirrors "agent modes" UX: choose a persona, show active persona at the bottom.
 *
 * Internally maps personas to:
 * - `aiConfig.coThinkerMode` (backend system prompt injection)
 * - `aiConfig.marketResearch` (Market Researcher persona)
 */
import { BarChart3, Check, FileText, Lightbulb, Search, ShieldCheck, Users, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../store/useAppStore';

type CoThinkerPersona =
  | 'consultant'
  | 'idea_creator'
  | 'analyst'
  | 'auditor'
  | 'editor'
  | 'market_researcher';

const PERSONAS: Array<{
  id: CoThinkerPersona;
  icon: React.ElementType;
  labelKey: string;
  fallbackLabel: string;
  descKey: string;
  fallbackDesc: string;
  mapToCoThinkerMode?:
    | 'multi_consultant'
    | 'idea_maker'
    | 'competitive_analyst'
    | 'risk_challenger'
    | 'executive_editor'
    | 'market_researcher';
}> = [
  {
    id: 'consultant',
    icon: Users,
    labelKey: 'chat.coThinker.personas.consultant',
    fallbackLabel: 'Consultant',
    descKey: 'chat.coThinker.personas.consultantDesc',
    fallbackDesc: 'Broad strategy framing and decision-ready recommendations.',
    mapToCoThinkerMode: 'multi_consultant',
  },
  {
    id: 'idea_creator',
    icon: Lightbulb,
    labelKey: 'chat.coThinker.personas.ideaCreator',
    fallbackLabel: 'Idea Creator',
    descKey: 'chat.coThinker.personas.ideaCreatorDesc',
    fallbackDesc: 'Generates options, variants, and creative solution pathways.',
    mapToCoThinkerMode: 'idea_maker',
  },
  {
    id: 'analyst',
    icon: BarChart3,
    labelKey: 'chat.coThinker.personas.analyst',
    fallbackLabel: 'Analyst',
    descKey: 'chat.coThinker.personas.analystDesc',
    fallbackDesc: 'Evaluates assumptions, metrics, and comparative scenarios.',
    mapToCoThinkerMode: 'competitive_analyst',
  },
  {
    id: 'auditor',
    icon: ShieldCheck,
    labelKey: 'chat.coThinker.personas.auditor',
    fallbackLabel: 'Auditor',
    descKey: 'chat.coThinker.personas.auditorDesc',
    fallbackDesc: 'Challenges risk, compliance, and evidence gaps.',
    mapToCoThinkerMode: 'risk_challenger',
  },
  {
    id: 'editor',
    icon: FileText,
    labelKey: 'chat.coThinker.personas.editor',
    fallbackLabel: 'Editor',
    descKey: 'chat.coThinker.personas.editorDesc',
    fallbackDesc: 'Improves structure, clarity, and executive readability.',
    mapToCoThinkerMode: 'executive_editor',
  },
  {
    id: 'market_researcher',
    icon: Search,
    labelKey: 'chat.coThinker.personas.marketResearcher',
    fallbackLabel: 'Market Researcher',
    descKey: 'chat.coThinker.personas.marketResearcherDesc',
    fallbackDesc: 'Prioritizes web-backed market signals and external context.',
    mapToCoThinkerMode: 'market_researcher',
  },
];

function resolveActivePersona(aiConfig: any): CoThinkerPersona | null {
  const mode = String(aiConfig?.coThinkerMode || '').trim();
  if (mode) {
    const found = PERSONAS.find((p) => p.mapToCoThinkerMode === mode);
    if (found) return found.id;
  }
  if (aiConfig?.marketResearch) return 'market_researcher';
  return null;
}

function personaLabel(t: any, persona: CoThinkerPersona): string {
  const cfg = PERSONAS.find((p) => p.id === persona);
  if (!cfg) return String(persona);
  return t(cfg.labelKey, cfg.fallbackLabel);
}

export const CoThinkerActivePill: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t } = useTranslation();
  const { aiConfig, setAIConfig } = useAppStore();
  const active = resolveActivePersona(aiConfig);

  if (!active) return null;

  return (
    <div
      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white/70 dark:bg-navy-900/40 ${className}`}
      data-testid="cothinker-active-pill"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {t('chat.coThinker.title', 'Co-Thinker')}
        </span>
        <span className="text-xs text-slate-700 dark:text-slate-200 truncate">
          {t('chat.coThinker.active', 'Active')}:{' '}
          <span className="font-medium">{personaLabel(t, active)}</span>
        </span>
      </div>
      <button
        onClick={() => setAIConfig({ coThinkerMode: null, marketResearch: false } as any)}
        className="shrink-0 inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-600 dark:hover:text-slate-300"
        title={t('chat.coThinker.clear', 'Clear')}
        aria-label={t('chat.coThinker.clear', 'Clear')}
      >
        <X size={14} />
        {t('chat.coThinker.clear', 'Clear')}
      </button>
    </div>
  );
};

export const CoThinkerMenu: React.FC<{
  disabled?: boolean;
  className?: string;
  icon?: React.ElementType;
}> = ({ disabled = false, className = '', icon: TriggerIcon = Users }) => {
  const { t } = useTranslation();
  const { aiConfig, setAIConfig } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const activePersona = useMemo(() => resolveActivePersona(aiConfig), [aiConfig]);
  const activeLabel = useMemo(
    () => (activePersona ? personaLabel(t, activePersona) : ''),
    [activePersona, t]
  );

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const applyPersona = (persona: CoThinkerPersona) => {
    const isActive = activePersona === persona;
    if (isActive) {
      setAIConfig({ coThinkerMode: null, marketResearch: false } as any);
      return;
    }

    if (persona === 'market_researcher') {
      // C6: Market Researcher now uses the same coThinkerMode system-prompt
      // mechanism as the other 5 personas (symmetric), AND keeps the live-web
      // flags as a secondary effect so answers stay grounded in real data.
      setAIConfig({
        coThinkerMode: 'market_researcher',
        marketResearch: true,
        webSearch: true,
      } as any);
      return;
    }

    const cfg = PERSONAS.find((p) => p.id === persona);
    setAIConfig({
      coThinkerMode: cfg?.mapToCoThinkerMode || null,
      // keep persona mutually exclusive with market research mode
      marketResearch: false,
    } as any);
  };

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button
        ref={triggerRef}
        onClick={() => setIsOpen((v) => !v)}
        disabled={disabled}
        data-testid="chat-cothinker-button"
        className={`
          relative inline-flex items-center gap-2 rounded-lg transition-colors
          ${activePersona ? 'px-2.5 py-2' : 'p-2'}
          ${
            activePersona
              ? 'text-primary-500 bg-primary-50 dark:bg-primary-900/30'
              : 'text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
          }
          ${disabled ? 'cursor-not-allowed opacity-50' : ''}
        `}
        title={
          activePersona
            ? `${t('chat.coThinker.title', 'Co-Thinker')}: ${activeLabel}`
            : t('chat.coThinker.title', 'Co-Thinker')
        }
        aria-label={
          activePersona
            ? `${t('chat.coThinker.title', 'Co-Thinker')}: ${activeLabel}`
            : t('chat.coThinker.title', 'Co-Thinker')
        }
      >
        <TriggerIcon size={20} />
        {activePersona && (
          <span
            className="text-xs font-medium truncate max-w-[140px]"
            data-testid="chat-cothinker-active-label"
          >
            {activeLabel}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="
            absolute left-0 bottom-full mb-2 z-50
            w-[250px] py-1.5
            bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl
            border border-slate-200/40 dark:border-white/[0.08]
            rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]
            animate-in fade-in-0 slide-in-from-bottom-2 duration-150
          "
          role="menu"
          aria-label={t('chat.coThinker.title', 'Co-Thinker')}
        >
          <div className="px-3.5 pt-1.5 pb-1">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-500 uppercase tracking-wider">
              {t('chat.coThinker.title', 'Co-Thinker')}
            </span>
          </div>
          {PERSONAS.map((p) => {
            const Icon = p.icon;
            const isActive = activePersona === p.id;
            const label = t(p.labelKey, p.fallbackLabel);
            return (
              <button
                key={p.id}
                onClick={() => {
                  applyPersona(p.id);
                  setIsOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-3.5 py-2 text-left transition-colors
                  ${
                    isActive
                      ? 'bg-slate-100 dark:bg-white/[0.07]'
                      : 'hover:bg-slate-50/80 dark:hover:bg-white/[0.04]'
                  }
                `}
                role="menuitem"
              >
                <Icon
                  size={16}
                  className={`shrink-0 ${isActive ? 'text-slate-700 dark:text-slate-200' : 'text-slate-600 dark:text-slate-500'}`}
                />
                <span
                  className={`flex-1 min-w-0 text-[13px] ${
                    isActive
                      ? 'text-slate-900 dark:text-white font-medium'
                      : 'text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {label}
                </span>
                {isActive && (
                  <Check size={16} className="shrink-0 text-slate-700 dark:text-slate-200" />
                )}
              </button>
            );
          })}
          {activePersona && (
            <>
              <div className="mx-3 my-1 border-t border-slate-200 dark:border-white/[0.06]" />
              <button
                onClick={() => {
                  setAIConfig({ coThinkerMode: null, marketResearch: false } as any);
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 px-3.5 py-2 text-[12px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50/80 dark:hover:bg-white/[0.04] transition-colors"
              >
                <X size={13} />
                {t('chat.coThinker.clear', 'Clear')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CoThinkerMenu;
