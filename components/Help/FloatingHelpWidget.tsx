import React, { useState } from 'react';
import { HelpCircle, X, Search, ChevronRight, Book, Video, MessageSquare, ExternalLink } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { HelpItem, getHelpForView } from '../../config/helpContent';

/**
 * FloatingHelpWidget — Global help widget (bottom-left)
 * 
 * Features:
 * - Contextual help based on current view
 * - Search across help content
 * - Quick links to docs
 */

interface FloatingHelpWidgetProps {
    defaultOpen?: boolean;
}

export const FloatingHelpWidget: React.FC<FloatingHelpWidgetProps> = ({
    defaultOpen = false,
}) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const [searchQuery, setSearchQuery] = useState('');
    const location = useLocation();

    // Get current view from path
    const currentPath = location.pathname;
    const contextualHelp = getHelpForView(currentPath);

    // Filter help items by search
    const filteredHelp = contextualHelp.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.content.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 left-6 w-12 h-12 bg-white dark:bg-navy-800 border border-slate-200 dark:border-slate-700 rounded-full shadow-lg flex items-center justify-center text-slate-500 hover:text-purple-600 hover:border-purple-300 dark:hover:border-purple-700 transition-all z-40 group"
            >
                <HelpCircle size={22} />
                <span className="absolute left-full ml-3 px-2 py-1 bg-navy-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap transition-opacity">
                    Pomoc
                </span>
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 left-6 w-80 bg-white dark:bg-navy-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in slide-in-from-bottom-10 fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-navy-900 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <HelpCircle size={18} className="text-purple-500" />
                    <span className="font-semibold text-sm text-navy-900 dark:text-white">
                        Centrum pomocy
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
                        placeholder="Szukaj w pomocy..."
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
                                        {item.title}
                                    </p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                                        {item.content}
                                    </p>
                                </div>
                                <ChevronRight size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-purple-500 mt-1 shrink-0" />
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="py-8 text-center">
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Brak wyników dla "{searchQuery}"
                        </p>
                    </div>
                )}
            </div>

            {/* Footer Links */}
            <div className="p-3 bg-slate-50 dark:bg-navy-900 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                    <button className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                        <Book size={12} />
                        <span>Dokumentacja</span>
                        <ExternalLink size={10} />
                    </button>
                    <button className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
                        <MessageSquare size={12} />
                        <span>Kontakt</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FloatingHelpWidget;
