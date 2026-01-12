/**
 * FeedbackWidget - Floating feedback button and modal
 *
 * Allows users to submit feedback from anywhere in the app.
 * Supports: bug reports, feature requests, improvements, general feedback
 */

import { Bug, Camera, CheckCircle, Lightbulb, MessageSquare, Send, Sparkles, Star, ThumbsUp, X } from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface FeedbackWidgetProps {
    className?: string;
    position?: 'bottom-right' | 'bottom-left';
    userId?: string;
    userEmail?: string;
    userName?: string;
}

type FeedbackType = 'bug' | 'feature' | 'improvement' | 'praise' | 'other';

const feedbackTypeConfig = {
    bug: {
        icon: Bug,
        label: 'Zgłoś błąd',
        color: 'text-red-500',
        bgColor: 'bg-red-100 dark:bg-red-900/30',
        borderColor: 'border-red-200 dark:border-red-800',
    },
    feature: {
        icon: Lightbulb,
        label: 'Zaproponuj funkcję',
        color: 'text-blue-500',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
        borderColor: 'border-blue-200 dark:border-blue-800',
    },
    improvement: {
        icon: Sparkles,
        label: 'Sugestia ulepszenia',
        color: 'text-amber-500',
        bgColor: 'bg-amber-100 dark:bg-amber-900/30',
        borderColor: 'border-amber-200 dark:border-amber-800',
    },
    praise: {
        icon: ThumbsUp,
        label: 'Pochwała',
        color: 'text-green-500',
        bgColor: 'bg-green-100 dark:bg-green-900/30',
        borderColor: 'border-green-200 dark:border-green-800',
    },
    other: {
        icon: MessageSquare,
        label: 'Inny feedback',
        color: 'text-slate-500',
        bgColor: 'bg-slate-100 dark:bg-slate-800',
        borderColor: 'border-slate-200 dark:border-slate-700',
    },
};

