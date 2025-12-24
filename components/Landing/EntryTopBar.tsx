import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../../store/useAppStore';

interface EntryTopBarProps {
    onTrialClick: () => void;
    onDemoClick: () => void;
    onLoginClick: () => void;
    isLoggedIn: boolean;
    hasWorkspace: boolean;
}

export const EntryTopBar: React.FC<EntryTopBarProps> = ({
    onTrialClick,
    onDemoClick,
    onLoginClick,
    isLoggedIn,
    hasWorkspace
}) => {
    const { t, i18n } = useTranslation();
    const [isLangOpen, setIsLangOpen] = useState(false);
    const langRef = useRef<HTMLDivElement>(null);
    const { theme, toggleTheme } = useAppStore();

    const languages = [
        { code: 'en', label: 'English' },
        { code: 'pl', label: 'Polski' },
        { code: 'de', label: 'Deutsch' },
        { code: 'ja', label: '日本語' },
        { code: 'ar', label: 'العربية' },
        { code: 'es', label: 'Español' }
    ];

    const currentLang = languages.find(l => l.code === i18n.language.split('-')[0]) || languages[0];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (langRef.current && !langRef.current.contains(event.target as Node)) {
                setIsLangOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLangChange = (code: string) => {
        i18n.changeLanguage(code);
        setIsLangOpen(false);
    };

    return (
        <header className="fixed top-0 left-0 right-0 h-20 bg-white/70 dark:bg-navy-950/70 backdrop-blur-xl border-b border-white/20 dark:border-white/5 z-[100] transition-colors duration-300">
            <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
                {/* Logo + Brand Name */}
                <div
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => window.location.href = '/'}
                >
                    <img
                        src="/assets/logos/logo-dark.png"
                        alt="DBR77"
                        className="h-8 transition-transform duration-300 group-hover:scale-105"
                    />
                    <span className="text-xl font-black tracking-tight text-navy-950 dark:text-white uppercase font-sans">
                        Consultinity
                    </span>
                </div>

                {/* Center Navigation - Demo & Trial */}
                <nav className="hidden md:flex items-center gap-4 absolute left-1/2 -translate-x-1/2">
                    {/* Demo Button */}
                    <button
                        onClick={onDemoClick}
                        className="min-w-24 px-5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all border border-slate-200 dark:border-white/10 cursor-pointer"
                    >
                        Demo
                    </button>

                    {/* Trial Button */}
                    <button
                        onClick={onTrialClick}
                        className="min-w-24 px-5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all border border-slate-200 dark:border-white/10 cursor-pointer"
                    >
                        Trial
                    </button>
                </nav>

                {/* Right Navigation - Auth & Settings */}
                <div className="hidden md:flex items-center gap-3">
                    {/* Log in Button */}
                    <button
                        onClick={onLoginClick}
                        className="px-5 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all border border-slate-200 dark:border-white/10 cursor-pointer"
                    >
                        Log in
                    </button>

                    {/* Sign up Button */}
                    <button
                        onClick={onTrialClick}
                        className="px-5 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-lg transition-all shadow-lg shadow-purple-500/25 dark:shadow-purple-900/25 cursor-pointer"
                    >
                        Sign up
                    </button>

                    <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-1" />

                    {/* Theme Toggle */}
                    <button
                        onClick={() => toggleTheme(theme === 'dark' ? 'light' : 'dark')}
                        className="p-2 text-slate-600 dark:text-slate-400 hover:text-navy-950 dark:hover:text-white transition-colors"
                        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    >
                        {theme === 'dark' ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                            </svg>
                        )}
                    </button>

                    {/* Language Selector */}
                    <div className="relative" ref={langRef}>
                        <button
                            onClick={() => setIsLangOpen(!isLangOpen)}
                            className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-navy-950 dark:hover:text-white transition-colors py-2"
                        >
                            <Globe size={18} />
                            <span>{currentLang.code.toUpperCase()}</span>
                            <ChevronDown size={14} className={`transition-transform duration-200 ${isLangOpen ? 'rotate-180' : ''}`} />
                        </button>

                        <AnimatePresence>
                            {isLangOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                    className="absolute right-0 mt-2 w-48 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl py-2 z-50 overflow-hidden"
                                >
                                    {languages.map((lang) => (
                                        <button
                                            key={lang.code}
                                            onClick={() => handleLangChange(lang.code)}
                                            className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${i18n.language.startsWith(lang.code)
                                                ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 font-bold'
                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                                                }`}
                                        >
                                            {lang.label}
                                            {i18n.language.startsWith(lang.code) && <div className="w-1.5 h-1.5 rounded-full bg-purple-600" />}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Mobile Menu Toggle (simplified for now) */}
                <button className="md:hidden p-2 text-navy-950 dark:text-white">
                    <Globe size={24} />
                </button>
            </div>
        </header>
    );
};
