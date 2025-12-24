import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie, Settings, Check, X } from 'lucide-react';

interface CookiePreferences {
    necessary: boolean;
    functional: boolean;
    analytics: boolean;
    marketing: boolean;
}

const DEFAULT_PREFERENCES: CookiePreferences = {
    necessary: true, // Always true, cannot be changed
    functional: true,
    analytics: false,
    marketing: false
};

export const CookieConsentBanner: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [preferences, setPreferences] = useState<CookiePreferences>(DEFAULT_PREFERENCES);

    // Check if user has already consented
    useEffect(() => {
        const consent = localStorage.getItem('cookie-consent');
        if (!consent) {
            // Delay showing banner for better UX
            const timer = setTimeout(() => setIsOpen(true), 1500);
            return () => clearTimeout(timer);
        } else {
            try {
                const savedPreferences = JSON.parse(consent);
                setPreferences(savedPreferences);
            } catch {
                // Invalid stored data, show banner again
                setIsOpen(true);
            }
        }
    }, []);

    const saveConsent = (prefs: CookiePreferences) => {
        localStorage.setItem('cookie-consent', JSON.stringify(prefs));
        localStorage.setItem('cookie-consent-date', new Date().toISOString());
        setIsOpen(false);

        // Apply preferences (e.g., enable/disable analytics)
        applyPreferences(prefs);
    };

    const applyPreferences = (prefs: CookiePreferences) => {
        // Here you would enable/disable various tracking based on preferences
        if (prefs.analytics) {
            // Enable analytics (e.g., Google Analytics)
            console.log('[Cookies] Analytics enabled');
        } else {
            // Disable analytics
            console.log('[Cookies] Analytics disabled');
        }
        // Similar for other categories
    };

    const acceptAll = () => {
        const allAccepted: CookiePreferences = {
            necessary: true,
            functional: true,
            analytics: true,
            marketing: true
        };
        setPreferences(allAccepted);
        saveConsent(allAccepted);
    };

    const acceptNecessary = () => {
        const necessaryOnly: CookiePreferences = {
            necessary: true,
            functional: false,
            analytics: false,
            marketing: false
        };
        setPreferences(necessaryOnly);
        saveConsent(necessaryOnly);
    };

    const saveCustomPreferences = () => {
        saveConsent(preferences);
    };

    const togglePreference = (key: keyof CookiePreferences) => {
        if (key === 'necessary') return; // Cannot disable necessary cookies
        setPreferences(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    className="fixed bottom-0 left-0 right-0 z-[200] p-4"
                >
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                            {/* Main Banner */}
                            <div className="p-6">
                                <div className="flex flex-col lg:flex-row gap-6 items-start">
                                    {/* Icon */}
                                    <div className="hidden lg:flex w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 items-center justify-center shrink-0">
                                        <Cookie className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-navy-900 dark:text-white mb-2 flex items-center gap-2">
                                            <Cookie className="w-5 h-5 lg:hidden text-purple-600" />
                                            We use cookies
                                        </h3>
                                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                            We use cookies to enhance your experience, analyze traffic, and personalize content.
                                            You can customize your preferences or accept all cookies.{' '}
                                            <a
                                                href="/cookies"
                                                className="text-purple-600 dark:text-purple-400 hover:underline font-medium"
                                            >
                                                Learn more
                                            </a>
                                        </p>
                                    </div>

                                    {/* Buttons */}
                                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0">
                                        <button
                                            onClick={() => setShowDetails(!showDetails)}
                                            className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 
                                                       border border-slate-200 dark:border-white/10 rounded-lg 
                                                       hover:bg-slate-50 dark:hover:bg-white/5 transition-colors
                                                       flex items-center justify-center gap-2"
                                        >
                                            <Settings size={16} />
                                            Customize
                                        </button>
                                        <button
                                            onClick={acceptNecessary}
                                            className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 
                                                       border border-slate-200 dark:border-white/10 rounded-lg 
                                                       hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                        >
                                            Necessary Only
                                        </button>
                                        <button
                                            onClick={acceptAll}
                                            className="px-6 py-2.5 text-sm font-semibold text-white 
                                                       bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors
                                                       shadow-lg shadow-purple-500/25"
                                        >
                                            Accept All
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Preferences Panel */}
                            <AnimatePresence>
                                {showDetails && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="border-t border-slate-200 dark:border-white/10 overflow-hidden"
                                    >
                                        <div className="p-6 bg-slate-50 dark:bg-navy-950/50">
                                            <div className="space-y-4">
                                                {/* Necessary Cookies */}
                                                <CookieCategory
                                                    title="Strictly Necessary"
                                                    description="Essential for the platform to function. Cannot be disabled."
                                                    enabled={preferences.necessary}
                                                    locked={true}
                                                />

                                                {/* Functional Cookies */}
                                                <CookieCategory
                                                    title="Functional"
                                                    description="Remember your preferences like theme and language."
                                                    enabled={preferences.functional}
                                                    onToggle={() => togglePreference('functional')}
                                                />

                                                {/* Analytics Cookies */}
                                                <CookieCategory
                                                    title="Analytics"
                                                    description="Help us understand how you use the platform to improve it."
                                                    enabled={preferences.analytics}
                                                    onToggle={() => togglePreference('analytics')}
                                                />

                                                {/* Marketing Cookies */}
                                                <CookieCategory
                                                    title="Marketing"
                                                    description="Used for personalized advertising. Currently not in use."
                                                    enabled={preferences.marketing}
                                                    onToggle={() => togglePreference('marketing')}
                                                    disabled={true}
                                                />
                                            </div>

                                            {/* Save Button */}
                                            <div className="mt-6 flex justify-end">
                                                <button
                                                    onClick={saveCustomPreferences}
                                                    className="px-6 py-2.5 text-sm font-semibold text-white 
                                                               bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors
                                                               flex items-center gap-2"
                                                >
                                                    <Check size={16} />
                                                    Save Preferences
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

// Cookie Category Component
interface CookieCategoryProps {
    title: string;
    description: string;
    enabled: boolean;
    locked?: boolean;
    disabled?: boolean;
    onToggle?: () => void;
}

const CookieCategory: React.FC<CookieCategoryProps> = ({
    title,
    description,
    enabled,
    locked = false,
    disabled = false,
    onToggle
}) => {
    return (
        <div className={`flex items-center justify-between p-4 rounded-xl bg-white dark:bg-navy-900 
                        border border-slate-200 dark:border-white/10 ${disabled ? 'opacity-50' : ''}`}>
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-navy-900 dark:text-white">{title}</h4>
                    {locked && (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-slate-100 dark:bg-white/10 
                                         text-slate-500 rounded">
                            Required
                        </span>
                    )}
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>
            </div>

            {/* Toggle Switch */}
            <button
                onClick={onToggle}
                disabled={locked || disabled}
                className={`relative w-12 h-7 rounded-full transition-colors ${locked || disabled
                        ? 'cursor-not-allowed'
                        : 'cursor-pointer'
                    } ${enabled
                        ? 'bg-purple-600'
                        : 'bg-slate-300 dark:bg-slate-700'
                    }`}
            >
                <motion.div
                    animate={{ x: enabled ? 22 : 2 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md flex items-center justify-center"
                >
                    {enabled ? (
                        <Check size={12} className="text-purple-600" />
                    ) : (
                        <X size={12} className="text-slate-400" />
                    )}
                </motion.div>
            </button>
        </div>
    );
};

export default CookieConsentBanner;
