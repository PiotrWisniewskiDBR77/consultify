import React, { useState } from 'react';
import { Users, User, MessageSquare, AlertTriangle, Check, X, ChevronDown, ChevronUp, Target, Scale } from 'lucide-react';

/**
 * MultiPerspectiveView — Phase F: Team Expansion
 * 
 * ENTERPRISE SPEC COMPLIANCE:
 * - EPIC-F2: Show different viewpoints side-by-side
 * - EPIC-F3: Highlight tensions, don't smooth them
 * - AI FACILITATOR mode: "Shows disagreements, never takes sides"
 * 
 * PURPOSE:
 * When multiple team members have input on the same decision axis,
 * display their perspectives simultaneously so patterns emerge.
 */

interface Perspective {
    id: string;
    userId: string;
    userName: string;
    userRole: string;
    rating?: number;
    comment: string;
    createdAt: string;
}

interface PerspectiveAxis {
    axisId: string;
    axisName: string;
    description: string;
    perspectives: Perspective[];
}

interface MultiPerspectiveViewProps {
    axes: PerspectiveAxis[];
    onRequestPerspective?: (axisId: string, userId: string) => void;
    className?: string;
}

// Color palette for different users
const USER_COLORS = [
    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
];

const getUserColor = (index: number) => USER_COLORS[index % USER_COLORS.length];

/**
 * Detect tension level based on rating variance and language
 */
const detectTension = (perspectives: Perspective[]): 'none' | 'low' | 'medium' | 'high' => {
    if (perspectives.length < 2) return 'none';

    const ratings = perspectives.filter(p => p.rating !== undefined).map(p => p.rating!);
    if (ratings.length < 2) return 'low';

    const max = Math.max(...ratings);
    const min = Math.min(...ratings);
    const variance = max - min;

    if (variance >= 3) return 'high';
    if (variance >= 2) return 'medium';
    return 'low';
};

const TensionBadge: React.FC<{ level: 'none' | 'low' | 'medium' | 'high' }> = ({ level }) => {
    const styles = {
        none: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
        low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
        high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    };

    const labels = {
        none: 'Brak danych',
        low: 'Zgodność',
        medium: 'Różnice',
        high: 'Napięcie',
    };

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${styles[level]}`}>
            {level === 'high' && <AlertTriangle size={12} />}
            {level === 'low' && <Check size={12} />}
            {labels[level]}
        </span>
    );
};

const PerspectiveCard: React.FC<{
    perspective: Perspective;
    userIndex: number;
    showRating?: boolean;
}> = ({ perspective, userIndex, showRating = true }) => {
    const colorClass = getUserColor(userIndex);

    return (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-navy-900">
            {/* User Header */}
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${colorClass}`}>
                    {perspective.userName.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="font-medium text-navy-900 dark:text-white text-sm truncate">
                        {perspective.userName}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                        {perspective.userRole}
                    </div>
                </div>
                {showRating && perspective.rating !== undefined && (
                    <div className="text-right">
                        <div className="text-lg font-bold text-navy-900 dark:text-white">
                            {perspective.rating}/5
                        </div>
                    </div>
                )}
            </div>

            {/* Comment */}
            <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">
                "{perspective.comment}"
            </p>

            {/* Timestamp */}
            <div className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                {new Date(perspective.createdAt).toLocaleDateString('pl-PL')}
            </div>
        </div>
    );
};

const AxisView: React.FC<{
    axis: PerspectiveAxis;
    initialExpanded?: boolean;
}> = ({ axis, initialExpanded = true }) => {
    const [isExpanded, setIsExpanded] = useState(initialExpanded);
    const tension = detectTension(axis.perspectives);

    // Sort perspectives by rating (descending) to show range
    const sortedPerspectives = [...axis.perspectives].sort((a, b) =>
        (b.rating ?? 0) - (a.rating ?? 0)
    );

    return (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {/* Axis Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-800 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <Target size={18} className="text-purple-500" />
                    <div className="text-left">
                        <h3 className="font-semibold text-navy-900 dark:text-white">
                            {axis.axisName}
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            {axis.perspectives.length} perspektyw
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <TensionBadge level={tension} />
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
            </button>

            {/* Perspectives Grid */}
            {isExpanded && (
                <div className="p-4">
                    {axis.perspectives.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                            <Users size={32} className="mx-auto mb-2 opacity-50" />
                            <p>Brak perspektyw dla tej osi.</p>
                            <p className="text-sm">Zaproś członków zespołu, aby dodali swój punkt widzenia.</p>
                        </div>
                    ) : (
                        <>
                            {/* Tension Summary for high tension */}
                            {tension === 'high' && (
                                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-500/30 rounded-lg">
                                    <div className="flex items-start gap-2">
                                        <Scale size={16} className="text-red-600 dark:text-red-400 mt-0.5" />
                                        <div>
                                            <p className="text-sm font-medium text-red-700 dark:text-red-300">
                                                Wykryto znaczące różnice w perspektywach
                                            </p>
                                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                                To może wskazywać na ważny obszar do dyskusji zespołowej.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {sortedPerspectives.map((perspective, idx) => (
                                    <PerspectiveCard
                                        key={perspective.id}
                                        perspective={perspective}
                                        userIndex={idx}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export const MultiPerspectiveView: React.FC<MultiPerspectiveViewProps> = ({
    axes,
    onRequestPerspective,
    className = '',
}) => {
    if (axes.length === 0) {
        return (
            <div className={`text-center py-12 ${className}`}>
                <MessageSquare size={48} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                <h3 className="text-lg font-semibold text-navy-900 dark:text-white mb-2">
                    Jeszcze nie ma perspektyw do porównania
                </h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    Zaproś członków zespołu i poproś ich o ocenę wybranych osi decyzyjnych.
                    Różne punkty widzenia wzbogacą analizę.
                </p>
            </div>
        );
    }

    // Count total perspectives and high-tension axes
    const totalPerspectives = axes.reduce((sum, a) => sum + a.perspectives.length, 0);
    const highTensionAxes = axes.filter(a => detectTension(a.perspectives) === 'high').length;

    return (
        <div className={className}>
            {/* Summary Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
                        <Users size={20} className="text-purple-500" />
                        Perspektywy zespołu
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {totalPerspectives} perspektyw na {axes.length} osiach
                        {highTensionAxes > 0 && (
                            <span className="text-amber-600 dark:text-amber-400 ml-2">
                                • {highTensionAxes} z napięciami
                            </span>
                        )}
                    </p>
                </div>
            </div>

            {/* Axes List */}
            <div className="space-y-4">
                {axes.map((axis, idx) => (
                    <AxisView
                        key={axis.axisId}
                        axis={axis}
                        initialExpanded={idx === 0}
                    />
                ))}
            </div>
        </div>
    );
};

export default MultiPerspectiveView;
