/**
 * ChatHistorySettings - Chat history management
 */

import { Clock, Download, History, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

interface ChatHistorySettingsProps {
  className?: string;
}

export const ChatHistorySettings: React.FC<ChatHistorySettingsProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const [retentionDays, setRetentionDays] = useState(90);
  const [autoDelete, setAutoDelete] = useState(false);

  // ... inside component

  const handleClearHistory = async () => {
    if (
      !confirm(t('settings.chat.clearConfirm', 'Are you sure you want to clear all chat history?'))
    )
      return;

    try {
      await Api.clearChatHistory();
      toast.success(t('settings.chat.cleared', 'Chat history cleared'));
    } catch (_error) {
      toast.error(t('settings.chat.clearError', 'Failed to clear history'));
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
    } catch (_error) {
      toast.error(t('settings.chat.exportError', 'Failed to export history'));
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

      {/* Auto-delete */}
      <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-800/50 rounded-lg">
        <div className="flex items-center gap-3">
          <Clock size={20} className="text-slate-400 dark:text-slate-500" />
          <div>
            <p className="font-medium text-slate-900 dark:text-white">
              {t('settings.chat.autoDelete', 'Auto-delete old conversations')}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t(
                'settings.chat.autoDeleteDesc',
                'Automatically delete conversations after specified days'
              )}
            </p>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={autoDelete}
            onChange={(e) => setAutoDelete(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-11 h-6 bg-slate-200 peer-focus:ring-2 peer-focus:ring-brand rounded-full peer dark:bg-navy-700 peer-checked:after:translate-x-full peer-checked:bg-brand after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
        </label>
      </div>

      {autoDelete && (
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            {t('settings.chat.retentionPeriod', 'Retention Period')}
          </label>
          <select
            value={retentionDays}
            onChange={(e) => setRetentionDays(Number(e.target.value))}
            className="px-3 py-2 border border-slate-300 dark:border-navy-600 rounded-lg bg-white dark:bg-navy-800"
          >
            <option value={30}>30 {t('common.days', 'days')}</option>
            <option value={60}>60 {t('common.days', 'days')}</option>
            <option value={90}>90 {t('common.days', 'days')}</option>
            <option value={180}>180 {t('common.days', 'days')}</option>
            <option value={365}>1 {t('common.year', 'year')}</option>
          </select>
        </div>
      )}

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
          className="flex items-center gap-2 px-4 py-2 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <Trash2 size={16} />
          {t('settings.chat.clear', 'Clear All History')}
        </button>
      </div>
    </div>
  );
};

export default ChatHistorySettings;
