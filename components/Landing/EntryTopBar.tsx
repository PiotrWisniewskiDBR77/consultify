import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ChevronDown, Monitor, Rocket, LogIn, Headset } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface EntryTopBarProps {
    onLoginClick: () => void;
    onTrialClick: () => void;
    onDemoClick: () => void;
    onExpertClick: () => void;
    isLoggedIn: boolean;
    hasWorkspace: boolean;
}

export const EntryTopBar: React.FC<EntryTopBarProps> = ({
    onLoginClick,
    onTrialClick,
    onDemoClick,
    onExpertClick,
    isLoggedIn,
    hasWorkspace
}) => {
    const { t, i18n } = useTranslation();
    const [isLangOpen, setIsLangOpen] = useState(false);
    const langRef = useRef<HTMLDivElement>(null);

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
                {/* Logo */}
                <div
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => window.location.href = '/'}
                >
                    <div className="w-9 h-9 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20 group-hover:scale-105 group-hover:rotate-3 transition-all duration-300">
                        <span className="text-white font-black text-sm tracking-tighter">CT</span>
                    </div>
                    <span className="text-lg font-black tracking-tight text-navy-950 dark:text-white uppercase font-sans">
                        Consultinity
                    </span>
                </div>

                {/* Navigation */}
                <nav className="hidden md:flex items-center gap-8">
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

                    <button
                        onClick={onDemoClick}
                        className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-navy-950 dark:hover:text-white transition-colors"
                    >
                        <Monitor size={18} />
                        Explore Demo
                    </button>

                    <button
                        onClick={onExpertClick}
                        className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-navy-950 dark:hover:text-white transition-colors"
                    >
                        <Headset size={18} />
                        Talk to Expert
                    </button>

                    <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-2" />

                    {!isLoggedIn ? (
                        <>
                            <button
                                onClick={onLoginClick}
                                className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-navy-950 dark:hover:text-white transition-colors"
                            >
                                <LogIn size={18} />
                                Log in
                            </button>
                            <button
                                onClick={onTrialClick}
                                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-full transition-all shadow-lg shadow-purple-500/20 hover:scale-105 active:scale-95 flex items-center gap-2"
                            >
                                <Rocket size={18} />
                                Start Trial
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={onTrialClick}
                            className="px-5 py-2.5 bg-navy-900 dark:bg-white dark:text-navy-950 text-white text-sm font-bold rounded-full transition-all hover:opacity-90 flex items-center gap-2"
                        >
                            {hasWorkspace ? "Go to Workspace" : "Start Trial"}
                            <Rocket size={18} />
                        </button>
                    )}
                </nav>

                {/* Mobile Menu Toggle (simplified for now) */}
                <button className="md:hidden p-2 text-navy-950 dark:text-white">
                    <Globe size={24} />
                </button>
            </div>
        </header>
    );
};
