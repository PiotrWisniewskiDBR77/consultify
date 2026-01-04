import { Book, ChevronRight, ExternalLink, HelpCircle, MessageSquare, Search, Video, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { getHelpForView, HelpItem } from '../../config/helpContent';

/**
 * FloatingHelpWidget — Global help widget (bottom-left)
 *
 * Features:
 * - Contextual help based on current view
 * - Search across help content
 * - Quick links to docs
 * - Animated color pulse for visibility
 */

// CSS for the widget button animation (purple -> indigo)
const widgetAnimationStyle = `
@keyframes widgetColorPulse {
    0%, 100% {
        background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%);
        box-shadow: 0 0 12px rgba(139, 92, 246, 0.4);
    }
    50% {
        background: linear-gradient(135deg, #6366F1 0%, #4F46E5 100%);
        box-shadow: 0 0 16px rgba(99, 102, 241, 0.5);
    }
}

@keyframes widgetIconGlow {
    0%, 100% { 
        filter: drop-shadow(0 0 1px rgba(255,255,255,0.3));
    }
    50% { 
        filter: drop-shadow(0 0 5px rgba(255,255,255,0.6));
    }
}
`;

interface FloatingHelpWidgetProps {
    defaultOpen?: boolean;
}

export const FloatingHelpWidget: React.FC<FloatingHelpWidgetProps> = ({ defaultOpen = false }) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [searchQuery, setSearchQuery] = useState('');
    const location = useLocation();

    // Get current view from path
    const currentPath = location.pathname;
    const contextualHelpRaw = getHelpForView(currentPath);

    // Memoize translated and filtered help items
    const filteredHelp = useMemo(() => {
        return contextualHelpRaw
            .map((item) => ({
                ...item,
                translatedTitle: t(item.title),
                translatedContent: t(item.content),
            }))
            .filter(
                (item) =>
                    item.translatedTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    item.translatedContent.toLowerCase().includes(searchQuery.toLowerCase()),
            );
    }, [contextualHelpRaw, searchQuery, t]);

    if (!isOpen) {
        return (
            <>
                <style>{widgetAnimationStyle}</style>
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 left-6 w-12 h-12 rounded-xl shadow-lg flex items-center justify-center text-white transition-all z-40 group"
                    style={{
                        animation: 'widgetColorPulse 5s ease-in-out infinite',
                    }}
                >
                    <HelpCircle size={22} style={{ animation: 'widgetIconGlow 5s ease-in-out infinite' }} />
                    <span className="absolute left-full ml-3 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity shadow-lg">
                        {t('help.widget.label')}
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-slate-900 rotate-45" />
                    </span>
                </button>
            </>
        );
    }

    return (
        <div className="fixed bottom-6 left-6 w-80 bg-white dark:bg-navy-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in slide-in-from-bottom-10 fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-navy-900 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <HelpCircle size={18} className="text-purple-500" />
                    <span className="font-semibold text-sm text-navy-900 dark:text-white">
                        {t('help.widget.header')}
                    </span>
                </div>
                <button
                    onClick={() => setIsOpen(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Search */}
            <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder={t('help.widget.searchPlaceholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm bg-slate-100 dark:bg-navy-900 border border-transparent focus:border-purple-300 dark:focus:border-purple-700 rounded-lg outline-none transition-colors"
                    />
                </div>
            </div>

            {/* Contextual Help Items */}
            <div className="max-h-64 overflow-y-auto">
                {filteredHelp.length > 0 ? (
                    <div className="py-2">
                        {filteredHelp.map((item, index) => (
                            <button
                                key={index}
                                onClick={() => item.onClick?.()}
                                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-navy-900 transition-colors text-left group"
                            >
                                <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                                    {item.type === 'video' ? (
                                        <Video size={14} className="text-purple-500" />
                                    ) : (
                                        <Book size={14} className="text-purple-500" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-navy-900 dark:text-white truncate">
                                        {item.translatedTitle}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                                        {item.translatedContent}
                                    </p>
                                </div>
                                <ChevronRight
                                    size={14}
                                    className="text-slate-300 dark:text-slate-600 group-hover:text-purple-500 mt-1 shrink-0"
                                />
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="py-8 text-center">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {t('help.widget.noResults', { query: searchQuery })}
                        </p>
                    </div>
                )}
            </div>

            {/* Footer Links */}
            <div className="p-3 bg-slate-50 dark:bg-navy-900 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                    <button className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                        <Book size={12} />
                        <span>{t('help.widget.docs')}</span>
                        <ExternalLink size={10} />
                    </button>
                    <button className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                        <MessageSquare size={12} />
                        <span>{t('help.widget.contact')}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FloatingHelpWidget;
