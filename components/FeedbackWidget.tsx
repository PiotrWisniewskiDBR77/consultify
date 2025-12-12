import React, { useState } from 'react';
import { X, MessageSquare, Camera, Check, Loader2 } from 'lucide-react';
import { Api } from '../services/api';
import { useAppStore } from '../store/useAppStore';
import toast from 'react-hot-toast';

export const FeedbackWidget: React.FC = () => {
    const { currentUser } = useAppStore();
    const [isOpen, setIsOpen] = useState(false);
    const [type, setType] = useState('bug');
    const [message, setMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // In a real implementation we might use html2canvas here
    const [includeScreenshot, setIncludeScreenshot] = useState(false);

    if (!currentUser) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;

        setIsSubmitting(true);
        try {
            // Placeholder for screenshot logic
            // const screenshot = includeScreenshot ? await captureScreen() : undefined;

            await Api.sendFeedback({
                user_id: currentUser.id,
                type,
                message,
                url: window.location.href,
                // screenshot 
            });

            toast.success('Feedback sent! Thank you.');
            setIsOpen(false);
            setMessage('');
            setType('bug');
        } catch (error) {
            console.error(error);
            toast.error('Failed to send feedback.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            {/* Trigger Button */}
            <button
                onClick={() => setIsOpen(true)}
                className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-105 ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'} bg-purple-600 text-white hover:bg-purple-700`}
                title="Send Feedback"
            >
                <MessageSquare size={24} />
            </button>

            {/* Modal / Panel */}
            {isOpen && (
                <div className="fixed bottom-6 right-6 z-50 w-80 md:w-96 bg-white dark:bg-navy-800 rounded-xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 fade-in duration-200">
                    <div className="bg-purple-600 p-4 flex items-center justify-between text-white">
                        <div className="font-semibold flex items-center gap-2">
                            <MessageSquare size={18} />
                            Send Feedback
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1 hover:bg-white/20 rounded-full transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
                        <div className="flex gap-2 p-1 bg-slate-100 dark:bg-navy-900 rounded-lg">
                            {['bug', 'feature', 'general'].map(t => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => setType(t)}
                                    className={`flex-1 py-1.5 text-xs font-medium rounded-md capitalize transition-all ${type === t ? 'bg-white dark:bg-navy-800 text-purple-600 shadow-sm' : 'text-slate-500 hover:text-navy-900 dark:hover:text-slate-300'}`}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>

                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Describe your issue or idea..."
                            className="w-full h-32 p-3 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-navy-900 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                            required
                        />

                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={includeScreenshot}
                                    onChange={(e) => setIncludeScreenshot(e.target.checked)}
                                    className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                                />
                                Include screenshot (Coming Soon)
                            </label>
                            <Camera size={14} className="ml-auto opacity-50" />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting || !message.trim()}
                            className="w-full py-2.5 bg-navy-900 dark:bg-white text-white dark:text-navy-900 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    Send Feedback
                                    <Check size={16} />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            )}
        </>
    );
};
