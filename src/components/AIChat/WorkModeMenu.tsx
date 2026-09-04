import {
  Check,
  ChevronRight,
  FileText,
  Globe2,
  Lock,
  SlidersHorizontal,
  Users,
  Zap,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../store/useAppStore';

type WorkModePreset =
  | 'quick'
  | 'documents'
  | 'deep_web'
  | 'secure_private'
  | 'multi_agent'
  | 'client_ready';

type PresetConfig = {
  id: WorkModePreset;
  icon: React.ElementType;
  label: string;
  desc: string;
  flags: string[];
};

const PRESETS: PresetConfig[] = [
  {
    id: 'quick',
    icon: Zap,
    label: 'Szybko',
    desc: 'Krótka odpowiedź bez deep research i web.',
    flags: ['Fast', 'No web'],
  },
  {
    id: 'documents',
    icon: FileText,
    label: 'Dokumenty',
    desc: 'Analiza plików i redakcja w profesjonalnym stylu.',
    flags: ['Files', 'Editor'],
  },
  {
    id: 'deep_web',
    icon: Globe2,
    label: 'Deep Web',
    desc: 'Głębokie szukanie z web i widocznym rozumowaniem.',
    flags: ['Deep', 'Web', 'Reasoning'],
  },
  {
    id: 'secure_private',
    icon: Lock,
    label: 'Prywatnie',
    desc: 'Bez web i bez pamięci kontekstowej w tej rozmowie.',
    flags: ['Private', 'No memory'],
  },
  {
    id: 'multi_agent',
    icon: Users,
    label: 'Multi-agent',
    desc: 'Kilka perspektyw i krytyczna walidacja wniosków.',
    flags: ['Web', 'Agents'],
  },
  {
    id: 'client_ready',
    icon: FileText,
    label: 'Client-ready',
    desc: 'Zewnętrzny, executive-ready styl bez notatek wewnętrznych.',
    flags: ['Executive', 'Clean'],
  },
];

interface WorkModeMenuProps {
  disabled?: boolean;
}

export const WorkModeMenu: React.FC<WorkModeMenuProps> = ({ disabled = false }) => {
  const { t } = useTranslation();
  const { aiConfig, setAIConfig } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const activePreset = (aiConfig as any)?.workModePreset as WorkModePreset | null;

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [isOpen]);

  const applyPreset = (preset: WorkModePreset) => {
    switch (preset) {
      case 'quick':
        setAIConfig({
          workModePreset: preset,
          deepResearch: false,
          marketResearch: false,
          webSearch: false,
          showReasoning: false,
          multiAgent: false,
          privateMode: false,
          coThinkerMode: null,
          responseStyle: 'concise',
        } as any);
        break;
      case 'documents':
        setAIConfig({
          workModePreset: preset,
          deepResearch: false,
          marketResearch: false,
          webSearch: false,
          showReasoning: false,
          multiAgent: false,
          privateMode: false,
          responseStyle: 'professional',
          coThinkerMode: 'executive_editor',
        } as any);
        break;
      case 'deep_web':
        setAIConfig({
          workModePreset: preset,
          deepResearch: true,
          marketResearch: false,
          webSearch: true,
          showReasoning: true,
          multiAgent: false,
          privateMode: false,
          responseStyle: 'analyst',
        } as any);
        break;
      case 'secure_private':
        setAIConfig({
          workModePreset: preset,
          deepResearch: false,
          marketResearch: false,
          webSearch: false,
          showReasoning: false,
          multiAgent: false,
          privateMode: true,
          responseStyle: 'concise',
          coThinkerMode: null,
        } as any);
        break;
      case 'multi_agent':
        setAIConfig({
          workModePreset: preset,
          deepResearch: false,
          marketResearch: false,
          webSearch: true,
          showReasoning: true,
          multiAgent: true,
          privateMode: false,
          responseStyle: 'analyst',
        } as any);
        break;
      case 'client_ready':
        setAIConfig({
          workModePreset: preset,
          deepResearch: false,
          marketResearch: false,
          webSearch: false,
          showReasoning: false,
          multiAgent: false,
          privateMode: false,
          responseStyle: 'executive',
          coThinkerMode: 'executive_editor',
        } as any);
        break;
      default:
        break;
    }
    setIsOpen(false);
  };

  const active = PRESETS.find((p) => p.id === activePreset);
  const activeLabel = active?.label || t('aiChat.workMode.default', 'Tryb pracy');

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        disabled={disabled}
        data-testid="chat-workmode-button"
        className={`inline-flex items-center gap-2 px-2.5 py-2 rounded-lg transition-colors ${
          activePreset
            ? 'text-c-text-secondary bg-c-surface-raised dark:bg-c-surface-raised'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'
        } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
        title={t('aiChat.workMode.title', 'Jak Teresa ma teraz pracować')}
      >
        {active?.icon ? <active.icon size={18} /> : <SlidersHorizontal size={18} />}
        <span className="text-xs font-medium max-w-[120px] truncate">{activeLabel}</span>
      </button>

      {isOpen && (
        <div
          className="
            absolute left-0 bottom-full mb-2 z-50
            w-[280px] py-1.5
            bg-white/95 dark:bg-[#1a1d2e]/95 backdrop-blur-xl
            border border-slate-200/40 dark:border-white/[0.08]
            rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)]
            animate-in fade-in-0 slide-in-from-bottom-2 duration-150
          "
        >
          <div className="px-3.5 pt-1.5 pb-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            {t('aiChat.workMode.title', 'Jak Teresa ma teraz pracować')}
          </div>

          {PRESETS.map((preset) => {
            const Icon = preset.icon;
            const active = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset.id)}
                className={`w-full flex items-start gap-3 px-3.5 py-2 text-left transition-colors ${
                  active
                    ? 'bg-c-surface-raised dark:bg-c-surface-raised'
                    : 'hover:bg-slate-50/80 dark:hover:bg-white/[0.04]'
                }`}
              >
                <Icon
                  size={15}
                  className={`mt-0.5 shrink-0 ${
                    active ? 'text-c-text-secondary' : 'text-slate-400 dark:text-slate-500'
                  }`}
                />
                <span className="flex-1">
                  <span
                    className={`block text-[13px] ${
                      active
                        ? 'text-c-text-secondary dark:text-c-text-secondary font-medium'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {preset.label}
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400 leading-4">
                    {preset.desc}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-1">
                    {preset.flags.map((flag) => (
                      <span
                        key={flag}
                        className="rounded-full bg-slate-100 dark:bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-500 dark:text-slate-400"
                      >
                        {flag}
                      </span>
                    ))}
                  </span>
                </span>
                {active ? (
                  <Check size={15} className="shrink-0 text-c-text-secondary mt-0.5" />
                ) : (
                  <ChevronRight size={13} className="shrink-0 text-slate-400 mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WorkModeMenu;
