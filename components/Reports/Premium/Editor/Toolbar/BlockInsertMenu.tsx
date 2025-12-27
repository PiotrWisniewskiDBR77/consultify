/**
 * BlockInsertMenu
 * 
 * Slash command menu for inserting custom blocks like charts,
 * recommendation cards, and data visualizations.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
    BarChart3,
    Target,
    Lightbulb,
    FileText,
    Table,
    AlertCircle,
    TrendingUp,
    PieChart,
    Calendar,
    Users,
    Gauge,
    Sparkles
} from 'lucide-react';

interface BlockInsertMenuProps {
    position: { x: number; y: number };
    onSelect: (blockType: string, data?: Record<string, unknown>) => void;
    onClose: () => void;
}

interface BlockOption {
    id: string;
    label: string;
    labelPl: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    category: 'data' | 'content' | 'ai';
}

const BLOCK_OPTIONS: BlockOption[] = [
    // Data Visualization
    {
        id: 'maturityRadar',
        label: 'Maturity Radar',
        labelPl: 'Radar Dojrzałości',
        description: 'Wykres radarowy z poziomami dojrzałości',
        icon: PieChart,
        category: 'data'
    },
    {
        id: 'gapHeatmap',
        label: 'Gap Heatmap',
        labelPl: 'Mapa Ciepła Luk',
        description: 'Heatmapa pokazująca luki w dojrzałości',
        icon: Target,
        category: 'data'
    },
    {
        id: 'metricCard',
        label: 'Metric Cards',
        labelPl: 'Karty Metryk',
        description: 'Karty z kluczowymi wskaźnikami',
        icon: Gauge,
        category: 'data'
    },
    {
        id: 'trendChart',
        label: 'Trend Chart',
        labelPl: 'Wykres Trendu',
        description: 'Wykres trendu czasowego',
        icon: TrendingUp,
        category: 'data'
    },

    // Content Blocks
    {
        id: 'recommendationCard',
        label: 'Recommendation',
        labelPl: 'Rekomendacja',
        description: 'Karta rekomendacji z priorytetem i ROI',
        icon: Lightbulb,
        category: 'content'
    },
    {
        id: 'callout',
        label: 'Callout',
        labelPl: 'Wyróżnienie',
        description: 'Wyróżniony blok informacyjny',
        icon: AlertCircle,
        category: 'content'
    },
    {
        id: 'table',
        label: 'Table',
        labelPl: 'Tabela',
        description: 'Tabela z danymi',
        icon: Table,
        category: 'content'
    },
    {
        id: 'timeline',
        label: 'Timeline',
        labelPl: 'Oś Czasu',
        description: 'Roadmapa lub harmonogram',
        icon: Calendar,
        category: 'content'
    },

    // AI Generated
    {
        id: 'executiveSummary',
        label: 'Executive Summary',
        labelPl: 'Podsumowanie Wykonawcze',
        description: 'AI-generowane podsumowanie dla zarządu',
        icon: FileText,
        category: 'ai'
    },
    {
        id: 'aiRecommendations',
        label: 'AI Recommendations',
        labelPl: 'Rekomendacje AI',
        description: 'Automatycznie generowane rekomendacje',
        icon: Sparkles,
        category: 'ai'
    }
];

export const BlockInsertMenu: React.FC<BlockInsertMenuProps> = ({
    position,
    onSelect,
    onClose
}) => {
    const [search, setSearch] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const menuRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Filter blocks based on search
    const filteredBlocks = BLOCK_OPTIONS.filter(block =>
        block.label.toLowerCase().includes(search.toLowerCase()) ||
        block.labelPl.toLowerCase().includes(search.toLowerCase()) ||
        block.description.toLowerCase().includes(search.toLowerCase())
    );

    // Group by category
    const groupedBlocks = {
        data: filteredBlocks.filter(b => b.category === 'data'),
        content: filteredBlocks.filter(b => b.category === 'content'),
        ai: filteredBlocks.filter(b => b.category === 'ai')
    };

    // Focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedIndex(i => Math.min(i + 1, filteredBlocks.length - 1));
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedIndex(i => Math.max(i - 1, 0));
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (filteredBlocks[selectedIndex]) {
                        onSelect(filteredBlocks[selectedIndex].id);
                    }
                    break;
                case 'Escape':
                    onClose();
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [filteredBlocks, selectedIndex, onSelect, onClose]);

    const renderCategory = (title: string, blocks: BlockOption[]) => {
        if (blocks.length === 0) return null;

        return (
            <div key={title}>
                <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {title}
                </div>
                {blocks.map((block, idx) => {
                    const Icon = block.icon;
                    const globalIndex = filteredBlocks.indexOf(block);
                    const isSelected = globalIndex === selectedIndex;

                    return (
                        <button
                            key={block.id}
                            onClick={() => onSelect(block.id)}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                            className={`
                w-full flex items-start gap-3 px-3 py-2 text-left transition-colors
                ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-slate-50 dark:hover:bg-white/5'}
              `}
                        >
                            <div className={`
                p-2 rounded-lg
                ${block.category === 'ai'
                                    ? 'bg-gradient-to-br from-purple-500 to-blue-500 text-white'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                }
              `}>
                                <Icon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm text-slate-900 dark:text-white">
                                    {block.labelPl}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                    {block.description}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        );
    };

    return (
        <div
            ref={menuRef}
            style={{ left: position.x, top: position.y }}
            className="fixed z-50 w-80 bg-white dark:bg-navy-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
        >
            {/* Search */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                <input
                    ref={inputRef}
                    type="text"
                    value={search}
                    onChange={(e) => {
                        setSearch(e.target.value);
                        setSelectedIndex(0);
                    }}
                    placeholder="Szukaj bloków..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {/* Block List */}
            <div className="max-h-80 overflow-y-auto py-2">
                {filteredBlocks.length === 0 ? (
                    <div className="px-3 py-8 text-center text-slate-400">
                        Nie znaleziono bloków
                    </div>
                ) : (
                    <>
                        {renderCategory('Wizualizacja Danych', groupedBlocks.data)}
                        {renderCategory('Bloki Treści', groupedBlocks.content)}
                        {renderCategory('Generowane przez AI', groupedBlocks.ai)}
                    </>
                )}
            </div>

            {/* Help */}
            <div className="px-3 py-2 bg-slate-50 dark:bg-navy-800 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-400">
                ↑↓ nawiguj • Enter wybierz • Esc zamknij
            </div>
        </div>
    );
};

export default BlockInsertMenu;
