/**
 * GapHeatmap Extension
 * 
 * Custom TipTap node for embedding gap analysis heatmaps
 * showing maturity gaps across axes and sub-areas.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, NodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import React, { useEffect, useState } from 'react';
import { Settings, RefreshCw } from 'lucide-react';

interface GapHeatmapAttrs {
    assessmentId: string | null;
    showNumbers: boolean;
    colorScheme: 'redGreen' | 'blueOrange';
    title: string;
}

interface GapData {
    axes: {
        id: string;
        name: string;
        actual: number;
        target: number;
        gap: number;
    }[];
}

// Color utility
const getGapColor = (gap: number, scheme: 'redGreen' | 'blueOrange'): string => {
    if (scheme === 'redGreen') {
        if (gap <= 0.5) return 'bg-green-100 text-green-800';
        if (gap <= 1.0) return 'bg-green-200 text-green-900';
        if (gap <= 1.5) return 'bg-yellow-100 text-yellow-800';
        if (gap <= 2.0) return 'bg-orange-200 text-orange-900';
        if (gap <= 2.5) return 'bg-red-200 text-red-900';
        return 'bg-red-400 text-white';
    } else {
        if (gap <= 0.5) return 'bg-blue-100 text-blue-800';
        if (gap <= 1.0) return 'bg-blue-200 text-blue-900';
        if (gap <= 1.5) return 'bg-blue-300 text-blue-900';
        if (gap <= 2.0) return 'bg-orange-200 text-orange-900';
        if (gap <= 2.5) return 'bg-orange-300 text-orange-900';
        return 'bg-orange-500 text-white';
    }
};

// React component
const GapHeatmapComponent: React.FC<NodeViewProps> = ({ node, updateAttributes, selected }) => {
    const [data, setData] = useState<GapData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);

    const attrs = node.attrs as GapHeatmapAttrs;
    const {
        assessmentId,
        showNumbers = true,
        colorScheme = 'redGreen',
        title = 'Analiza Luk'
    } = attrs;

    // Fetch or use demo data
    useEffect(() => {
        if (!assessmentId) {
            // Demo data
            setData({
                axes: [
                    { id: 'processes', name: 'Procesy', actual: 3.2, target: 5.0, gap: 1.8 },
                    { id: 'digitalProducts', name: 'Produkty Cyfrowe', actual: 2.8, target: 4.5, gap: 1.7 },
                    { id: 'businessModels', name: 'Modele Biznesowe', actual: 2.5, target: 4.0, gap: 1.5 },
                    { id: 'dataManagement', name: 'Zarządzanie Danymi', actual: 3.5, target: 5.5, gap: 2.0 },
                    { id: 'culture', name: 'Kultura', actual: 3.0, target: 4.5, gap: 1.5 },
                    { id: 'cybersecurity', name: 'Cyberbezpieczeństwo', actual: 4.0, target: 5.0, gap: 1.0 },
                    { id: 'aiMaturity', name: 'Dojrzałość AI', actual: 2.0, target: 4.0, gap: 2.0 }
                ]
            });
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                const response = await fetch(`/api/assessments/${assessmentId}/gaps`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (response.ok) {
                    const result = await response.json();
                    setData(result);
                }
            } catch (error) {
                console.error('Failed to fetch gap data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [assessmentId]);

    return (
        <NodeViewWrapper className={`premium-chart-container ${selected ? 'ring-2 ring-blue-500' : ''}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="chart-title">{title}</h3>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsEditing(!isEditing)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded transition-colors"
                    >
                        <Settings className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => {
                            setIsLoading(true);
                            setTimeout(() => setIsLoading(false), 500);
                        }}
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Settings */}
            {isEditing && (
                <div className="mb-4 p-4 bg-slate-50 dark:bg-navy-800 rounded-lg space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Tytuł
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => updateAttributes({ title: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm"
                        />
                    </div>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={showNumbers}
                                onChange={(e) => updateAttributes({ showNumbers: e.target.checked })}
                                className="rounded"
                            />
                            Pokaż wartości
                        </label>
                        <select
                            value={colorScheme}
                            onChange={(e) => updateAttributes({ colorScheme: e.target.value })}
                            className="px-3 py-1.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm"
                        >
                            <option value="redGreen">Czerwono-Zielony</option>
                            <option value="blueOrange">Niebiesko-Pomarańczowy</option>
                        </select>
                    </div>
                </div>
            )}

            {/* Heatmap Table */}
            {isLoading ? (
                <div className="flex items-center justify-center h-48">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : data ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr>
                                <th className="text-left py-3 px-4 bg-slate-100 dark:bg-slate-800 font-semibold">Oś</th>
                                <th className="text-center py-3 px-4 bg-slate-100 dark:bg-slate-800 font-semibold">Obecny</th>
                                <th className="text-center py-3 px-4 bg-slate-100 dark:bg-slate-800 font-semibold">Cel</th>
                                <th className="text-center py-3 px-4 bg-slate-100 dark:bg-slate-800 font-semibold">Luka</th>
                                <th className="py-3 px-4 bg-slate-100 dark:bg-slate-800 font-semibold w-48">Wizualizacja</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.axes.map((axis, idx) => (
                                <tr key={axis.id} className={idx % 2 === 0 ? 'bg-white dark:bg-navy-900' : 'bg-slate-50 dark:bg-navy-800/50'}>
                                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                                        {axis.name}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        {showNumbers && axis.actual.toFixed(1)}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        {showNumbers && axis.target.toFixed(1)}
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                        <span className={`inline-flex items-center justify-center w-12 h-8 rounded-lg font-semibold ${getGapColor(axis.gap, colorScheme)}`}>
                                            {axis.gap.toFixed(1)}
                                        </span>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="relative h-6 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                                className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"
                                                style={{ width: `${(axis.actual / 7) * 100}%` }}
                                            />
                                            <div
                                                className="absolute top-1 bottom-1 w-0.5 bg-green-500"
                                                style={{ left: `${(axis.target / 7) * 100}%` }}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="flex items-center justify-center h-48 text-slate-400">
                    Brak danych do wyświetlenia
                </div>
            )}

            {/* Legend */}
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                    <span className={`w-4 h-4 rounded ${colorScheme === 'redGreen' ? 'bg-green-200' : 'bg-blue-200'}`}></span>
                    Mała luka (0-1)
                </span>
                <span className="flex items-center gap-1">
                    <span className={`w-4 h-4 rounded ${colorScheme === 'redGreen' ? 'bg-yellow-200' : 'bg-blue-300'}`}></span>
                    Średnia (1-2)
                </span>
                <span className="flex items-center gap-1">
                    <span className={`w-4 h-4 rounded ${colorScheme === 'redGreen' ? 'bg-red-300' : 'bg-orange-400'}`}></span>
                    Duża luka (2+)
                </span>
            </div>
        </NodeViewWrapper>
    );
};

// TipTap extension
export const GapHeatmapExtension = Node.create({
    name: 'gapHeatmap',

    group: 'block',

    atom: true,

    addAttributes() {
        return {
            assessmentId: { default: null },
            showNumbers: { default: true },
            colorScheme: { default: 'redGreen' },
            title: { default: 'Analiza Luk' }
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-gap-heatmap]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-gap-heatmap': '' })];
    },

    addNodeView() {
        return ReactNodeViewRenderer(GapHeatmapComponent);
    }
});

export default GapHeatmapExtension;
