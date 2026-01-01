/**
 * VoiceIndicator Component
 * 
 * Compact voice state indicator with:
 * - Animated waveform during listening/speaking
 * - Color coding (green=listening, blue=AI speaking, gray=idle)
 * - Recording duration display
 * - Audio level visualization
 * 
 * Part of the Universal Voice Conversation System
 * 
 * @version 1.0.0
 */

import React, { useMemo } from 'react';
import { Mic, Volume2, Loader2 } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

interface VoiceIndicatorProps {
    state: VoiceState;
    audioLevel?: number; // 0-1
    duration?: number; // seconds
    transcript?: string;
    compact?: boolean;
    className?: string;
    onClick?: () => void;
}

// ============================================================================
// Audio Wave Animation Component
// ============================================================================

const AudioWaves: React.FC<{ level: number; color: string; barCount?: number }> = ({ 
    level, 
    color,
    barCount = 5 
}) => {
    const bars = useMemo(() => {
        return Array.from({ length: barCount }, (_, i) => {
            const baseHeight = 4 + Math.random() * 4;
            const targetHeight = baseHeight + level * 12 * (1 + Math.sin(i * 0.5));
            return Math.min(20, Math.max(4, targetHeight));
        });
    }, [level, barCount]);

    return (
        <div className="flex items-center gap-0.5 h-5">
            {bars.map((height, i) => (
                <div
                    key={i}
                    className={`w-1 rounded-full transition-all duration-100 ${color}`}
                    style={{
                        height: `${height}px`,
                        animationDelay: `${i * 0.1}s`
                    }}
                />
            ))}
        </div>
    );
};

// ============================================================================
// Pulsing Dot Component
// ============================================================================

const PulsingDot: React.FC<{ color: string }> = ({ color }) => (
    <span className="relative flex h-3 w-3">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-75`} />
        <span className={`relative inline-flex rounded-full h-3 w-3 ${color}`} />
    </span>
);

// ============================================================================
// Main Component
// ============================================================================

export const VoiceIndicator: React.FC<VoiceIndicatorProps> = ({
    state,
    audioLevel = 0,
    duration = 0,
    transcript,
    compact = false,
    className = '',
    onClick
}) => {
    // Format duration
    const formattedDuration = useMemo(() => {
        const mins = Math.floor(duration / 60);
        const secs = duration % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }, [duration]);

    // State-based styling
    const stateConfig = useMemo(() => {
        switch (state) {
            case 'listening':
                return {
                    bgColor: 'bg-green-50 dark:bg-green-900/20',
                    borderColor: 'border-green-200 dark:border-green-800',
                    textColor: 'text-green-600 dark:text-green-400',
                    waveColor: 'bg-green-500',
                    icon: Mic,
                    label: 'Listening...',
                    dotColor: 'bg-green-500'
                };
            case 'processing':
                return {
                    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
                    borderColor: 'border-amber-200 dark:border-amber-800',
                    textColor: 'text-amber-600 dark:text-amber-400',
                    waveColor: 'bg-amber-500',
                    icon: Loader2,
                    label: 'Processing...',
                    dotColor: 'bg-amber-500'
                };
            case 'speaking':
                return {
                    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
                    borderColor: 'border-blue-200 dark:border-blue-800',
                    textColor: 'text-blue-600 dark:text-blue-400',
                    waveColor: 'bg-blue-500',
                    icon: Volume2,
                    label: 'Speaking...',
                    dotColor: 'bg-blue-500'
                };
            default:
                return {
                    bgColor: 'bg-slate-50 dark:bg-slate-800/50',
                    borderColor: 'border-slate-200 dark:border-slate-700',
                    textColor: 'text-slate-500 dark:text-slate-400',
                    waveColor: 'bg-slate-400',
                    icon: Mic,
                    label: 'Voice ready',
                    dotColor: 'bg-slate-400'
                };
        }
    }, [state]);

    const Icon = stateConfig.icon;
    const isActive = state !== 'idle';

    // Compact version - just icon and dot
    if (compact) {
        return (
            <button
                onClick={onClick}
                className={`
                    flex items-center gap-1.5 px-2 py-1 rounded-full transition-all
                    ${stateConfig.bgColor} ${stateConfig.borderColor} border
                    ${onClick ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
                    ${className}
                `}
            >
                {isActive ? (
                    <PulsingDot color={stateConfig.dotColor} />
                ) : (
                    <Icon size={14} className={stateConfig.textColor} />
                )}
                {isActive && (
                    <span className={`text-xs font-medium ${stateConfig.textColor}`}>
                        {formattedDuration}
                    </span>
                )}
            </button>
        );
    }

    // Full version with waveform
    return (
        <div
            onClick={onClick}
            className={`
                flex items-center gap-3 px-3 py-2 rounded-xl transition-all
                ${stateConfig.bgColor} ${stateConfig.borderColor} border
                ${onClick ? 'cursor-pointer hover:opacity-90' : ''}
                ${className}
            `}
        >
            {/* Icon */}
            <div className={`
                flex items-center justify-center w-8 h-8 rounded-full
                ${state === 'processing' ? 'animate-pulse' : ''}
                ${isActive ? stateConfig.dotColor : 'bg-slate-200 dark:bg-slate-700'}
            `}>
                <Icon 
                    size={16} 
                    className={`text-white ${state === 'processing' ? 'animate-spin' : ''}`}
                />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    {/* Label */}
                    <span className={`text-sm font-medium ${stateConfig.textColor}`}>
                        {stateConfig.label}
                    </span>

                    {/* Duration */}
                    {isActive && (
                        <span className="text-xs text-slate-500 tabular-nums">
                            {formattedDuration}
                        </span>
                    )}
                </div>

                {/* Transcript preview */}
                {transcript && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        "{transcript}"
                    </p>
                )}
            </div>

            {/* Audio Waves */}
            {isActive && state !== 'processing' && (
                <AudioWaves level={audioLevel} color={stateConfig.waveColor} />
            )}
        </div>
    );
};

// ============================================================================
// Minimal Badge Indicator (for headers/toolbars)
// ============================================================================

export const VoiceBadge: React.FC<{
    state: VoiceState;
    onClick?: () => void;
}> = ({ state, onClick }) => {
    if (state === 'idle') return null;

    const colors = {
        listening: 'bg-green-500',
        processing: 'bg-amber-500',
        speaking: 'bg-blue-500'
    };

    const labels = {
        listening: '🎤',
        processing: '⏳',
        speaking: '🔊'
    };

    return (
        <button
            onClick={onClick}
            className={`
                flex items-center gap-1 px-2 py-0.5 rounded-full text-white text-xs font-medium
                ${colors[state]} animate-pulse
                ${onClick ? 'cursor-pointer hover:opacity-80' : ''}
            `}
        >
            <span>{labels[state]}</span>
        </button>
    );
};

export default VoiceIndicator;


