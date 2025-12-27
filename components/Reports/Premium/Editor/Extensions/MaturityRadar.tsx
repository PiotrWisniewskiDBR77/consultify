/**
 * MaturityRadar Extension
 * 
 * Custom TipTap node for embedding interactive maturity radar charts
 * in the report editor.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, NodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import React, { useEffect, useState } from 'react';
import { RefreshCw, Settings } from 'lucide-react';

// Chart.js for radar visualization
import {
    Chart as ChartJS,
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend,
    ChartData,
    ChartOptions
} from 'chart.js';
import { Radar } from 'react-chartjs-2';

ChartJS.register(
    RadialLinearScale,
    PointElement,
    LineElement,
    Filler,
    Tooltip,
    Legend
);

interface MaturityRadarAttrs {
    assessmentId: string | null;
    showTarget: boolean;
    showLegend: boolean;
    title: string;
}

// React component for the radar chart
const MaturityRadarComponent: React.FC<NodeViewProps> = ({ node, updateAttributes, selected }) => {
    const [data, setData] = useState<{
        axes: { id: string; name: string; actual: number; target: number }[];
    } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);

    const attrs = node.attrs as MaturityRadarAttrs;
    const { assessmentId, showTarget = true, showLegend = true, title = 'Maturity Overview' } = attrs;

    // Fetch assessment data
    useEffect(() => {
        if (!assessmentId) {
            // Demo data
            setData({
                axes: [
                    { id: 'processes', name: 'Procesy', actual: 3.2, target: 5.0 },
                    { id: 'digitalProducts', name: 'Produkty Cyfrowe', actual: 2.8, target: 4.5 },
                    { id: 'businessModels', name: 'Modele Biznesowe', actual: 2.5, target: 4.0 },
                    { id: 'dataManagement', name: 'Zarządzanie Danymi', actual: 3.5, target: 5.5 },
                    { id: 'culture', name: 'Kultura', actual: 3.0, target: 4.5 },
                    { id: 'cybersecurity', name: 'Cyberbezpieczeństwo', actual: 4.0, target: 5.0 },
                    { id: 'aiMaturity', name: 'Dojrzałość AI', actual: 2.0, target: 4.0 }
                ]
            });
            setIsLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                const response = await fetch(`/api/assessments/${assessmentId}/summary`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                });
                if (response.ok) {
                    const result = await response.json();
                    setData(result);
                }
            } catch (error) {
                console.error('Failed to fetch assessment data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [assessmentId]);

    // Chart configuration
    const chartData: ChartData<'radar'> | null = data ? {
        labels: data.axes.map(a => a.name),
        datasets: [
            {
                label: 'Obecny poziom',
                data: data.axes.map(a => a.actual),
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                borderColor: 'rgba(99, 102, 241, 1)',
                borderWidth: 2,
                pointBackgroundColor: 'rgba(99, 102, 241, 1)',
                pointRadius: 4
            },
            ...(showTarget ? [{
                label: 'Cel',
                data: data.axes.map(a => a.target),
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                borderColor: 'rgba(16, 185, 129, 1)',
                borderWidth: 2,
                borderDash: [5, 5] as number[],
                pointBackgroundColor: 'rgba(16, 185, 129, 1)',
                pointRadius: 4
            }] : [])
        ]
    } : null;

    const chartOptions: ChartOptions<'radar'> = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                display: showLegend,
                position: 'bottom'
            }
        },
        scales: {
            r: {
                min: 0,
                max: 7,
                ticks: {
                    stepSize: 1
                }
            }
        }
    };

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

            {/* Settings Panel */}
            {isEditing && (
                <div className="mb-4 p-4 bg-slate-50 dark:bg-navy-800 rounded-lg space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                            Tytuł wykresu
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
                                checked={showTarget}
                                onChange={(e) => updateAttributes({ showTarget: e.target.checked })}
                                className="rounded"
                            />
                            Pokaż cel
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={showLegend}
                                onChange={(e) => updateAttributes({ showLegend: e.target.checked })}
                                className="rounded"
                            />
                            Pokaż legendę
                        </label>
                    </div>
                </div>
            )}

            {/* Chart */}
            <div className="aspect-square max-w-lg mx-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                ) : chartData ? (
                    <Radar data={chartData} options={chartOptions} />
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-400">
                        Brak danych do wyświetlenia
                    </div>
                )}
            </div>
        </NodeViewWrapper>
    );
};

// TipTap extension
export const MaturityRadarExtension = Node.create({
    name: 'maturityRadar',

    group: 'block',

    atom: true,

    addAttributes() {
        return {
            assessmentId: {
                default: null
            },
            showTarget: {
                default: true
            },
            showLegend: {
                default: true
            },
            title: {
                default: 'Przegląd Dojrzałości'
            }
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-maturity-radar]'
            }
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-maturity-radar': '' })];
    },

    addNodeView() {
        return ReactNodeViewRenderer(MaturityRadarComponent);
    }
});

export default MaturityRadarExtension;
