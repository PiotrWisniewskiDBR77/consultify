import { AlertTriangle, Bug, Lightbulb, Loader2, MessageSquareWarning, Send, X } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../store/useAppStore';

export const FeedbackSidePanel: React.FC = () => {
    const { t } = useTranslation();
    const { currentUser, activeSidePanel, closeSidePanel } = useAppStore();
    const [type, setType] = useState<'BUG' | 'IDEA'>('BUG');
    const [message, setMessage] = useState('');
    const [isCritical, setIsCritical] = useState(false); // Severity state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const isOpen = activeSidePanel === 'FEEDBACK';

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;

        setIsSubmitting(true);
        try {
            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({
                    userId: currentUser?.id || 'anonymous',
                    userEmail: currentUser?.email || 'anonymous',
                    type,
                    message,
                    severity: type === 'BUG' && isCritical ? 'CRITICAL' : 'NORMAL',
                }),
            });

            if (response.ok) {
                setShowSuccess(true);
                setTimeout(() => {
                    setShowSuccess(false);
                    setMessage('');
                    setIsCritical(false);
                    closeSidePanel();
                }, 2000);
            } else {
                console.error('Failed to submit feedback');
            }
        } catch (error) {
            console.error('Error submitting feedback:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40 transition-opacity"
                onClick={closeSidePanel}
            />

            {/* Panel */}
            <div className="fixed right-0 top-0 h-full w-96 max-w-[90vw] bg-white dark:bg-navy-950 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200 border-l border-slate-200 dark:border-white/10">
                {/* Header */}
                <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200 dark:border-white/10 shrink-0 bg-slate-50 dark:bg-navy-900">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <MessageSquareWarning size={18} className="text-amber-500" />
                        {showSuccess ? t('feedback.success.title') : t('feedback.title')}
                    </h2>
                    <button
                        onClick={closeSidePanel}
                        className="w-9 h-9 flex items-center justify-center text-slate-500 hover:text-red-500 dark:text-slate-300 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {showSuccess ? (
                        <div className="flex flex-col items-center justify-center h-full text-center animate-in zoom-in-95">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4 text-green-600 dark:text-green-400">
                                <Send size={32} />
                            </div>
                            <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
                                {t('feedback.success.title')}
                            </h4>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">
                                {t('feedback.success.message')}
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-6 h-full">
                            {/* Intro text */}
                            <p className="text-sm text-slate-600 dark:text-slate-300">{t('feedback.intro')}</p>

                            {/* Type Selector */}
                            <div className="flex bg-slate-100 dark:bg-navy-900 p-1 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => setType('BUG')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${
                                        type === 'BUG'
                                            ? 'bg-white dark:bg-navy-800 text-red-600 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <Bug size={16} />
                                    {t('feedback.type.bug')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setType('IDEA')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all ${
                                        type === 'IDEA'
                                            ? 'bg-white dark:bg-navy-800 text-amber-600 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                    }`}
                                >
                                    <Lightbulb size={16} />
                                    {t('feedback.type.idea')}
                                </button>
                            </div>

                            {/* Critical Toggle (Only for BUG) */}
                            {type === 'BUG' && (
                                <div
                                    onClick={() => setIsCritical(!isCritical)}
                                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                                        isCritical
                                            ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30'
                                            : 'border-transparent hover:bg-slate-50 dark:hover:bg-white/5'
                                    }`}
                                >
                                    <div
                                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                                            isCritical
                                                ? 'bg-red-500 border-red-500'
                                                : 'border-slate-300 dark:border-slate-600'
                                        }`}
                                    >
                                        {isCritical && <X size={14} className="text-white" />}
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-sm font-medium text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                            <AlertTriangle
                                                size={14}
                                                className={isCritical ? 'text-red-500' : 'text-slate-400'}
                                            />
                                            Critical / Blocking Issue
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                            This bug prevents me from working.
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Message Input */}
                            <div className="flex-1 flex flex-col">
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                    {t(type === 'BUG' ? 'feedback.label.bug' : 'feedback.label.idea')}
                                </label>
                                <textarea
                                    className="flex-1 w-full px-4 py-3 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none text-slate-800 dark:text-slate-200 placeholder-slate-400 min-h-[150px]"
                                    placeholder={
                                        type === 'BUG' ? t('feedback.placeholder.bug') : t('feedback.placeholder.idea')
                                    }
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    required
                                />
                            </div>

                            {/* Footer Info & Button */}
                            <div className="mt-auto pt-4 border-t border-slate-100 dark:border-white/5">
                                <div className="text-[10px] text-slate-400 text-center mb-3">
                                    {t('feedback.footer')} <b>{currentUser?.email || 'Anonim'}</b>
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting || !message.trim()}
                                    className={`w-full py-3 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg ${
                                        isCritical
                                            ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20 text-white'
                                            : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 text-white disabled:bg-slate-300 dark:disabled:bg-navy-700'
                                    } disabled:cursor-not-allowed`}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            {t('feedback.submitting')}
                                        </>
                                    ) : (
                                        <>
                                            {isCritical ? 'Submit Critical Bug' : t('feedback.submit')}
                                            <Send size={18} />
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </>
    );
};
