/**
 * RiskRadar - Multi-dimensional risk assessment visualization
 * BCG/McKinsey style: Radar/spider chart for multi-factor analysis
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface RiskDimension {
    label: string;
    value: number;      // 0-100
    benchmark?: number; // Optional benchmark for comparison
}

interface RiskRadarProps {
    dimensions: RiskDimension[];
    size?: number;
    showLabels?: boolean;
    showValues?: boolean;
    showBenchmark?: boolean;
    animate?: boolean;
    color?: string;
    benchmarkColor?: string;
    className?: string;
}

export const RiskRadar: React.FC<RiskRadarProps> = ({
    dimensions,
    size = 200,
    showLabels = true,
    showValues = true,
    showBenchmark = true,
    animate = true,
    color = '#8B5CF6',
    benchmarkColor = '#94A3B8',
    className = ''
}) => {
    const center = size / 2;
    const maxRadius = (size / 2) - 40; // Leave room for labels
    const levels = 4; // Number of concentric circles

    // Calculate polygon points
    const { valuePoints, benchmarkPoints, axisEndPoints, labelPositions } = useMemo(() => {
        const angleStep = (Math.PI * 2) / dimensions.length;
        const startAngle = -Math.PI / 2; // Start from top

        const valuePoints = dimensions.map((dim, i) => {
            const angle = startAngle + i * angleStep;
            const radius = (dim.value / 100) * maxRadius;
            return {
                x: center + radius * Math.cos(angle),
                y: center + radius * Math.sin(angle),
                value: dim.value
            };
        });

        const benchmarkPoints = dimensions.map((dim, i) => {
            const angle = startAngle + i * angleStep;
            const radius = ((dim.benchmark || 0) / 100) * maxRadius;
            return {
                x: center + radius * Math.cos(angle),
                y: center + radius * Math.sin(angle)
            };
        });

        const axisEndPoints = dimensions.map((_, i) => {
            const angle = startAngle + i * angleStep;
            return {
                x: center + maxRadius * Math.cos(angle),
                y: center + maxRadius * Math.sin(angle)
            };
        });

        const labelPositions = dimensions.map((dim, i) => {
            const angle = startAngle + i * angleStep;
            const labelRadius = maxRadius + 20;
            const x = center + labelRadius * Math.cos(angle);
            const y = center + labelRadius * Math.sin(angle);
            
            // Determine text anchor based on position
            let textAnchor = 'middle';
            if (Math.cos(angle) < -0.3) textAnchor = 'end';
            if (Math.cos(angle) > 0.3) textAnchor = 'start';

            return { x, y, label: dim.label, textAnchor, value: dim.value };
        });

        return { valuePoints, benchmarkPoints, axisEndPoints, labelPositions };
    }, [dimensions, center, maxRadius]);

    // Create polygon path
    const createPath = (points: { x: number; y: number }[]) => {
        return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ') + ' Z';
    };

    const valuePath = createPath(valuePoints);
    const benchmarkPath = createPath(benchmarkPoints);

    // Gradient ID
    const gradientId = useMemo(() => `radar-gradient-${Math.random().toString(36).substr(2, 9)}`, []);

    return (
        <svg 
            width={size} 
            height={size} 
            className={`overflow-visible ${className}`}
            viewBox={`0 0 ${size} ${size}`}
        >
            <defs>
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.1" />
                </linearGradient>
            </defs>

            {/* Concentric circles (levels) */}
            {Array.from({ length: levels }, (_, i) => {
                const radius = ((i + 1) / levels) * maxRadius;
                return (
                    <circle
                        key={i}
                        cx={center}
                        cy={center}
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1"
                        className="text-slate-200 dark:text-white/10"
                    />
                );
            })}

            {/* Axis lines */}
            {axisEndPoints.map((point, i) => (
                <line
                    key={i}
                    x1={center}
                    y1={center}
                    x2={point.x}
                    y2={point.y}
                    stroke="currentColor"
                    strokeWidth="1"
                    className="text-slate-200 dark:text-white/10"
                />
            ))}

            {/* Benchmark polygon */}
            {showBenchmark && dimensions.some(d => d.benchmark !== undefined) && (
                <path
                    d={benchmarkPath}
                    fill="none"
                    stroke={benchmarkColor}
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    opacity="0.5"
                />
            )}

            {/* Value polygon - area fill */}
            <motion.path
                d={valuePath}
                fill={`url(#${gradientId})`}
                initial={animate ? { opacity: 0, scale: 0.5 } : undefined}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }}
                style={{ transformOrigin: `${center}px ${center}px` }}
            />

            {/* Value polygon - stroke */}
            <motion.path
                d={valuePath}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinejoin="round"
                initial={animate ? { pathLength: 0, opacity: 0 } : undefined}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                style={{ filter: `drop-shadow(0 2px 4px ${color}40)` }}
            />

            {/* Data points */}
            {valuePoints.map((point, i) => (
                <motion.g key={i}>
                    <motion.circle
                        cx={point.x}
                        cy={point.y}
                        r={5}
                        fill={color}
                        stroke="white"
                        strokeWidth="2"
                        initial={animate ? { scale: 0 } : undefined}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.8 + i * 0.1 }}
                    />
                    {/* Glow effect */}
                    <motion.circle
                        cx={point.x}
                        cy={point.y}
                        r={10}
                        fill={color}
                        opacity={0.2}
                        initial={animate ? { scale: 0 } : undefined}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.8 + i * 0.1 }}
                    />
                </motion.g>
            ))}

            {/* Labels */}
            {showLabels && labelPositions.map((pos, i) => (
                <g key={i}>
                    <text
                        x={pos.x}
                        y={pos.y}
                        textAnchor={pos.textAnchor}
                        dominantBaseline="middle"
                        className="text-[10px] font-medium fill-slate-600 dark:fill-slate-400"
                    >
                        {pos.label}
                    </text>
                    {showValues && (
                        <text
                            x={pos.x}
                            y={pos.y + 12}
                            textAnchor={pos.textAnchor}
                            dominantBaseline="middle"
                            className="text-[9px] font-bold"
                            fill={pos.value >= 70 ? '#10B981' : pos.value >= 40 ? '#F59E0B' : '#F43F5E'}
                        >
                            {pos.value}%
                        </text>
                    )}
                </g>
            ))}

            {/* Center point */}
            <circle
                cx={center}
                cy={center}
                r={3}
                fill="currentColor"
                className="text-slate-300 dark:text-white/30"
            />

            {/* Level labels */}
            {Array.from({ length: levels }, (_, i) => {
                const value = Math.round(((i + 1) / levels) * 100);
                const radius = ((i + 1) / levels) * maxRadius;
                return (
                    <text
                        key={i}
                        x={center + 4}
                        y={center - radius - 2}
                        className="text-[8px] fill-slate-400 dark:fill-slate-500"
                    >
                        {value}
                    </text>
                );
            })}
        </svg>
    );
};

export default RiskRadar;

