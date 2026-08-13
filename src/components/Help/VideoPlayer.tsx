/**
 * VideoPlayer Component
 *
 * Enterprise-grade video player for help tutorials with:
 * - Chapters/markers support
 * - Playback speed control
 * - Fullscreen mode
 * - Progress tracking (localStorage)
 * - Keyboard shortcuts
 * - Bilingual support
 */

import {
  BookOpen,
  Check,
  ChevronRight,
  Clock,
  Maximize,
  Minimize,
  Pause,
  Play,
  Settings,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// Video progress storage key
const VIDEO_PROGRESS_KEY = 'consultify_video_progress';
const VIDEO_POSITION_KEY = 'consultify_video_positions';

interface Chapter {
  time: number; // seconds
  title: string;
  titlePl?: string;
}

interface VideoPlayerProps {
  videoId: string;
  src: string;
  title: string;
  titlePl?: string;
  poster?: string;
  chapters?: Chapter[];
  onComplete?: () => void;
  onProgress?: (progress: number) => void;
  autoplay?: boolean;
  className?: string;
}

// Playback speed options
const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

// Format time as MM:SS or HH:MM:SS
const formatTime = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Get saved position for video
const getSavedPosition = (videoId: string): number => {
  try {
    const stored = localStorage.getItem(VIDEO_POSITION_KEY);
    if (stored) {
      const positions = JSON.parse(stored);
      return positions[videoId] || 0;
    }
  } catch {
    // Ignore errors
  }
  return 0;
};

// Save position for video
const savePosition = (videoId: string, position: number) => {
  try {
    const stored = localStorage.getItem(VIDEO_POSITION_KEY);
    const positions = stored ? JSON.parse(stored) : {};
    positions[videoId] = position;
    localStorage.setItem(VIDEO_POSITION_KEY, JSON.stringify(positions));
  } catch {
    // Ignore errors
  }
};

// Mark video as watched
const markVideoWatched = (videoId: string) => {
  try {
    const stored = localStorage.getItem(VIDEO_PROGRESS_KEY);
    const watched = stored ? JSON.parse(stored) : [];
    if (!watched.includes(videoId)) {
      watched.push(videoId);
      localStorage.setItem(VIDEO_PROGRESS_KEY, JSON.stringify(watched));
    }
  } catch {
    // Ignore errors
  }
};

// Check if video is watched
const isVideoWatched = (videoId: string): boolean => {
  try {
    const stored = localStorage.getItem(VIDEO_PROGRESS_KEY);
    const watched = stored ? JSON.parse(stored) : [];
    return watched.includes(videoId);
  } catch {
    return false;
  }
};

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoId,
  src,
  title,
  titlePl,
  poster,
  chapters = [],
  onComplete,
  onProgress,
  autoplay = false,
  className = '',
}) => {
  const { t, i18n } = useTranslation();
  const HELP_LANGS = ['en', 'pl', 'de', 'ar', 'ja', 'es'];
  const baseLang = (i18n.language || 'en').split('-')[0].toLowerCase();
  const lang = HELP_LANGS.includes(baseLang) ? baseLang : 'en';

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [watched, setWatched] = useState(() => isVideoWatched(videoId));

  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);

  const displayTitle = lang === 'pl' && titlePl ? titlePl : title;

  // Initialize video
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Restore saved position
    const savedPosition = getSavedPosition(videoId);
    if (savedPosition > 0 && savedPosition < duration - 5) {
      video.currentTime = savedPosition;
    }

    // Set playback speed
    video.playbackRate = playbackSpeed;
  }, [videoId, duration, playbackSpeed]);

  // Handle video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      savePosition(videoId, video.currentTime);

      // Calculate progress percentage
      if (duration > 0) {
        const progress = (video.currentTime / duration) * 100;
        onProgress?.(progress);

        // Mark as watched if >= 90% complete
        if (progress >= 90 && !watched) {
          markVideoWatched(videoId);
          setWatched(true);
          onComplete?.();
        }
      }
    };
    const handleDurationChange = () => setDuration(video.duration);
    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };
    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1);
        setBuffered((bufferedEnd / video.duration) * 100);
      }
    };
    const handleEnded = () => {
      setIsPlaying(false);
      if (!watched) {
        markVideoWatched(videoId);
        setWatched(true);
        onComplete?.();
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('progress', handleProgress);
      video.removeEventListener('ended', handleEnded);
    };
  }, [videoId, duration, watched, onComplete, onProgress]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        !containerRef.current?.contains(document.activeElement) &&
        document.activeElement !== document.body
      ) {
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          video.currentTime = Math.max(0, video.currentTime - 10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          video.currentTime = Math.min(duration, video.currentTime + 10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          video.volume = Math.min(1, video.volume + 0.1);
          break;
        case 'ArrowDown':
          e.preventDefault();
          video.volume = Math.max(0, video.volume - 0.1);
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'Escape':
          if (isFullscreen) {
            e.preventDefault();
            exitFullscreen();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [duration, isFullscreen]);

  // Auto-hide controls
  const resetHideControlsTimer = useCallback(() => {
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    setShowControls(true);
    if (isPlaying) {
      hideControlsTimeout.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    resetHideControlsTimer();
    return () => {
      if (hideControlsTimeout.current) {
        clearTimeout(hideControlsTimeout.current);
      }
    };
  }, [isPlaying, resetHideControlsTimer]);

  // Playback controls
  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen();
      setIsFullscreen(true);
    } else {
      exitFullscreen();
    }
  };

  const exitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    setIsFullscreen(false);
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    const progress = progressRef.current;
    if (!video || !progress) return;

    const rect = progress.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    video.currentTime = pos * duration;
  };

  const handleSpeedChange = (speed: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
    setPlaybackSpeed(speed);
    setShowSettings(false);
  };

  const jumpToChapter = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setShowChapters(false);
  };

  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
  };

  // Get current chapter
  const currentChapter = chapters.reduce((current, chapter) => {
    if (currentTime >= chapter.time) return chapter;
    return current;
  }, chapters[0]);

  return (
    <div
      ref={containerRef}
      className={`relative bg-black rounded-xl overflow-hidden group ${className}`}
      onMouseMove={resetHideControlsTimer}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full h-full object-contain"
        autoPlay={autoplay}
        onClick={togglePlay}
        playsInline
      />

      {/* Watched Badge */}
      {watched && (
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-green-500 text-white text-xs font-medium rounded-full">
          <Check size={12} />
          {t('help.video.watched')}
        </div>
      )}

      {/* Center Play Button (when paused) */}
      {!isPlaying && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity"
        >
          <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center hover:scale-110 transition-transform">
            <Play size={40} className="text-slate-900 dark:text-white ml-1" />
          </div>
        </button>
      )}

      {/* Controls Overlay */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
      >
        {/* Title & Chapter */}
        <div className="px-4 pt-8 pb-2">
          <h4 className="text-white font-medium text-sm truncate">{displayTitle}</h4>
          {currentChapter && (
            <p className="text-white/60 text-xs mt-0.5">
              {lang === 'pl' && currentChapter.titlePl
                ? currentChapter.titlePl
                : currentChapter.title}
            </p>
          )}
        </div>

        {/* Progress Bar */}
        <div ref={progressRef} className="px-4 py-2 cursor-pointer" onClick={handleProgressClick}>
          <div className="relative h-1 bg-white/20 rounded-full group-hover:h-1.5 transition-all">
            {/* Buffered */}
            <div
              className="absolute inset-y-0 left-0 bg-white/30 rounded-full"
              style={{ width: `${buffered}%` }}
            />
            {/* Progress */}
            <div
              className="absolute inset-y-0 left-0 bg-navy-900 rounded-full"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
            {/* Chapter Markers */}
            {chapters.map((chapter, idx) => (
              <div
                key={idx}
                className="absolute top-1/2 -translate-y-1/2 w-1 h-3 bg-white/60 rounded-full"
                style={{ left: `${(chapter.time / duration) * 100}%` }}
                title={chapter.title}
              />
            ))}
            {/* Thumb */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white dark:bg-navy-900 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between px-4 pb-3">
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <button
              onClick={togglePlay}
              className="p-1.5 text-white hover:text-primary-400 transition-colors"
              title={isPlaying ? t('help.video.controls.pause') : t('help.video.controls.play')}
            >
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </button>

            {/* Skip Back */}
            <button
              onClick={() => skip(-10)}
              className="p-1.5 text-white hover:text-primary-400 transition-colors"
              title={t('help.video.controls.prev10')}
            >
              <SkipBack size={18} />
            </button>

            {/* Skip Forward */}
            <button
              onClick={() => skip(10)}
              className="p-1.5 text-white hover:text-primary-400 transition-colors"
              title={t('help.video.controls.next10')}
            >
              <SkipForward size={18} />
            </button>

            {/* Volume */}
            <button
              onClick={toggleMute}
              className="p-1.5 text-white hover:text-primary-400 transition-colors"
              title={isMuted ? t('help.video.controls.unmute') : t('help.video.controls.mute')}
            >
              {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            {/* Time */}
            <span className="text-white/80 text-xs font-mono ml-2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Chapters */}
            {chapters.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => {
                    setShowChapters(!showChapters);
                    setShowSettings(false);
                  }}
                  className="p-1.5 text-white hover:text-primary-400 transition-colors"
                  title={t('help.video.chapters')}
                >
                  <BookOpen size={18} />
                </button>

                {showChapters && (
                  <div className="absolute bottom-full right-0 mb-2 w-64 bg-slate-900 rounded-lg shadow-xl border border-white/10 overflow-hidden">
                    <div className="p-2 border-b border-white/10">
                      <span className="text-xs font-medium text-white/60">
                        {t('help.video.chapters')}
                      </span>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {chapters.map((chapter, idx) => (
                        <button
                          key={idx}
                          onClick={() => jumpToChapter(chapter.time)}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-navy-800/40 transition-colors ${currentChapter === chapter ? 'bg-primary-500/20 text-primary-400' : 'text-white'}`}
                        >
                          <Clock size={12} className="flex-shrink-0 opacity-50" />
                          <span className="text-xs flex-1 truncate">
                            {lang === 'pl' && chapter.titlePl ? chapter.titlePl : chapter.title}
                          </span>
                          <span className="text-xs opacity-50 font-mono">
                            {formatTime(chapter.time)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Settings (Speed) */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowSettings(!showSettings);
                  setShowChapters(false);
                }}
                className="p-1.5 text-white hover:text-primary-400 transition-colors"
                title={t('help.video.settings')}
              >
                <Settings size={18} />
              </button>

              {showSettings && (
                <div className="absolute bottom-full right-0 mb-2 w-40 bg-slate-900 rounded-lg shadow-xl border border-white/10 overflow-hidden">
                  <div className="p-2 border-b border-white/10">
                    <span className="text-xs font-medium text-white/60">
                      {t('help.video.speed')}
                    </span>
                  </div>
                  {PLAYBACK_SPEEDS.map((speed) => (
                    <button
                      key={speed}
                      onClick={() => handleSpeedChange(speed)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-navy-800/40 transition-colors ${playbackSpeed === speed ? 'text-primary-400' : 'text-white'}`}
                    >
                      <span>{speed}x</span>
                      {playbackSpeed === speed && <Check size={14} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fullscreen */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 text-white hover:text-primary-400 transition-colors"
              title={
                isFullscreen
                  ? t('help.video.controls.exitFullscreen')
                  : t('help.video.controls.fullscreen')
              }
            >
              {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Hint */}
      {!isPlaying && !showControls && (
        <div className="absolute bottom-4 left-4 text-white/40 text-xs">
          {t('help.video.shortcuts')}
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
