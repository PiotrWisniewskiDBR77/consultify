/**
 * ChatHistorySettings - Chat history management
 */

import { Download, History, Trash2 } from 'lucide-react';
import React from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

interface ChatHistorySettingsProps {
  className?: string;
}

const extractErrorCode = (error: unknown): string | null => {
  const maybe = error as { data?: { code?: string } };
  return typeof maybe?.data?.code === 'string' ? maybe.data.code : null;
};

export const ChatHistorySettings: React.FC<ChatHistorySettingsProps> = ({ className = '' }) => {
  const { t } = useTranslation();

  const handleClearHistory = async () => {
    if (
      !confirm(t('settings.chat.clearConfirm', 'Are you sure you want to clear all chat history?'))
    )
      return;

    try {
      await Api.clearChatHistory();
      toast.success(t('settings.chat.cleared', 'Chat history cleared'));
    } catch (error) {
      const fallback = t('settings.chat.clearError', 'Failed to clear history');
      const code = extractErrorCode(error);
      toast.error(code ? `${fallback} (${code})` : fallback);
    }
  };

  const handleExportHistory = async () => {
    try {
      const blob = await Api.exportChatHistory();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chat-history.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      const fallback = t('settings.chat.exportError', 'Failed to export history');
      const code = extractErrorCode(error);
      toast.error(code ? `${fallback} (${code})` : fallback);
    }
  };

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

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleExportHistory}
          className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-navy-600 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors"
        >
          <Download size={16} />
          {t('settings.chat.export', 'Export History')}
        </button>
        <button
          onClick={handleClearHistory}
          className="flex items-center gap-2 px-4 py-2 border border-danger-300 dark:border-danger-800 text-danger-600 dark:text-danger-400 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
        >
          <Trash2 size={16} />
          {t('settings.chat.clear', 'Clear All History')}
        </button>
      </div>
    </div>
  );
};

export default ChatHistorySettings;
