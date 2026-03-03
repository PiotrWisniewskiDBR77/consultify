import { Loader2, MessageSquareWarning } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ToolsPanelShell } from '@/components/shared/WorkspaceTools';

interface IdeaAISuggestionsPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  onSendToChat?: () => void;
}

export const IdeaAISuggestionsPanel: React.FC<IdeaAISuggestionsPanelProps> = ({
  open,
  onClose,
  title,
  onSendToChat,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [loading, setLoading] = useState(false);

  const subtitle = useMemo(() => (isPl ? 'Sugestie AI' : 'AI suggestions'), [isPl]);

  useEffect(() => {
    if (!open) return;
    setLoading(false);
  }, [open]);

  if (!open) return null;

  return (
    <ToolsPanelShell
      title={isPl ? 'Sugestie AI' : 'AI suggestions'}
      subtitle={subtitle}
      icon={
        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center">
          <MessageSquareWarning size={14} className="text-slate-600 dark:text-slate-300" />
        </div>
      }
      onClose={onClose}
    >
      <div className="px-3 py-3 border-b border-slate-200/30 dark:border-white/[0.04]">
        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
          {title || (isPl ? 'Wyzwanie' : 'Idea')}
        </div>
      </div>

      <div className="px-3 py-4">
        {loading ? (
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 px-1 py-2">
            <Loader2 size={14} className="animate-spin text-slate-400" />
            {isPl ? 'Wczytuję…' : 'Loading…'}
          </div>
        ) : (
          <>
            <div className="text-[11px] text-slate-600 dark:text-slate-400">
              {isPl
                ? 'W tej iteracji sugestie AI są dostępne przez czat w kontekście bieżącego wyzwania.'
                : 'In this iteration, AI suggestions are available via chat in the context of the current idea.'}
            </div>
            {onSendToChat ? (
              <button
                onClick={onSendToChat}
                className="mt-3 w-full rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 px-3 py-2 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
              >
                {isPl ? 'Wyślij do czatu' : 'Send to chat'}
              </button>
            ) : null}
          </>
        )}
      </div>
    </ToolsPanelShell>
  );
};

export default IdeaAISuggestionsPanel;

