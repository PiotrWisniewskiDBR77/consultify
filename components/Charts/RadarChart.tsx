/**
 * Enhanced Radar Chart Component
 *
 * Professional radar chart for digitization maturity visualization.
 * Supports current vs target scores with interactive tooltips.
 */

import React, { useMemo, useState } from 'react';
import {
    Legend,
    PolarAngleAxis,
    PolarGrid,
    PolarRadiusAxis,
    Radar,
    RadarChart as RechartsRadarChart,
    ResponsiveContainer,
    Tooltip,
} from 'recharts';

export interface RadarDataPoint {
    axis: string;
    axisId?: string;
    current: number;
    target: number;
    fullMark?: number;
}

interface RadarChartProps {
    data: RadarDataPoint[];
    showLegend?: boolean;
    showTarget?: boolean;
    height?: number;
    currentColor?: string;
    targetColor?: string;
    className?: string;
    animationDuration?: number;
}

interface TooltipPayload {
    payload: RadarDataPoint;
    dataKey: string;
    value: number;
    color: string;
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0]?.payload;
    if (!data) return null;

    return (
        <div className="bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-3 min-w-[160px]">
            <p className="font-medium text-white text-sm mb-2">{data.axis}</p>
            <div className="space-y-1">
                <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-400 text-xs">Aktualny:</span>
                    <span className="text-blue-400 font-semibold">{data.current.toFixed(1)}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-400 text-xs">Docelowy:</span>
                    <span className="text-emerald-400 font-semibold">{data.target.toFixed(1)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-700">
                    <span className="text-slate-400 text-xs">Luka:</span>
                    <span
                        className={`font-semibold ${data.target - data.current > 0 ? 'text-amber-400' : 'text-emerald-400'}`}
                    >
                        {(data.target - data.current).toFixed(1)}
                    </span>
                </div>
            </div>
        </div>
    );
};

export const RadarChart: React.FC<RadarChartProps> = ({
    data,
    showLegend = true,
    showTarget = true,
    height = 400,
    currentColor = '#3b82f6',
    targetColor = '#10b981',
    className = '',
    animationDuration = 500,
}) => {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    // Ensure data has fullMark
    const chartData = useMemo(
        () =>
            data.map((d) => ({
                ...d,
                fullMark: d.fullMark ?? 7,
            })),
        [data],
    );

    // Calculate overall scores
    const overallCurrent = useMemo(() => {
        if (chartData.length === 0) return 0;
        return chartData.reduce((acc, d) => acc + d.current, 0) / chartData.length;
    }, [chartData]);

    const overallTarget = useMemo(() => {
        if (chartData.length === 0) return 0;
        return chartData.reduce((acc, d) => acc + d.target, 0) / chartData.length;
    }, [chartData]);

    return (
        <div className={`relative ${className}`}>
            {/* Overall scores summary */}
            <div className="absolute top-0 left-0 z-10 flex gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: currentColor }} />
                    <span className="text-slate-400">Średnia:</span>
                    <span className="font-semibold text-white">{overallCurrent.toFixed(1)}</span>
                </div>
                {showTarget && (
                    <div className="flex items-center gap-1.5">
                        <div
                            className="w-3 h-3 rounded-full border-2"
                            style={{ borderColor: targetColor, backgroundColor: 'transparent' }}
                        />
                        <span className="text-slate-400">Cel:</span>
                        <span className="font-semibold text-white">{overallTarget.toFixed(1)}</span>
                    </div>
                )}
            </div>

            <ResponsiveContainer width="100%" height={height}>
                <RechartsRadarChart
                    cx="50%"
                    cy="50%"
                    outerRadius="75%"
                    data={chartData}
                    margin={{ top: 30, right: 30, bottom: 10, left: 30 }}
                >
                    <PolarGrid stroke="#334155" strokeOpacity={0.5} gridType="polygon" />
                    <PolarAngleAxis
                        dataKey="axis"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        tickLine={{ stroke: '#475569' }}
                    />
                    <PolarRadiusAxis
                        angle={90}
                        domain={[0, 7]}
                        tick={{ fill: '#64748b', fontSize: 10 }}
                        tickCount={8}
                        axisLine={{ stroke: '#475569' }}
                    />

                    {/* Target area (rendered first, behind current) */}
                    {showTarget && (
                        <Radar
                            name="Docelowy"
                            dataKey="target"
                            stroke={targetColor}
                            fill={targetColor}
                            fillOpacity={0.15}
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            animationDuration={animationDuration}
                        />
                    )}

                    {/* Current score area */}
                    <Radar
                        name="Aktualny"
                        dataKey="current"
                        stroke={currentColor}
                        fill={currentColor}
                        fillOpacity={0.4}
                        strokeWidth={2}
                        activeDot={{ r: 6, fill: currentColor, stroke: '#fff', strokeWidth: 2 }}
                        animationDuration={animationDuration}
                    />

                    <Tooltip content={<CustomTooltip />} />

                    {showLegend && (
                        <Legend
                            wrapperStyle={{ paddingTop: 20 }}
                            formatter={(value) => <span className="text-slate-300 text-sm">{value}</span>}
                        />
                    )}
                </RechartsRadarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default RadarChart;

