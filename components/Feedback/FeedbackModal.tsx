import React, { useState } from 'react';
import { X, Send, Bug, Lightbulb, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppStore } from '../../store/useAppStore';

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose }) => {
    const { t } = useTranslation();
    const { currentUser } = useAppStore();
    const [type, setType] = useState<'BUG' | 'IDEA'>('BUG');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

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
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    userId: currentUser?.id || 'anonymous',
                    userEmail: currentUser?.email || 'anonymous',
                    type,
                    message
                })
            });

            if (response.ok) {
                setShowSuccess(true);
                setTimeout(() => {
                    setShowSuccess(false);
                    setMessage('');
                    onClose();
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-navy-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-navy-700 flex flex-col">

                {/* Header */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-navy-900 border-b border-slate-100 dark:border-navy-700 flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        {type === 'BUG' ? <Bug size={20} className="text-red-500" /> : <Lightbulb size={20} className="text-amber-500" />}
                        {showSuccess ? 'Dziękujemy!' : 'Prześlij Feedback'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    {showSuccess ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center animate-in zoom-in-95">
                            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4 text-green-600 dark:text-green-400">
                                <Send size={32} />
                            </div>
                            <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Wiadomość wysłana!</h4>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">
                                Dziękujemy za Twoją opinię. Przeanalizujemy ją najszybciej jak to możliwe.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            {/* Type Selector */}
                            <div className="flex bg-slate-100 dark:bg-navy-900 p-1 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => setType('BUG')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${type === 'BUG'
                                            ? 'bg-white dark:bg-navy-800 text-red-600 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                        }`}
                                >
                                    <Bug size={16} />
                                    Błąd
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setType('IDEA')}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all ${type === 'IDEA'
                                            ? 'bg-white dark:bg-navy-800 text-amber-600 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                        }`}
                                >
                                    <Lightbulb size={16} />
                                    Pomysł
                                </button>
                            </div>

                            {/* Message Input */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                    Opis {type === 'BUG' ? 'błędu' : 'pomysłu'}
                                </label>
                                <textarea
                                    className="w-full h-32 px-4 py-3 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none text-slate-800 dark:text-slate-200 placeholder-slate-400"
                                    placeholder={type === 'BUG' ? "Opisz co nie działa i jak to odtworzyć..." : "Opisz swój pomysł na usprawnienie..."}
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    required
                                />
                            </div>

                            {/* Footer Info */}
                            <div className="text-[10px] text-slate-400 text-center">
                                Zgłoszenie zostanie wysłane jako <b>{currentUser?.email || 'Anonim'}</b>
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={isSubmitting || !message.trim()}
                                className="mt-2 w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-navy-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Wysyłanie...
                                    </>
                                ) : (
                                    <>
                                        Wyślij
                                        <Send size={18} />
                                    </>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};
