import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Users, Shield, ArrowRight, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface DemoModeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStartDemo: () => Promise<void>;
    mode: 'demo' | 'trial';
}

export const DemoModeModal: React.FC<DemoModeModalProps> = ({
    isOpen,
    onClose,
    onStartDemo,
    mode
}) => {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState(false);

    const handleStartDemo = async () => {
        setIsLoading(true);
        try {
            await onStartDemo();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                    onClick={onClose}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm" />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ duration: 0.3, ease: 'easeOut' }}
                        className="relative w-full max-w-lg bg-white dark:bg-navy-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Gradient Header */}
                        <div className="relative bg-gradient-to-br from-purple-600 via-indigo-600 to-purple-700 p-8 pb-12">
                            {/* Close Button */}
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors p-2 rounded-full hover:bg-white/10"
                            >
                                <X size={20} />
                            </button>

                            {/* Icon */}
                            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4">
                                <Sparkles size={32} className="text-white" />
                            </div>

                            {/* Title */}
                            <h2 className="text-2xl font-bold text-white mb-2">
                                {mode === 'demo' 
                                    ? t('demo.modal.title', 'Experience Consultinity')
                                    : t('demo.modal.titleTrial', 'Start Your Trial')
                                }
                            </h2>
                            <p className="text-white/80 text-sm">
                                {t('demo.modal.subtitle', 'Explore our AI-powered consulting platform')}
                            </p>
                        </div>

                        {/* Content */}
                        <div className="p-8 -mt-6">
                            {/* Info Card */}
                            <div className="bg-slate-50 dark:bg-navy-800/50 rounded-2xl p-6 border border-slate-200 dark:border-white/10 mb-6">
                                <div className="flex items-start gap-4 mb-4">
                                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <Users size={20} className="text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-navy-900 dark:text-white mb-1">
                                            {t('demo.modal.demoMode', 'Demo Environment')}
                                        </h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            {t('demo.modal.demoDescription', 'You\'ll be logged in as a demo user with full access to explore all features. This is a shared environment for evaluation purposes.')}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                        <Shield size={20} className="text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-navy-900 dark:text-white mb-1">
                                            {t('demo.modal.commercialAccess', 'Want Full Commercial Access?')}
                                        </h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-400">
                                            {t('demo.modal.commercialDescription', 'For production use with your own data and team, please contact our sales team to set up your dedicated environment.')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Demo Credentials Info */}
                            <div className="bg-indigo-50 dark:bg-indigo-500/10 rounded-xl p-4 mb-6 border border-indigo-200 dark:border-indigo-500/20">
                                <p className="text-sm text-indigo-800 dark:text-indigo-300 text-center">
                                    <span className="font-medium">{t('demo.modal.loginAs', 'You will be logged in as:')}</span>
                                    <br />
                                    <code className="text-indigo-600 dark:text-indigo-400 font-mono">demo@legolex.com</code>
                                </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button
                                    onClick={handleStartDemo}
                                    disabled={isLoading}
                                    className="flex-1 py-3 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 size={18} className="animate-spin" />
                                            {t('demo.modal.loading', 'Starting...')}
                                        </>
                                    ) : (
                                        <>
                                            {t('demo.modal.startDemo', 'Enter Demo')}
                                            <ArrowRight size={18} />
                                        </>
                                    )}
                                </button>

                                <a
                                    href="https://meetings.hubspot.com/piotr-wisniewski1?uuid=a2976570-a2d2-4682-9e5f-c3958a7af017"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 py-3 px-6 bg-white dark:bg-navy-800 border-2 border-slate-200 dark:border-white/10 text-navy-900 dark:text-white font-semibold rounded-xl hover:border-purple-300 dark:hover:border-purple-500/30 transition-all text-center"
                                >
                                    {t('demo.modal.contactSales', 'Contact Sales')}
                                </a>
                            </div>

                            {/* Footer Note */}
                            <p className="text-xs text-center text-slate-500 dark:text-slate-400 mt-4">
                                {t('demo.modal.footerNote', 'By entering the demo, you agree to our Terms of Service and Privacy Policy.')}
                            </p>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};








