/**
 * ProgressRing
 * 
 * SVG circular progress indicator:
 * - Animated fill on scroll into view
 * - Single ring (actual) or double ring (actual + target)
 * - Center text with value
 * - Customizable colors and size
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';

interface ProgressRingProps {
    value: number;
    max?: number;
    target?: number;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    label?: string;
    sublabel?: string;
    showValue?: boolean;
    valueFormat?: (value: number) => string;
    color?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'gradient';
    className?: string;
}

const SIZE_CONFIG = {
    sm: { width: 80, strokeWidth: 6, fontSize: 16, sublabelSize: 10 },
    md: { width: 120, strokeWidth: 8, fontSize: 24, sublabelSize: 12 },
    lg: { width: 160, strokeWidth: 10, fontSize: 32, sublabelSize: 14 },
    xl: { width: 200, strokeWidth: 12, fontSize: 40, sublabelSize: 16 }
};

const COLOR_CONFIG = {
    blue: { 
        stroke: '#3b82f6', 
        bg: '#e0e7ff',
        gradient: ['#3b82f6', '#60a5fa']
    },
    green: { 
        stroke: '#10b981', 
        bg: '#d1fae5',
        gradient: ['#10b981', '#34d399']
    },
    amber: { 
        stroke: '#f59e0b', 
        bg: '#fef3c7',
        gradient: ['#f59e0b', '#fbbf24']
    },
    red: { 
        stroke: '#ef4444', 
        bg: '#fee2e2',
        gradient: ['#ef4444', '#f87171']
    },
    purple: { 
        stroke: '#8b5cf6', 
        bg: '#ede9fe',
        gradient: ['#8b5cf6', '#a78bfa']
    },
    gradient: { 
        stroke: 'url(#progressGradient)', 
        bg: '#e0e7ff',
        gradient: ['#3b82f6', '#8b5cf6']
    }
};

export const ProgressRing: React.FC<ProgressRingProps> = ({
    value,
    max = 7,
    target,
    size = 'md',
    label,
    sublabel,
    showValue = true,
    valueFormat,
    color = 'blue',
    className = ''
}) => {
    const ref = useRef<SVGSVGElement>(null);
    const isInView = useInView(ref, { once: true, margin: '-50px' });
    
    const config = SIZE_CONFIG[size];
    const colorConfig = COLOR_CONFIG[color];
    
    const radius = (config.width - config.strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    
    // Calculate progress percentage
    const progress = Math.min(100, (value / max) * 100);
    const targetProgress = target ? Math.min(100, (target / max) * 100) : undefined;
    
    // Calculate stroke dashoffset
    const strokeDashoffset = circumference - (progress / 100) * circumference;
    const targetStrokeDashoffset = targetProgress 
        ? circumference - (targetProgress / 100) * circumference 
        : undefined;
    
    // Format value
    const displayValue = valueFormat ? valueFormat(value) : value.toFixed(1);

    return (
        <div className={`inline-flex flex-col items-center ${className}`}>
            <svg
                ref={ref}
                width={config.width}
                height={config.width}
                className="transform -rotate-90"
            >
                {/* Gradient definition */}
                {color === 'gradient' && (
                    <defs>
                        <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor={colorConfig.gradient[0]} />
                            <stop offset="100%" stopColor={colorConfig.gradient[1]} />
                        </linearGradient>
                    </defs>
                )}

                {/* Background circle */}
                <circle
                    cx={config.width / 2}
                    cy={config.width / 2}
                    r={radius}
                    fill="none"
                    stroke={colorConfig.bg}
                    strokeWidth={config.strokeWidth}
                    className="dark:opacity-20"
                />

                {/* Target circle (if provided) */}
                {targetProgress !== undefined && (
                    <motion.circle
                        cx={config.width / 2}
                        cy={config.width / 2}
                        r={radius - config.strokeWidth - 2}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth={config.strokeWidth / 2}
                        strokeLinecap="round"
                        strokeDasharray={circumference * 0.85}
                        initial={{ strokeDashoffset: circumference * 0.85 }}
                        animate={{ 
                            strokeDashoffset: isInView 
                                ? circumference * 0.85 - (targetProgress / 100) * circumference * 0.85 
                                : circumference * 0.85 
                        }}
                        transition={{ 
                            duration: 1.5, 
                            delay: 0.3,
                            ease: [0.4, 0, 0.2, 1] 
                        }}
                        opacity={0.4}
                    />
                )}

                {/* Progress circle */}
                <motion.circle
                    cx={config.width / 2}
                    cy={config.width / 2}
                    r={radius}
                    fill="none"
                    stroke={colorConfig.stroke}
                    strokeWidth={config.strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ 
                        strokeDashoffset: isInView ? strokeDashoffset : circumference 
                    }}
                    transition={{ 
                        duration: 1.2, 
                        delay: 0.2,
                        ease: [0.4, 0, 0.2, 1] 
                    }}
                />
            </svg>

            {/* Center content */}
            <div 
                className="absolute flex flex-col items-center justify-center"
                style={{ 
                    width: config.width, 
                    height: config.width,
                    marginTop: -config.width
                }}
            >
                {showValue && (
                    <motion.span
                        className="font-bold text-navy-900 dark:text-white tabular-nums"
                        style={{ fontSize: config.fontSize }}
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ 
                            opacity: isInView ? 1 : 0, 
                            scale: isInView ? 1 : 0.5 
                        }}
                        transition={{ duration: 0.5, delay: 0.8 }}
                    >
                        {displayValue}
                    </motion.span>
                )}
                {sublabel && (
                    <span 
                        className="text-slate-500 dark:text-slate-400"
                        style={{ fontSize: config.sublabelSize }}
                    >
                        {sublabel}
                    </span>
                )}
            </div>

            {/* Label below */}
            {label && (
                <span 
                    className="mt-2 text-center text-slate-600 dark:text-slate-400 font-medium"
                    style={{ fontSize: config.sublabelSize + 2 }}
                >
                    {label}
                </span>
            )}
        </div>
    );
};

// Compact version for inline use
export const ProgressRingCompact: React.FC<{
    value: number;
    max?: number;
    size?: number;
    color?: string;
}> = ({ value, max = 7, size = 24, color = '#3b82f6' }) => {
    const radius = (size - 3) / 2;
    const circumference = radius * 2 * Math.PI;
    const progress = Math.min(100, (value / max) * 100);
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
        <svg width={size} height={size} className="transform -rotate-90">
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#e5e7eb"
                strokeWidth={3}
                className="dark:stroke-white/10"
            />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={color}
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
            />
        </svg>
    );
};

export default ProgressRing;

