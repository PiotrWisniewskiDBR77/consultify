/**
 * OutputToolSelector — segmented pills above chat input.
 * Lets user choose which module to route the next message to:
 * Auto | Documents | Tables | Presentations.
 */

import { FileSpreadsheet, FileText, Presentation, Sparkles } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '@/store/useAppStore';

type OutputTool = 'auto' | 'wordy' | 'excele' | 'prezentacje';

const TOOLS: Array<{
  id: OutputTool;
  icon: React.ElementType;
  labelKey: string;
  fallback: string;
  fallbackPl: string;
}> = [
  {
    id: 'auto',
    icon: Sparkles,
    labelKey: 'chatOutputTool.auto',
    fallback: 'Auto',
    fallbackPl: 'Auto',
  },
  {
    id: 'wordy',
    icon: FileText,
    labelKey: 'chatOutputTool.documents',
    fallback: 'Documents',
    fallbackPl: 'Dokumenty',
  },
  {
    id: 'excele',
    icon: FileSpreadsheet,
    labelKey: 'chatOutputTool.tables',
    fallback: 'Tables',
    fallbackPl: 'Tabele',
  },
  {
    id: 'prezentacje',
    icon: Presentation,
    labelKey: 'chatOutputTool.presentations',
    fallback: 'Presentations',
    fallbackPl: 'Prezentacje',
  },
];

export const OutputToolSelector: React.FC = () => {
  const { t, i18n } = useTranslation();
  const chatOutputTool = useAppStore((s) => s.chatOutputTool);
  const setChatOutputTool = useAppStore((s) => s.setChatOutputTool);
  const isPolish = (i18n.resolvedLanguage || i18n.language || '').toLowerCase().startsWith('pl');

  return (
    <div className="flex items-center gap-1 mb-2">
      {/* Leading group label so the pills read as OUTPUT routing, not model
          selection — the bare "Auto" pill was being misread as "AI picks the
          best model" (composer audit D1). */}
      <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-500 select-none">
        {t('chatOutputTool.groupLabel', isPolish ? 'Wynik' : 'Output')}
      </span>
      {TOOLS.map((tool) => {
        const Icon = tool.icon;
        const isActive = chatOutputTool === tool.id;
        const label = t(tool.labelKey, isPolish ? tool.fallbackPl : tool.fallback);
        const title =
          tool.id === 'auto'
            ? t(
                'chatOutputTool.autoTooltip',
                isPolish
                  ? 'Auto: Teresa sama wybiera format wyniku (Dokument/Tabela/Prezentacja), gdy pasuje. To NIE jest wybór modelu.'
                  : 'Auto: Teresa routes the output to a Document/Table/Presentation when relevant. This is NOT model selection.'
              )
            : label;
        return (
          <button
            key={tool.id}
            onClick={() => setChatOutputTool(tool.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
              isActive
                ? 'bg-slate-200 dark:bg-white/10 text-c-text border-c-border-strong'
                : 'bg-transparent text-c-text-muted border-c-border-subtle hover:bg-slate-100 dark:hover:bg-white/5 hover:text-c-text'
            }`}
            title={title}
          >
            <Icon size={14} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default OutputToolSelector;
