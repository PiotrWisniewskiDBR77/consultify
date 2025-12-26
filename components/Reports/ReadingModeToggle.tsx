/**
 * ReadingModeToggle
 * 
 * Focus mode for reading reports:
 * - Hides sidebar/navigation
 * - Centers content
 * - Adjustable font size
 * - Dark/Light mode for report
 * - Print-friendly option
 */

import React, { useState, useEffect, createContext, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Eye,
    EyeOff,
    Sun,
    Moon,
    Minus,
    Plus,
    Type,
    Printer,
    Maximize2,
    Minimize2,
    X,
    Settings
} from 'lucide-react';

// Reading mode context
interface ReadingModeContextValue {
    isEnabled: boolean;
    fontSize: number;
    theme: 'light' | 'dark' | 'auto';
    isFullscreen: boolean;
    toggleReadingMode: () => void;
    setFontSize: (size: number) => void;
    setTheme: (theme: 'light' | 'dark' | 'auto') => void;
    toggleFullscreen: () => void;
}

const ReadingModeContext = createContext<ReadingModeContextValue | null>(null);

export const useReadingMode = () => {
    const context = useContext(ReadingModeContext);
    if (!context) {
        throw new Error('useReadingMode must be used within ReadingModeProvider');
    }
    return context;
};

// Provider component
export const ReadingModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isEnabled, setIsEnabled] = useState(false);
    const [fontSize, setFontSize] = useState(16);
    const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('auto');
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Handle fullscreen
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    // Listen for fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Apply reading mode styles
    useEffect(() => {
        if (isEnabled) {
            document.body.classList.add('reading-mode');
            document.documentElement.style.setProperty('--reading-font-size', `${fontSize}px`);
        } else {
            document.body.classList.remove('reading-mode');
            document.documentElement.style.removeProperty('--reading-font-size');
        }
    }, [isEnabled, fontSize]);

    return (
        <ReadingModeContext.Provider
            value={{
                isEnabled,
                fontSize,
                theme,
                isFullscreen,
                toggleReadingMode: () => setIsEnabled(!isEnabled),
                setFontSize,
                setTheme,
                toggleFullscreen
            }}
        >
            {children}
        </ReadingModeContext.Provider>
    );
};

// Toggle button component
interface ReadingModeToggleProps {
    className?: string;
}

export const ReadingModeToggle: React.FC<ReadingModeToggleProps> = ({ className = '' }) => {
    const { t, i18n } = useTranslation();
    const isPolish = i18n.language === 'pl';
    
    const [isOpen, setIsOpen] = useState(false);
    const [isEnabled, setIsEnabled] = useState(false);
    const [fontSize, setFontSize] = useState(16);
    const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>('auto');

    const minFontSize = 12;
    const maxFontSize = 24;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className={`relative ${className}`}>
            {/* Main toggle button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    inline-flex items-center gap-2 px-3 py-2 rounded-lg transition-colors
                    ${isEnabled 
                        ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' 
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                    }
                `}
                title={isPolish ? 'Ustawienia czytania' : 'Reading settings'}
            >
                {isEnabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span className="text-sm font-medium hidden sm:inline">
                    {isPolish ? 'Tryb czytania' : 'Reading Mode'}
                </span>
                <Settings className="w-3 h-3" />
            </button>

            {/* Dropdown panel */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        <div 
                            className="fixed inset-0 z-40"
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-navy-800 rounded-xl shadow-xl border border-slate-200 dark:border-white/10 p-4 z-50"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-semibold text-navy-900 dark:text-white">
                                    {isPolish ? 'Ustawienia czytania' : 'Reading Settings'}
                                </h3>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Reading mode toggle */}
                            <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-lg mb-4">
                                <div className="flex items-center gap-2">
                                    <Eye className="w-4 h-4 text-slate-500" />
                                    <span className="text-sm text-navy-900 dark:text-white">
                                        {isPolish ? 'Tryb focus' : 'Focus Mode'}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setIsEnabled(!isEnabled)}
                                    className={`
                                        relative w-11 h-6 rounded-full transition-colors
                                        ${isEnabled ? 'bg-blue-500' : 'bg-slate-300 dark:bg-white/20'}
                                    `}
                                >
                                    <span
                                        className={`
                                            absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform
                                            ${isEnabled ? 'translate-x-6' : 'translate-x-1'}
                                        `}
                                    />
                                </button>
                            </div>

                            {/* Font size */}
                            <div className="mb-4">
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                                    {isPolish ? 'Rozmiar czcionki' : 'Font Size'}
                                </label>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setFontSize(Math.max(minFontSize, fontSize - 2))}
                                        disabled={fontSize <= minFontSize}
                                        className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg disabled:opacity-50"
                                    >
                                        <Minus className="w-4 h-4" />
                                    </button>
                                    <div className="flex-1 flex items-center gap-2">
                                        <Type className="w-4 h-4 text-slate-400" />
                                        <input
                                            type="range"
                                            min={minFontSize}
                                            max={maxFontSize}
                                            value={fontSize}
                                            onChange={(e) => setFontSize(Number(e.target.value))}
                                            className="flex-1 accent-blue-500"
                                        />
                                        <span className="text-sm font-medium text-navy-900 dark:text-white w-8 text-right">
                                            {fontSize}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => setFontSize(Math.min(maxFontSize, fontSize + 2))}
                                        disabled={fontSize >= maxFontSize}
                                        className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg disabled:opacity-50"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Theme */}
                            <div className="mb-4">
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                                    {isPolish ? 'Motyw' : 'Theme'}
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { id: 'light', icon: Sun, label: isPolish ? 'Jasny' : 'Light' },
                                        { id: 'dark', icon: Moon, label: isPolish ? 'Ciemny' : 'Dark' },
                                        { id: 'auto', icon: Settings, label: 'Auto' }
                                    ].map(({ id, icon: Icon, label }) => (
                                        <button
                                            key={id}
                                            onClick={() => setTheme(id as typeof theme)}
                                            className={`
                                                flex flex-col items-center gap-1 p-2 rounded-lg transition-colors
                                                ${theme === id 
                                                    ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' 
                                                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'
                                                }
                                            `}
                                        >
                                            <Icon className="w-4 h-4" />
                                            <span className="text-xs">{label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-white/10">
                                <button
                                    onClick={handlePrint}
                                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                                >
                                    <Printer className="w-4 h-4" />
                                    {isPolish ? 'Drukuj' : 'Print'}
                                </button>
                                <button
                                    onClick={() => {
                                        if (!document.fullscreenElement) {
                                            document.documentElement.requestFullscreen();
                                        } else {
                                            document.exitFullscreen();
                                        }
                                    }}
                                    className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                                >
                                    <Maximize2 className="w-4 h-4" />
                                    {isPolish ? 'Pełny ekran' : 'Fullscreen'}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

// Inline simple toggle
export const ReadingModeSimpleToggle: React.FC<{
    isEnabled: boolean;
    onToggle: () => void;
    className?: string;
}> = ({ isEnabled, onToggle, className = '' }) => {
    const { i18n } = useTranslation();
    const isPolish = i18n.language === 'pl';

    return (
        <button
            onClick={onToggle}
            className={`
                p-2 rounded-lg transition-colors
                ${isEnabled 
                    ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                }
                ${className}
            `}
            title={isPolish ? 'Tryb czytania' : 'Reading mode'}
        >
            {isEnabled ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
    );
};

export default ReadingModeToggle;

