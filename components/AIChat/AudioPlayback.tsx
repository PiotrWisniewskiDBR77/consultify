/**
 * AudioPlayback Component
 * 
 * Inline audio player for AI voice responses with:
 * - Progress bar with seek
 * - Speed control (0.5x - 2x)
 * - Pause/Play/Stop buttons
 * - Time display
 * - Compact and expanded variants
 * 
 * Part of the Universal Voice Conversation System
 * 
 * @version 1.0.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Square, Volume2, VolumeX, RotateCcw } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface AudioPlaybackProps {
    /** Audio source URL or blob URL */
    src: string;
    /** Auto-play on mount */
    autoPlay?: boolean;
    /** Callback when playback ends */
    onEnded?: () => void;
    /** Callback when playback starts */
    onPlay?: () => void;
    /** Callback on error */
    onError?: (error: string) => void;
    /** Compact mode (minimal UI) */
    compact?: boolean;
    /** Additional class names */
    className?: string;
    /** Show speed controls */
    showSpeedControl?: boolean;
    /** Initial playback speed */
    initialSpeed?: number;
}

// ============================================================================
// Speed Options
// ============================================================================

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

// ============================================================================
// Component
// ============================================================================

export const AudioPlayback: React.FC<AudioPlaybackProps> = ({
    src,
    autoPlay = false,
    onEnded,
    onPlay,
    onError,
    compact = false,
    className = '',
    showSpeedControl = true,
    initialSpeed = 1
}) => {
    // State
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [speed, setSpeed] = useState(initialSpeed);
    const [isMuted, setIsMuted] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Refs
    const audioRef = useRef<HTMLAudioElement>(null);
    const progressRef = useRef<HTMLDivElement>(null);

    // Progress percentage
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

    // Format time
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // ========================================================================
    // Audio Event Handlers
    // ========================================================================

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const handleLoadedMetadata = () => {
            setDuration(audio.duration);
            setIsLoading(false);
        };

        const handleTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
        };

        const handleEnded = () => {
            setIsPlaying(false);
            setIsPaused(false);
            setCurrentTime(0);
            onEnded?.();
        };

        const handleError = () => {
            const errorMsg = 'Failed to load audio';
            setError(errorMsg);
            setIsLoading(false);
            onError?.(errorMsg);
        };

        const handlePlay = () => {
            setIsPlaying(true);
            setIsPaused(false);
            onPlay?.();
        };

        const handlePause = () => {
            setIsPaused(true);
        };

        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('error', handleError);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);

        // Auto-play
        if (autoPlay) {
            audio.play().catch(() => {
                // Auto-play blocked by browser
            });
        }

        return () => {
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('error', handleError);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
        };
    }, [autoPlay, onEnded, onPlay, onError]);

    // Update speed
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.playbackRate = speed;
        }
    }, [speed]);

    // Update mute
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.muted = isMuted;
        }
    }, [isMuted]);

    // ========================================================================
    // Control Handlers
    // ========================================================================

    const togglePlay = useCallback(() => {
        if (!audioRef.current) return;

        if (isPlaying && !isPaused) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
    }, [isPlaying, isPaused]);

    const stop = useCallback(() => {
        if (!audioRef.current) return;
        
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
        setIsPaused(false);
        setCurrentTime(0);
    }, []);

    const restart = useCallback(() => {
        if (!audioRef.current) return;
        
        audioRef.current.currentTime = 0;
        audioRef.current.play();
    }, []);

    const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioRef.current || !progressRef.current) return;

        const rect = progressRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        const newTime = percentage * duration;

        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
    }, [duration]);

    const cycleSpeed = useCallback(() => {
        const currentIndex = SPEED_OPTIONS.indexOf(speed);
        const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length;
        setSpeed(SPEED_OPTIONS[nextIndex]);
    }, [speed]);

    // ========================================================================
    // Render
    // ========================================================================

    if (error) {
        return (
            <div className={`flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400 text-sm ${className}`}>
                <VolumeX size={16} />
                <span>{error}</span>
            </div>
        );
    }

    // Compact version
    if (compact) {
        return (
            <div className={`inline-flex items-center gap-1 ${className}`}>
                <audio ref={audioRef} src={src} preload="metadata" />
                
                <button
                    onClick={togglePlay}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400"
                    disabled={isLoading}
                >
                    {isPlaying && !isPaused ? (
                        <Pause size={16} />
                    ) : (
                        <Play size={16} />
                    )}
                </button>

                <span className="text-xs text-slate-500 tabular-nums min-w-[40px]">
                    {formatTime(currentTime)}
                </span>

                {showSpeedControl && (
                    <button
                        onClick={cycleSpeed}
                        className="px-1.5 py-0.5 text-xs rounded bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/20"
                    >
                        {speed}x
                    </button>
                )}
            </div>
        );
    }

    // Full version
    return (
        <div className={`bg-slate-50 dark:bg-navy-800/50 rounded-xl p-3 ${className}`}>
            <audio ref={audioRef} src={src} preload="metadata" />

            {/* Progress Bar */}
            <div
                ref={progressRef}
                onClick={seek}
                className="relative h-2 bg-slate-200 dark:bg-slate-700 rounded-full cursor-pointer group mb-3"
            >
                {/* Buffered/Loaded indicator */}
                <div
                    className="absolute h-full bg-slate-300 dark:bg-slate-600 rounded-full"
                    style={{ width: `${progress}%` }}
                />
                
                {/* Progress */}
                <div
                    className="absolute h-full bg-primary-500 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                />

                {/* Scrubber */}
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-primary-500 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ left: `calc(${progress}% - 6px)` }}
                />
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between">
                {/* Left: Play controls */}
                <div className="flex items-center gap-1">
                    {/* Restart */}
                    <button
                        onClick={restart}
                        className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-colors"
                        title="Restart"
                    >
                        <RotateCcw size={16} />
                    </button>

                    {/* Play/Pause */}
                    <button
                        onClick={togglePlay}
                        disabled={isLoading}
                        className={`
                            p-2 rounded-lg transition-colors
                            ${isPlaying && !isPaused
                                ? 'bg-primary-500 text-white'
                                : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-white/20'
                            }
                        `}
                        title={isPlaying && !isPaused ? 'Pause' : 'Play'}
                    >
                        {isLoading ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : isPlaying && !isPaused ? (
                            <Pause size={16} />
                        ) : (
                            <Play size={16} />
                        )}
                    </button>

                    {/* Stop */}
                    <button
                        onClick={stop}
                        className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-colors"
                        title="Stop"
                    >
                        <Square size={16} />
                    </button>
                </div>

                {/* Center: Time */}
                <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    <span>{formatTime(currentTime)}</span>
                    <span>/</span>
                    <span>{formatTime(duration)}</span>
                </div>

                {/* Right: Speed & Volume */}
                <div className="flex items-center gap-1">
                    {/* Speed */}
                    {showSpeedControl && (
                        <button
                            onClick={cycleSpeed}
                            className="px-2 py-1 text-xs rounded-lg bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-white/20 transition-colors font-medium"
                            title="Playback speed"
                        >
                            {speed}x
                        </button>
                    )}

                    {/* Mute */}
                    <button
                        onClick={() => setIsMuted(!isMuted)}
                        className={`
                            p-1.5 rounded-lg transition-colors
                            ${isMuted
                                ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
                            }
                        `}
                        title={isMuted ? 'Unmute' : 'Mute'}
                    >
                        {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AudioPlayback;









