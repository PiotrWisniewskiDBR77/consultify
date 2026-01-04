/**
 * ChatExportModal
 *
 * Modal for exporting AI chat conversations to various formats.
 */

import { Check, Code, Download, File, FileText, X } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useConversationStore } from '../../store/useConversationStore';

interface ChatExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    conversationId?: string | null;
}

type ExportFormat = 'markdown' | 'txt' | 'json';

const FORMAT_OPTIONS: { id: ExportFormat; label: string; icon: React.ElementType; description: string }[] = [
    { id: 'markdown', label: 'Markdown', icon: FileText, description: 'Formatowany dokument (.md)' },
    { id: 'txt', label: 'Tekst', icon: File, description: 'Czysty tekst (.txt)' },
    { id: 'json', label: 'JSON', icon: Code, description: 'Dane strukturalne (.json)' },
];

export const ChatExportModal: React.FC<ChatExportModalProps> = ({ isOpen, onClose, conversationId }) => {
    const { t } = useTranslation();
    const { activeConversationId } = useConversationStore();
    const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('markdown');
    const [isExporting, setIsExporting] = useState(false);
    const [exportSuccess, setExportSuccess] = useState(false);

    const convId = conversationId || activeConversationId;

    const handleExport = async () => {
        if (!convId) return;

        setIsExporting(true);
        setExportSuccess(false);

        try {
            const response = await fetch(`/api/conversations/${convId}/export/${selectedFormat}`, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
            });

            if (!response.ok) {
                throw new Error('Export failed');
            }

            // Get filename from Content-Disposition header or generate one
            const disposition = response.headers.get('Content-Disposition');
            let filename = `conversation.${selectedFormat === 'markdown' ? 'md' : selectedFormat}`;
            if (disposition) {
                const match = disposition.match(/filename="?([^"]+)"?/);
                if (match) filename = match[1];
            }

            // Download the file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            setExportSuccess(true);
            setTimeout(() => {
                onClose();
                setExportSuccess(false);
            }, 1500);
        } catch (err) {
            console.error('[ChatExport] Error:', err);
        } finally {
            setIsExporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div
                className="
                relative w-full max-w-md mx-4
                bg-white dark:bg-navy-900
                rounded-2xl shadow-2xl
                animate-in fade-in zoom-in-95 duration-200
            "
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-navy-800">
                    <h2 className="text-lg font-semibold text-navy-900 dark:text-white">
                        {t('aiChat.export.title', 'Eksportuj rozmowę')}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4">
                    {!convId ? (
                        <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                            {t('aiChat.export.noConversation', 'Brak aktywnej rozmowy do eksportu')}
                        </p>
                    ) : (
                        <>
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                {t('aiChat.export.selectFormat', 'Wybierz format eksportu:')}
                            </p>

                            {/* Format Options */}
                            <div className="space-y-2">
                                {FORMAT_OPTIONS.map((option) => {
                                    const Icon = option.icon;
                                    const isSelected = selectedFormat === option.id;

                                    return (
                                        <button
                                            key={option.id}
                                            onClick={() => setSelectedFormat(option.id)}
                                            className={`
                                                w-full flex items-center gap-3 p-3 rounded-xl
                                                border-2 transition-all duration-200
                                                ${
                                                    isSelected
                                                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                                        : 'border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600'
                                                }
                                            `}
                                        >
                                            <div
                                                className={`
                                                p-2 rounded-lg
                                                ${
                                                    isSelected
                                                        ? 'bg-primary-500 text-white'
                                                        : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400'
                                                }
                                            `}
                                            >
                                                <Icon size={20} />
                                            </div>
                                            <div className="flex-1 text-left">
                                                <p
                                                    className={`font-medium ${isSelected ? 'text-primary-700 dark:text-primary-300' : 'text-navy-900 dark:text-white'}`}
                                                >
                                                    {option.label}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {option.description}
                                                </p>
                                            </div>
                                            {isSelected && <Check size={20} className="text-primary-500" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                {convId && (
                    <div className="flex gap-3 p-4 border-t border-slate-200 dark:border-navy-800">
                        <button
                            onClick={onClose}
                            className="
                                flex-1 px-4 py-2.5 rounded-xl
                                text-slate-600 dark:text-slate-300
                                hover:bg-slate-100 dark:hover:bg-navy-800
                                transition-colors
                            "
                        >
                            {t('common.cancel', 'Anuluj')}
                        </button>
                        <button
                            onClick={handleExport}
                            disabled={isExporting}
                            className={`
                                flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
                                font-medium transition-all duration-200
                                ${
                                    exportSuccess
                                        ? 'bg-green-500 text-white'
                                        : 'bg-primary-600 hover:bg-primary-500 text-white'
                                }
                                disabled:opacity-50 disabled:cursor-not-allowed
                            `}
                        >
                            {exportSuccess ? (
                                <>
                                    <Check size={18} />
                                    {t('aiChat.export.success', 'Pobrano!')}
                                </>
                            ) : isExporting ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    {t('aiChat.export.exporting', 'Eksportuję...')}
                                </>
                            ) : (
                                <>
                                    <Download size={18} />
                                    {t('aiChat.export.download', 'Pobierz')}
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatExportModal;


