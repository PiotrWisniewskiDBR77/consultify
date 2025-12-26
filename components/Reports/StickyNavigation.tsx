/**
 * StickyNavigation
 * 
 * Scroll-aware header for the Report Builder:
 * - Fixed position on scroll (after 100px)
 * - Reading progress bar (0-100%)
 * - Mini breadcrumb showing current section
 * - Quick jump dropdown
 * - Keyboard navigation support (J/K for prev/next)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronDown,
    ChevronUp,
    ChevronLeft,
    ChevronRight,
    List,
    FileText,
    BarChart3,
    BookOpen,
    Target,
    Map,
    Layers,
    Briefcase,
    Eye,
    EyeOff,
    Keyboard
} from 'lucide-react';

interface SectionInfo {
    id: string;
    title: string;
    sectionType: string;
    orderIndex: number;
}

interface StickyNavigationProps {
    sections: SectionInfo[];
    currentSection: string | null;
    reportTitle: string;
    isReadingMode: boolean;
    onSectionClick: (sectionId: string) => void;
    onToggleReadingMode: () => void;
}

// Section type icons
const SECTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    cover_page: FileText,
    executive_summary: BarChart3,
    methodology: BookOpen,
    maturity_overview: Target,
    axis_detail: Layers,
    gap_analysis: Target,
    initiatives: Briefcase,
    roadmap: Map,
    appendix: FileText
};

export const StickyNavigation: React.FC<StickyNavigationProps> = ({
    sections,
    currentSection,
    reportTitle,
    isReadingMode,
    onSectionClick,
    onToggleReadingMode
}) => {
    const { t, i18n } = useTranslation();
    const isPolish = i18n.language === 'pl';

    // State
    const [isVisible, setIsVisible] = useState(false);
    const [scrollProgress, setScrollProgress] = useState(0);
    const [showJumpMenu, setShowJumpMenu] = useState(false);
    const [showKeyboardHint, setShowKeyboardHint] = useState(false);
    
    const jumpMenuRef = useRef<HTMLDivElement>(null);

    // Get current section info
    const currentSectionInfo = sections.find(s => s.id === currentSection);
    const currentIndex = currentSectionInfo ? sections.findIndex(s => s.id === currentSection) : -1;

    // Calculate scroll progress
    useEffect(() => {
        const handleScroll = () => {
            const scrollTop = window.scrollY;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
            
            setScrollProgress(Math.min(100, Math.max(0, progress)));
            setIsVisible(scrollTop > 100);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll(); // Initial call

        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Skip if user is typing in an input
            if (e.target instanceof HTMLInputElement || 
                e.target instanceof HTMLTextAreaElement ||
                (e.target as HTMLElement).isContentEditable) {
                return;
            }

            if (e.key === 'j' || e.key === 'J') {
                e.preventDefault();
                navigateSection('next');
            } else if (e.key === 'k' || e.key === 'K') {
                e.preventDefault();
                navigateSection('prev');
            } else if (e.key === 'g' || e.key === 'G') {
                e.preventDefault();
                setShowJumpMenu(true);
            } else if (e.key === 'r' || e.key === 'R') {
                e.preventDefault();
                onToggleReadingMode();
            } else if (e.key === 'Escape') {
                setShowJumpMenu(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentIndex, sections, onToggleReadingMode]);

    // Navigate to prev/next section
    const navigateSection = useCallback((direction: 'prev' | 'next') => {
        if (sections.length === 0) return;

        let newIndex: number;
        if (direction === 'prev') {
            newIndex = currentIndex > 0 ? currentIndex - 1 : sections.length - 1;
        } else {
            newIndex = currentIndex < sections.length - 1 ? currentIndex + 1 : 0;
        }

        const targetSection = sections[newIndex];
        if (targetSection) {
            onSectionClick(targetSection.id);
            
            // Scroll to section
            const element = document.querySelector(`[data-section-id="${targetSection.id}"]`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
    }, [currentIndex, sections, onSectionClick]);

    // Close jump menu on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (jumpMenuRef.current && !jumpMenuRef.current.contains(e.target as Node)) {
                setShowJumpMenu(false);
            }
        };

        if (showJumpMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showJumpMenu]);

    // Get icon for section
    const getIcon = (sectionType: string) => {
        return SECTION_ICONS[sectionType] || FileText;
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ y: -100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -100, opacity: 0 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-white/10 shadow-sm"
                >
                    {/* Progress bar */}
                    <div className="absolute bottom-0 left-0 h-0.5 bg-slate-100 dark:bg-white/5 w-full">
                        <motion.div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                            style={{ width: `${scrollProgress}%` }}
                            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        />
                    </div>

                    <div className="max-w-7xl mx-auto px-4 sm:px-6">
                        <div className="flex items-center justify-between h-14">
                            {/* Left: Section breadcrumb */}
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                {/* Navigation arrows */}
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => navigateSection('prev')}
                                        disabled={sections.length === 0}
                                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
                                        title={`${isPolish ? 'Poprzednia sekcja' : 'Previous section'} (K)`}
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => navigateSection('next')}
                                        disabled={sections.length === 0}
                                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
                                        title={`${isPolish ? 'Następna sekcja' : 'Next section'} (J)`}
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Current section info */}
                                <div className="flex items-center gap-2 min-w-0 relative" ref={jumpMenuRef}>
                                    <button
                                        onClick={() => setShowJumpMenu(!showJumpMenu)}
                                        className="flex items-center gap-2 min-w-0 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                                    >
                                        {currentSectionInfo && (
                                            <>
                                                {React.createElement(getIcon(currentSectionInfo.sectionType), {
                                                    className: 'w-4 h-4 text-blue-500 flex-shrink-0'
                                                })}
                                                <span className="text-sm font-medium text-navy-900 dark:text-white truncate">
                                                    {currentSectionInfo.title}
                                                </span>
                                                <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
                                                    ({currentIndex + 1}/{sections.length})
                                                </span>
                                            </>
                                        )}
                                        {!currentSectionInfo && (
                                            <span className="text-sm text-slate-500 dark:text-slate-400">
                                                {reportTitle}
                                            </span>
                                        )}
                                        <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${showJumpMenu ? 'rotate-180' : ''}`} />
                                    </button>

                                    {/* Jump menu dropdown */}
                                    <AnimatePresence>
                                        {showJumpMenu && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                transition={{ duration: 0.15 }}
                                                className="absolute left-0 top-full mt-2 w-80 max-h-96 overflow-auto bg-white dark:bg-navy-800 rounded-xl shadow-xl border border-slate-200 dark:border-white/10 py-2 z-50"
                                            >
                                                <div className="px-3 py-2 border-b border-slate-100 dark:border-white/5">
                                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                                        {isPolish ? 'Przejdź do sekcji' : 'Jump to section'}
                                                    </p>
                                                </div>
                                                {sections.map((section, index) => {
                                                    const Icon = getIcon(section.sectionType);
                                                    const isActive = section.id === currentSection;

                                                    return (
                                                        <button
                                                            key={section.id}
                                                            onClick={() => {
                                                                onSectionClick(section.id);
                                                                setShowJumpMenu(false);
                                                                const element = document.querySelector(`[data-section-id="${section.id}"]`);
                                                                if (element) {
                                                                    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                                }
                                                            }}
                                                            className={`
                                                                w-full flex items-center gap-3 px-3 py-2 text-left transition-colors
                                                                ${isActive 
                                                                    ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300' 
                                                                    : 'hover:bg-slate-50 dark:hover:bg-white/5 text-navy-900 dark:text-white'
                                                                }
                                                            `}
                                                        >
                                                            <span className={`
                                                                flex-shrink-0 w-6 h-6 flex items-center justify-center text-xs font-medium rounded
                                                                ${isActive 
                                                                    ? 'bg-blue-500 text-white' 
                                                                    : 'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400'
                                                                }
                                                            `}>
                                                                {index + 1}
                                                            </span>
                                                            <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-blue-500' : 'text-slate-400'}`} />
                                                            <span className="text-sm truncate">{section.title}</span>
                                                        </button>
                                                    );
                                                })}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* Right: Controls */}
                            <div className="flex items-center gap-2">
                                {/* Progress percentage */}
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                                    {Math.round(scrollProgress)}%
                                </span>

                                {/* Reading mode toggle */}
                                <button
                                    onClick={onToggleReadingMode}
                                    className={`
                                        p-2 rounded-lg transition-colors
                                        ${isReadingMode 
                                            ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400' 
                                            : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                                        }
                                    `}
                                    title={`${isPolish ? 'Tryb czytania' : 'Reading mode'} (R)`}
                                >
                                    {isReadingMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>

                                {/* Keyboard shortcuts hint */}
                                <div className="relative">
                                    <button
                                        onClick={() => setShowKeyboardHint(!showKeyboardHint)}
                                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors"
                                        title={isPolish ? 'Skróty klawiszowe' : 'Keyboard shortcuts'}
                                    >
                                        <Keyboard className="w-4 h-4" />
                                    </button>

                                    <AnimatePresence>
                                        {showKeyboardHint && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -10 }}
                                                className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-navy-800 rounded-xl shadow-xl border border-slate-200 dark:border-white/10 p-4 z-50"
                                            >
                                                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                                                    {isPolish ? 'Skróty klawiszowe' : 'Keyboard Shortcuts'}
                                                </p>
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-slate-600 dark:text-slate-400">
                                                            {isPolish ? 'Następna sekcja' : 'Next section'}
                                                        </span>
                                                        <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded text-xs font-mono">J</kbd>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-slate-600 dark:text-slate-400">
                                                            {isPolish ? 'Poprzednia sekcja' : 'Previous section'}
                                                        </span>
                                                        <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded text-xs font-mono">K</kbd>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-slate-600 dark:text-slate-400">
                                                            {isPolish ? 'Przejdź do...' : 'Go to...'}
                                                        </span>
                                                        <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded text-xs font-mono">G</kbd>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-slate-600 dark:text-slate-400">
                                                            {isPolish ? 'Tryb czytania' : 'Reading mode'}
                                                        </span>
                                                        <kbd className="px-2 py-0.5 bg-slate-100 dark:bg-white/5 rounded text-xs font-mono">R</kbd>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default StickyNavigation;

