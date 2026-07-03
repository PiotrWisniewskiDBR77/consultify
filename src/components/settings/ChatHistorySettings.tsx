/**
 * ChatHistorySettings - Chat history management
 *
 * HONEST-UI NOTE (Harvard R2 #8, 2026-07-02):
 * There is no server backend for bulk chat-history export/clear. The client
 * `Api.clearChatHistory()` was a no-op and `Api.exportChatHistory()` returned an
 * empty stub, so the Export/Clear buttons rendered but did nothing (silent
 * facade). Per the navigation-permissions canon (Honest UI, §4.1) a control that
 * does nothing must not masquerade as a function. Until a real
 * export-all / clear-all conversation endpoint exists (today only per-conversation
 * DELETE /api/conversations/:id is available), the actions are surfaced as an
 * explicit "coming soon" state instead of dead buttons.
 */

import { Clock, Download, History, Trash2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface ChatHistorySettingsProps {
  className?: string;
}

/**
 * When a real bulk export/clear endpoint ships, flip this to `false` and restore
 * the wired handlers (Api.exportChatHistory / Api.clearChatHistory) — the current
 * client methods are stubs and must be replaced first.
 */
const CHAT_HISTORY_ACTIONS_COMING_SOON = true;

export const ChatHistorySettings: React.FC<ChatHistorySettingsProps> = ({ className = '' }) => {
  const { t } = useTranslation();

  return (
    <div className={`space-y-6 ${className}`}>
      <div>
        <h3 className="text-lg font-medium text-slate-900 dark:text-white flex items-center gap-2">
          <History size={20} />
          {t('settings.chat.title', 'Chat History')}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {t('settings.chat.desc', 'Manage your conversation history and data retention.')}
        </p>
      </div>

      {CHAT_HISTORY_ACTIONS_COMING_SOON ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <Clock size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                {t('settings.chat.comingSoonTitle', 'Coming soon')}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {t(
                  'settings.chat.comingSoonDesc',
                  'Exporting and clearing your full conversation history is not available yet. You can delete individual conversations from the chat itself in the meantime.'
                )}
              </p>
            </div>
          </div>

          {/* Disabled affordances so the intent stays visible but honestly inert. */}
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              disabled
              aria-disabled="true"
              title={t('settings.chat.comingSoonTitle', 'Coming soon')}
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-navy-600 rounded-lg opacity-50 cursor-not-allowed"
            >
              <Download size={16} />
              {t('settings.chat.export', 'Export History')}
            </button>
            <button
              type="button"
              disabled
              aria-disabled="true"
              title={t('settings.chat.comingSoonTitle', 'Coming soon')}
              className="flex items-center gap-2 px-4 py-2 border border-danger-300 dark:border-danger-800 text-danger-600 dark:text-danger-400 rounded-lg opacity-50 cursor-not-allowed"
            >
              <Trash2 size={16} />
              {t('settings.chat.clear', 'Clear All History')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default ChatHistorySettings;
