import { Download, FileJson, FileText, X } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '../ui';

interface ChatExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport?: (format: 'pdf' | 'json' | 'txt') => void;
  title?: string;
}

export const ChatExportModal: React.FC<ChatExportModalProps> = ({
  isOpen,
  onClose,
  onExport,
  title,
}) => {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleExport = async (format: 'pdf' | 'json' | 'txt') => {
    if (!onExport) return;
    setIsExporting(true);
    try {
      await onExport(format);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-navy-700">
          <h3 className="font-bold text-navy-900 dark:text-white">
            {t('aiChat.export.title', 'Export Conversation')}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            {t(
              'aiChat.export.description',
              'Choose which format you want to export your strategy session as.'
            )}
          </p>

          <button
            onClick={() => handleExport('pdf')}
            disabled={isExporting}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400">
                <Download size={20} />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  PDF Document
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Professional strategy report
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleExport('json')}
            disabled={isExporting}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <FileJson size={20} />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  JSON Data
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Raw data for developers
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={() => handleExport('txt')}
            disabled={isExporting}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                <FileText size={20} />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  Text File
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Plain text transcript
                </div>
              </div>
            </div>
          </button>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-b-2xl">
          <Button variant="outline" fullWidth onClick={onClose} disabled={isExporting}>
            {t('common.cancel', 'Cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatExportModal;
