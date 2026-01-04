/**
 * TrendAreaChart - Time series visualization with area fill
 * BCG/McKinsey style: Clean lines, gradient fill, trend annotations
 */

import { motion } from 'framer-motion';
import React, { useMemo } from 'react';

interface DataPoint {
    label: string;
    value: number;
    target?: number;
}

interface TrendAreaChartProps {
    data: DataPoint[];
    width?: number;
    height?: number;
    showGrid?: boolean;
    showLabels?: boolean;
    showTarget?: boolean;
    showDots?: boolean;
    animate?: boolean;
    color?: string;
    targetColor?: string;
    fillOpacity?: number;
    yAxisMin?: number;
    yAxisMax?: number;
    formatValue?: (value: number) => string;
    className?: string;
}

export const TrendAreaChart: React.FC<TrendAreaChartProps> = ({
    data,
    width = 300,
    height = 150,
    showGrid = true,
    showLabels = true,
    showTarget = true,
    showDots = true,
    animate = true,
    color = '#8B5CF6',
    targetColor = '#F59E0B',
    fillOpacity = 0.2,
    yAxisMin,
    yAxisMax,
    formatValue = (v) => v.toString(),
    className = '',
}) => {
    const padding = { top: 10, right: 10, bottom: showLabels ? 24 : 10, left: 40 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Calculate scales
    const { minY, maxY, points, targetLine, areaPath, linePath } = useMemo(() => {
        if (data.length === 0) return { minY: 0, maxY: 100, points: [], targetLine: '', areaPath: '', linePath: '' };

        const values = data.map((d) => d.value);
        const targets = data.filter((d) => d.target !== undefined).map((d) => d.target!);
        const allValues = [...values, ...targets];

        const dataMin = Math.min(...allValues);
        const dataMax = Math.max(...allValues);
        const minY = yAxisMin !== undefined ? yAxisMin : Math.floor(dataMin * 0.9);
        const maxY = yAxisMax !== undefined ? yAxisMax : Math.ceil(dataMax * 1.1);
        const range = maxY - minY || 1;

        // Calculate points
        const points = data.map((d, i) => {
            const x = padding.left + (i / (data.length - 1)) * chartWidth;
            const y = padding.top + chartHeight - ((d.value - minY) / range) * chartHeight;
            return { x, y, value: d.value, label: d.label, target: d.target };
        });

        // Create line path
        const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ');

        // Create area path (closed)
        const areaPath = `${linePath} L ${points[points.length - 1].x},${padding.top + chartHeight} L ${padding.left},${padding.top + chartHeight} Z`;

        // Target line (if targets exist)
        const targetPoints = data
            .map((d, i) => ({ x: padding.left + (i / (data.length - 1)) * chartWidth, target: d.target }))
            .filter((p) => p.target !== undefined);

        const targetLine =
            targetPoints.length > 0
                ? targetPoints
                      .map((p, i) => {
                          const y = padding.top + chartHeight - ((p.target! - minY) / range) * chartHeight;
                          return `${i === 0 ? 'M' : 'L'} ${p.x},${y}`;
                      })
                      .join(' ')
                : '';

        return { minY, maxY, points, targetLine, areaPath, linePath };
    }, [data, chartWidth, chartHeight, padding, yAxisMin, yAxisMax]);

    // Y-axis ticks
    const yTicks = useMemo(() => {
        const tickCount = 4;
        const range = maxY - minY;
        return Array.from({ length: tickCount + 1 }, (_, i) => {
            const value = minY + (i / tickCount) * range;
            const y = padding.top + chartHeight - (i / tickCount) * chartHeight;
            return { value, y };
        });
    }, [minY, maxY, chartHeight, padding]);

    // Gradient ID
    const gradientId = useMemo(() => `area-gradient-${Math.random().toString(36).substr(2, 9)}`, []);

    return (
        <svg
            width={width}
            height={height}
            className={`overflow-visible ${className}`}
            viewBox={`0 0 ${width} ${height}`}
        >
            <defs>
                {/* Area gradient */}
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>

            {/* Grid lines */}
            {showGrid &&
                yTicks.map((tick, i) => (
                    <g key={i}>
                        <line
                            x1={padding.left}
                            y1={tick.y}
                            x2={width - padding.right}
                            y2={tick.y}
                            stroke="currentColor"
                            strokeWidth="1"
                            strokeDasharray={i === 0 ? '0' : '2 4'}
                            className="text-slate-200 dark:text-white/10"
                        />
                        <text
                            x={padding.left - 8}
                            y={tick.y}
                            textAnchor="end"
                            dominantBaseline="middle"
                            className="text-[10px] fill-slate-400 dark:fill-slate-500"
                        >
                            {formatValue(tick.value)}
                        </text>
                    </g>
                ))}

            {/* Area fill */}
            <motion.path
                d={areaPath}
                fill={`url(#${gradientId})`}
                initial={animate ? { opacity: 0 } : undefined}
                animate={{ opacity: 1 }}
                transition={{ duration: 1 }}
            />

            {/* Target line */}
            {showTarget && targetLine && (
                <path
                    d={targetLine}
                    fill="none"
                    stroke={targetColor}
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    className="opacity-60"
                />
            )}

            {/* Main line */}
            <motion.path
                d={linePath}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={animate ? { pathLength: 0, opacity: 0 } : undefined}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
                style={{ filter: `drop-shadow(0 2px 4px ${color}40)` }}
            />

            {/* Data points */}
            {showDots &&
                points.map((point, i) => (
                    <motion.g key={i}>
                        <motion.circle
                            cx={point.x}
                            cy={point.y}
                            r={i === points.length - 1 ? 5 : 3}
                            fill={color}
                            initial={animate ? { scale: 0 } : undefined}
                            animate={{ scale: 1 }}
                            transition={{ delay: 1 + i * 0.1 }}
                        />
                        {i === points.length - 1 && (
                            <motion.circle
                                cx={point.x}
                                cy={point.y}
                                r={8}
                                fill={color}
                                opacity={0.3}
                                initial={animate ? { scale: 0 } : undefined}
                                animate={{ scale: 1 }}
                                transition={{ delay: 1 + i * 0.1 }}
                            />
                        )}
                    </motion.g>
                ))}

            {/* X-axis labels */}
            {showLabels &&
                points.map((point, i) => (
                    <text
                        key={i}
                        x={point.x}
                        y={height - 6}
                        textAnchor="middle"
                        className="text-[9px] fill-slate-400 dark:fill-slate-500"
                    >
                        {point.label}
                    </text>
                ))}

            {/* Current value annotation */}
            {points.length > 0 && (
                <g>
                    <rect
                        x={points[points.length - 1].x + 8}
                        y={points[points.length - 1].y - 12}
                        width={36}
                        height={20}
                        rx={4}
                        fill={color}
                    />
                    <text
                        x={points[points.length - 1].x + 26}
                        y={points[points.length - 1].y + 2}
                        textAnchor="middle"
                        className="text-[10px] font-bold fill-white"
                    >
                        {formatValue(points[points.length - 1].value)}
                    </text>
                </g>
            )}
        </svg>
    );
};

export default TrendAreaChart;