export const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({
    className = '',
    position = 'bottom-right',
    userId,
    userEmail,
    userName,
}) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [step, setStep] = useState<'type' | 'message' | 'success'>('type');
    const [selectedType, setSelectedType] = useState<FeedbackType | null>(null);
    const [message, setMessage] = useState('');
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [sending, setSending] = useState(false);
    const [includeScreenshot, setIncludeScreenshot] = useState(false);

    const positionClasses = position === 'bottom-right' ? 'right-6 bottom-20' : 'left-6 bottom-20';

    const resetForm = () => {
        setStep('type');
        setSelectedType(null);
        setMessage('');
        setRating(0);
        setHoverRating(0);
        setIncludeScreenshot(false);
    };

    const handleClose = () => {
        setIsOpen(false);
        setTimeout(resetForm, 300); // Reset after animation
    };

    const handleTypeSelect = (type: FeedbackType) => {
        setSelectedType(type);
        setStep('message');
    };

    const handleSubmit = async () => {
        if (!selectedType || !message.trim()) return;

        setSending(true);
        try {
            const metadata = {
                browser: navigator.userAgent,
                page: window.location.pathname,
                timestamp: new Date().toISOString(),
                screenWidth: window.innerWidth,
                screenHeight: window.innerHeight,
            };

            const response = await fetch('/api/feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
                body: JSON.stringify({
                    userId,
                    userEmail,
                    userName,
                    type: selectedType,
                    message,
                    rating: rating > 0 ? rating : undefined,
                    metadata,
                }),
            });

            if (response.ok) {
                setStep('success');
                toast.success(t('feedback.submitted', 'Dziękujemy za feedback!'));
            } else {
                throw new Error('Failed to submit feedback');
            }
        } catch (error) {
            console.error('Feedback submission error:', error);
            toast.error(t('feedback.error', 'Nie udało się wysłać feedbacku'));
        } finally {
            setSending(false);
        }
    };

    return (
        <>
            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(true)}
                className={`
          fixed ${positionClasses} z-40
          w-12 h-12 rounded-full bg-gradient-to-br from-brand to-brand-dark
          text-white shadow-lg hover:shadow-xl hover:scale-105
          transition-all duration-200 flex items-center justify-center
          ${className}
        `}
                title={t('feedback.sendFeedback', 'Wyślij feedback')}
            >
                <MessageSquare size={22} />
            </button>

            {/* Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div
                        className="bg-white dark:bg-navy-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-5 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-brand/10 rounded-lg">
                                    <MessageSquare size={20} className="text-brand" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-900 dark:text-white">
                                        {step === 'success'
                                            ? t('feedback.thankYou', 'Dziękujemy!')
                                            : t('feedback.title', 'Twój feedback')}
                                    </h3>
                                    <p className="text-xs text-slate-500">
                                        {step === 'type' && t('feedback.selectType', 'Wybierz typ zgłoszenia')}
                                        {step === 'message' && t('feedback.writeMessage', 'Opisz swoje zgłoszenie')}
                                        {step === 'success' && t('feedback.received', 'Otrzymaliśmy Twoje zgłoszenie')}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleClose}
                                className="p-2 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
                            >
                                <X size={18} className="text-slate-500" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-5">
                            {/* Step 1: Select Type */}
                            {step === 'type' && (
                                <div className="grid grid-cols-2 gap-3">
                                    {(
                                        Object.entries(feedbackTypeConfig) as [
                                            FeedbackType,
                                            typeof feedbackTypeConfig.bug,
                                        ][]
                                    ).map(([type, config]) => {
                                        const Icon = config.icon;
                                        return (
                                            <button
                                                key={type}
                                                onClick={() => handleTypeSelect(type)}
                                                className={`
                          p-4 rounded-xl border-2 ${config.borderColor}
                          ${config.bgColor} hover:scale-[1.02]
                          transition-all duration-200 text-left
                        `}
                                            >
                                                <Icon size={24} className={config.color} />
                                                <p className="mt-2 font-medium text-slate-900 dark:text-white text-sm">
                                                    {config.label}
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Step 2: Write Message */}
                            {step === 'message' && selectedType && (
                                <div className="space-y-4">
                                    {/* Selected Type Badge */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setStep('type')}
                                            className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                        >
                                            ← {t('feedback.changeType', 'Zmień typ')}
                                        </button>
                                        <span
                                            className={`
                      px-2 py-1 rounded-full text-xs font-medium
                      ${feedbackTypeConfig[selectedType].bgColor}
                      ${feedbackTypeConfig[selectedType].color}
                    `}
                                        >
                                            {feedbackTypeConfig[selectedType].label}
                                        </span>
                                    </div>

                                    {/* Message Input */}
                                    <div>
                                        <textarea
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            placeholder={
                                                selectedType === 'bug'
                                                    ? t(
                                                          'feedback.placeholder.bug',
                                                          'Opisz błąd - co robiłeś, co się stało, czego oczekiwałeś...',
                                                      )
                                                    : selectedType === 'feature'
                                                      ? t(
                                                            'feedback.placeholder.feature',
                                                            'Opisz funkcję, którą chciałbyś zobaczyć...',
                                                        )
                                                      : t(
                                                            'feedback.placeholder.general',
                                                            'Podziel się swoimi przemyśleniami...',
                                                        )
                                            }
                                            rows={5}
                                            className="w-full px-4 py-3 border border-slate-200 dark:border-navy-600 rounded-xl bg-white dark:bg-navy-800 resize-none focus:ring-2 focus:ring-brand focus:border-transparent"
                                        />
                                        <p className="mt-1 text-xs text-slate-400 text-right">{message.length}/1000</p>
                                    </div>

                                    {/* Rating (optional) */}
                                    <div>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                            {t('feedback.rateExperience', 'Oceń swoje doświadczenie (opcjonalne)')}
                                        </p>
                                        <div className="flex gap-1">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <button
                                                    key={star}
                                                    onMouseEnter={() => setHoverRating(star)}
                                                    onMouseLeave={() => setHoverRating(0)}
                                                    onClick={() => setRating(star === rating ? 0 : star)}
                                                    className="p-1 transition-transform hover:scale-110"
                                                >
                                                    <Star
                                                        size={28}
                                                        className={`transition-colors ${
                                                            star <= (hoverRating || rating)
                                                                ? 'text-amber-400 fill-amber-400'
                                                                : 'text-slate-300 dark:text-slate-600'
                                                        }`}
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Submit Button */}
                                    <button
                                        onClick={handleSubmit}
                                        disabled={!message.trim() || sending}
                                        className="w-full py-3 bg-gradient-to-r from-brand to-brand-dark text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
                                    >
                                        {sending ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                {t('feedback.sending', 'Wysyłanie...')}
                                            </>
                                        ) : (
                                            <>
                                                <Send size={18} />
                                                {t('feedback.send', 'Wyślij feedback')}
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Step 3: Success */}
                            {step === 'success' && (
                                <div className="text-center py-6">
                                    <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                                        <CheckCircle size={32} className="text-green-500" />
                                    </div>
                                    <h4 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                                        {t('feedback.successTitle', 'Feedback wysłany!')}
                                    </h4>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
                                        {t(
                                            'feedback.successMessage',
                                            'Twój feedback został przesłany do naszego zespołu. Dziękujemy za pomoc w ulepszaniu aplikacji!',
                                        )}
                                    </p>
                                    <button
                                        onClick={handleClose}
                                        className="px-6 py-2 bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
                                    >
                                        {t('common.close', 'Zamknij')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default FeedbackWidget;
