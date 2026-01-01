import React, { useState } from 'react';
import { Mail, AlertCircle, CheckCircle, Loader2, X, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Api } from '../../services/api';
import { toast } from 'react-hot-toast';
import { User } from '../../types';

interface EmailVerificationBannerProps {
    currentUser: User;
    onDismiss?: () => void;
    variant?: 'banner' | 'inline' | 'card';
    className?: string;
}

export const EmailVerificationBanner: React.FC<EmailVerificationBannerProps> = ({
    currentUser,
    onDismiss,
    variant = 'banner',
    className = ''
}) => {
    const { t } = useTranslation();
    const [isSending, setIsSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);

    // Don't show if email is already verified
    if (currentUser.emailVerified || isDismissed) return null;

    const handleResendVerification = async () => {
        setIsSending(true);
        try {
            await Api.resendVerificationEmail();
            setSent(true);
            toast.success(t('auth.verificationSent', 'Verification email sent! Check your inbox.'));
        } catch (error: any) {
            toast.error(error.message || t('auth.verificationSendFailed', 'Failed to send verification email'));
        } finally {
            setIsSending(false);
        }
    };

    const handleDismiss = () => {
        setIsDismissed(true);
        onDismiss?.();
    };

    if (variant === 'inline') {
        return (
            <div className={`flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 ${className}`}>
                <AlertCircle className="w-4 h-4" />
                <span>{t('auth.verifyEmail', 'Please verify your email')}</span>
                <button
                    onClick={handleResendVerification}
                    disabled={isSending || sent}
                    className="font-medium underline hover:no-underline disabled:opacity-50"
                >
                    {sent ? t('auth.sent', 'Sent!') : t('auth.resend', 'Resend')}
                </button>
            </div>
        );
    }

    if (variant === 'card') {
        return (
            <div className={`bg-white dark:bg-navy-900 rounded-2xl border border-amber-200 dark:border-amber-500/30 overflow-hidden ${className}`}>
                <div className="h-1.5 bg-gradient-to-r from-amber-400 to-orange-400" />
                <div className="p-6">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white flex-shrink-0">
                            <Mail className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 dark:text-white">
                                {t('auth.verifyEmailTitle', 'Verify your email address')}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                {t('auth.verifyEmailDescription', 'We sent a verification link to {{email}}. Please check your inbox and click the link to verify.', { email: currentUser.email })}
                            </p>
                            <div className="mt-4 flex items-center gap-3">
                                <button
                                    onClick={handleResendVerification}
                                    disabled={isSending || sent}
                                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                                >
                                    {isSending ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            {t('auth.sending', 'Sending...')}
                                        </>
                                    ) : sent ? (
                                        <>
                                            <CheckCircle className="w-4 h-4" />
                                            {t('auth.emailSent', 'Email Sent!')}
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4" />
                                            {t('auth.resendEmail', 'Resend Email')}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Default: banner variant
    return (
        <div className={`relative overflow-hidden rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-900/20 ${className}`}>
            <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                        <Mail className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <p className="font-medium text-amber-900 dark:text-amber-200">
                            {t('auth.verifyEmailTitle', 'Verify your email address')}
                        </p>
                        <p className="text-sm text-amber-700 dark:text-amber-400">
                            {t('auth.checkInbox', 'Check your inbox for the verification link')}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleResendVerification}
                        disabled={isSending || sent}
                        className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : sent ? (
                            <CheckCircle className="w-4 h-4" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                        {sent ? t('auth.sent', 'Sent!') : t('auth.resend', 'Resend')}
                    </button>
                    <button
                        onClick={handleDismiss}
                        className="p-2 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-800/30 transition-colors"
                    >
                        <X className="w-4 h-4 text-amber-700 dark:text-amber-400" />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EmailVerificationBanner;


