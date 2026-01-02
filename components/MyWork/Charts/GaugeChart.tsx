/**
 * GaugeChart - Executive-grade score gauge visualization
 * BCG/McKinsey style: Clean, prominent, with animated fill
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

interface GaugeChartProps {
    value: number;          // 0-100
    maxValue?: number;
    size?: number;          // Width/height in pixels
    strokeWidth?: number;
    showValue?: boolean;
    showLabel?: boolean;
    label?: string;
    animate?: boolean;
    thresholds?: {
        excellent: number;  // >= this is excellent
        good: number;       // >= this is good
        warning: number;    // >= this is warning
        // Below warning is critical
    };
    colors?: {
        excellent: string;
        good: string;
        warning: string;
        critical: string;
        background: string;
    };
    className?: string;
}

// Default colors (BCG style)
const defaultColors = {
    excellent: '#10B981',  // Emerald
    good: '#06B6D4',       // Cyan
    warning: '#F59E0B',    // Amber
    critical: '#F43F5E',   // Rose
    background: 'rgba(255, 255, 255, 0.1)'
};

const defaultThresholds = {
    excellent: 80,
    good: 60,
    warning: 40
};

// Animated number counter
const AnimatedValue: React.FC<{ value: number; duration?: number }> = ({ value, duration = 1500 }) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        let startTime: number;
        let animationFrame: number;

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            
            // Easing
            const eased = 1 - Math.pow(1 - progress, 4);
            setDisplayValue(Math.floor(eased * value));

            if (progress < 1) {
                animationFrame = requestAnimationFrame(animate);
            }
        };

        animationFrame = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrame);
    }, [value, duration]);

    return <>{displayValue}</>;
};

export const GaugeChart: React.FC<GaugeChartProps> = ({
    value,
    maxValue = 100,
    size = 160,
    strokeWidth = 12,
    showValue = true,
    showLabel = true,
    label = 'Score',
    animate = true,
    thresholds = defaultThresholds,
    colors = defaultColors,
    className = ''
}) => {
    const normalizedValue = Math.min(Math.max(value, 0), maxValue);
    const percentage = (normalizedValue / maxValue) * 100;
    
    // Calculate arc properties (270 degrees total, starting from bottom-left)
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * Math.PI * 1.5; // 270 degrees = 1.5π radians
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    // Determine color based on thresholds
    const getColor = () => {
        if (percentage >= thresholds.excellent) return colors.excellent;
        if (percentage >= thresholds.good) return colors.good;
        if (percentage >= thresholds.warning) return colors.warning;
        return colors.critical;
    };

    const getGlowColor = () => {
        const color = getColor();
        return color.replace(')', ', 0.4)').replace('rgb', 'rgba').replace('#', '');
    };

    const getLabel = () => {
        if (percentage >= thresholds.excellent) return 'Excellent';
        if (percentage >= thresholds.good) return 'Good';
        if (percentage >= thresholds.warning) return 'Fair';
        return 'Critical';
    };

    const strokeColor = getColor();

    // SVG path for arc (270 degrees, starting from 135° and ending at 45°)
    const startAngle = 135;
    const endAngle = 45;
    
    const describeArc = (cx: number, cy: number, r: number, startAngle: number, sweepAngle: number) => {
        const start = polarToCartesian(cx, cy, r, startAngle);
        const end = polarToCartesian(cx, cy, r, startAngle + sweepAngle);
        const largeArcFlag = sweepAngle > 180 ? 1 : 0;
        
        return [
            'M', start.x, start.y,
            'A', r, r, 0, largeArcFlag, 1, end.x, end.y
        ].join(' ');
    };

    const polarToCartesian = (cx: number, cy: number, r: number, angle: number) => {
        const angleInRadians = (angle - 90) * Math.PI / 180;
        return {
            x: cx + r * Math.cos(angleInRadians),
            y: cy + r * Math.sin(angleInRadians)
        };
    };

    const center = size / 2;
    const backgroundPath = describeArc(center, center, radius, startAngle, 270);

    return (
        <div className={`relative inline-flex flex-col items-center ${className}`}>
            <svg 
                width={size} 
                height={size * 0.85} 
                viewBox={`0 0 ${size} ${size * 0.85}`}
                className="overflow-visible"
            >
                {/* Background arc */}
                <path
                    d={backgroundPath}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    className="text-slate-200 dark:text-white/10"
                />
                
                {/* Value arc */}
                <motion.path
                    d={describeArc(center, center, radius, startAngle, (percentage / 100) * 270)}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    initial={animate ? { pathLength: 0, opacity: 0 } : undefined}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 1.5, ease: 'easeOut' }}
                    style={{
                        filter: `drop-shadow(0 0 8px ${strokeColor}40)`
                    }}
                />

                {/* Tick marks */}
                {[0, 25, 50, 75, 100].map((tick, i) => {
                    const tickAngle = startAngle + (tick / 100) * 270;
                    const innerRadius = radius - strokeWidth / 2 - 4;
                    const outerRadius = radius - strokeWidth / 2 - 10;
                    const inner = polarToCartesian(center, center, innerRadius, tickAngle);
                    const outer = polarToCartesian(center, center, outerRadius, tickAngle);
                    
                    return (
                        <line
                            key={tick}
                            x1={inner.x}
                            y1={inner.y}
                            x2={outer.x}
                            y2={outer.y}
                            stroke="currentColor"
                            strokeWidth="1.5"
                            className="text-slate-300 dark:text-white/20"
                        />
                    );
                })}
            </svg>

            {/* Center content */}
            {showValue && (
                <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: size * 0.1 }}>
                    <span 
                        className="font-bold tabular-nums text-navy-900 dark:text-white"
                        style={{ fontSize: size * 0.25 }}
                    >
                        {animate ? <AnimatedValue value={normalizedValue} /> : normalizedValue}
                    </span>
                    {showLabel && (
                        <span 
                            className="text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                            style={{ fontSize: size * 0.08 }}
                        >
                            {label}
                        </span>
                    )}
                </div>
            )}

            {/* Status label below */}
            <div 
                className="mt-2 px-3 py-1 rounded-full text-xs font-bold"
                style={{
                    backgroundColor: `${strokeColor}20`,
                    color: strokeColor
                }}
            >
                {getLabel()}
            </div>
        </div>
    );
};

export default GaugeChart;



