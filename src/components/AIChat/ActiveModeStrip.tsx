import { Brain, Globe2, Lock, Network, ShieldCheck, Users } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../store/useAppStore';

const PRESET_LABELS: Record<string, string> = {
  quick: 'Szybko',
  documents: 'Dokumenty',
  deep_web: 'Deep Web',
  secure_private: 'Prywatnie',
  multi_agent: 'Multi-agent',
  client_ready: 'Client-ready',
};

export const ActiveModeStrip: React.FC = () => {
  const { t } = useTranslation();
  const { aiConfig } = useAppStore();
  const cfg = (aiConfig || {}) as any;

  const chips = [
    {
      key: 'preset',
      label:
        PRESET_LABELS[String(cfg.workModePreset || '')] ||
        t('aiChat.workMode.default', 'Tryb pracy'),
      active: Boolean(cfg.workModePreset),
      icon: ShieldCheck,
    },
    {
      key: 'web',
      label: cfg.webSearch ? 'Web ON' : 'Web OFF',
      active: Boolean(cfg.webSearch),
      icon: Globe2,
    },
    {
      key: 'private',
      label: cfg.privateMode ? 'Private ON' : 'Memory ON',
      active: Boolean(cfg.privateMode),
      icon: Lock,
    },
    {
      key: 'deep',
      label: cfg.deepResearch ? 'Deep ON' : 'Deep OFF',
      active: Boolean(cfg.deepResearch),
      icon: Brain,
    },
    {
      key: 'multi',
      label: cfg.multiAgent ? 'Agents ON' : 'Solo',
      active: Boolean(cfg.multiAgent),
      icon: Users,
    },
    {
      key: 'model',
      label: cfg.selectedTier || cfg.selectedModelId || 'STANDARD',
      active: Boolean(cfg.selectedTier || cfg.selectedModelId),
      icon: Network,
    },
  ];

  return (
    <div
      data-testid="chat-active-mode-strip"
      className="flex flex-wrap items-center gap-1.5 px-3 pb-2"
    >
      {chips.map((chip) => {
        const Icon = chip.icon;
        return (
          <span
            key={chip.key}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
              chip.active
                ? 'border-c-border bg-c-surface-raised text-c-text-secondary dark:border-c-border dark:bg-c-surface-raised dark:text-c-text-secondary'
                : 'border-slate-200 bg-white text-slate-500 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-400'
            }`}
            title={chip.label}
          >
            <Icon size={11} />
            {chip.label}
          </span>
        );
      })}
    </div>
  );
};

export default ActiveModeStrip;
