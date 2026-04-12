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

const TOOLS: Array<{ id: OutputTool; icon: React.ElementType; labelKey: string; fallback: string; fallbackPl: string }> = [
  { id: 'auto', icon: Sparkles, labelKey: 'chatOutputTool.auto', fallback: 'Auto', fallbackPl: 'Auto' },
  { id: 'wordy', icon: FileText, labelKey: 'chatOutputTool.documents', fallback: 'Documents', fallbackPl: 'Dokumenty' },
  { id: 'excele', icon: FileSpreadsheet, labelKey: 'chatOutputTool.tables', fallback: 'Tables', fallbackPl: 'Tabele' },
  { id: 'prezentacje', icon: Presentation, labelKey: 'chatOutputTool.presentations', fallback: 'Presentations', fallbackPl: 'Prezentacje' },
];

export const OutputToolSelector: React.FC = () => {
  const { t, i18n } = useTranslation();
  const chatOutputTool = useAppStore((s) => s.chatOutputTool);
  const setChatOutputTool = useAppStore((s) => s.setChatOutputTool);
  const isPolish = (i18n.resolvedLanguage || i18n.language || '').toLowerCase().startsWith('pl');

  return (
    <div className="flex items-center gap-1 mb-2">
      {TOOLS.map((tool) => {
        const Icon = tool.icon;
        const isActive = chatOutputTool === tool.id;
        const label = t(tool.labelKey, isPolish ? tool.fallbackPl : tool.fallback);
        return (
          <button
            key={tool.id}
            onClick={() => setChatOutputTool(tool.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              isActive
                ? 'bg-brand/15 text-brand ring-1 ring-brand/30 dark:bg-brand/20'
                : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
            title={label}
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
