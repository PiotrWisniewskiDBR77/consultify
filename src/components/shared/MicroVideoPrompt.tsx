/**
 * MicroVideoPrompt — Video Enablement system component (V3-A08)
 *
 * Layer-3 modal showing contextual micro-video + 2–4 recommendation cards.
 * DBR77 "Tech Sexy" visual language: monochromatic chrome, purple accent only for CTA.
 * Per-user+module dismissal state is handled by parent via onClose / onDontShowAgain.
 */

import { Clock, EyeOff, Play, SkipForward, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '@/services/funnelAnalytics';

export interface MicroVideoRecommendation {
  id: string;
  title: { en: string; pl: string };
  thumbnailUrl?: string;
  duration?: string;
}

export interface MicroVideoPromptProps {
  moduleId: string;
  videoId: string;
  videoTitle: { en: string; pl: string };
  videoUrl?: string;
  thumbnailUrl?: string;
  recommendations?: MicroVideoRecommendation[];
  onClose: () => void;
  onDontShowAgain?: () => void;
}

function getLocalizedTitle(title: { en: string; pl: string }, lang: string): string {
  return lang?.startsWith('pl') ? title.pl : title.en;
}

export const MicroVideoPrompt: React.FC<MicroVideoPromptProps> = ({
  moduleId,
  videoId,
  videoTitle,
  videoUrl,
  thumbnailUrl,
  recommendations = [],
  onClose,
  onDontShowAgain,
}) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('pl') ? 'pl' : 'en';
  const [isPlaying, setIsPlaying] = useState(false);
  const [watchStartTime, setWatchStartTime] = useState<number | null>(null);
  const [hasCompleted, setHasCompleted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const title = getLocalizedTitle(videoTitle, lang);
  const displayRecommendations = recommendations.slice(0, 4);

  // Fire prompt_shown on mount
  useEffect(() => {
    trackFunnelEvent('help_video_prompt_shown', { moduleId, videoId });
  }, [moduleId, videoId]);

  const handlePlay = useCallback(() => {
    trackFunnelEvent('help_video_view_started', { moduleId, videoId });
    setWatchStartTime(Date.now());
    setIsPlaying(true);
    if (videoRef.current && videoUrl) {
      videoRef.current.play().catch(() => {
        // Autoplay may be blocked — user can click play again
      });
    }
  }, [moduleId, videoId, videoUrl]);

  const handleVideoEnded = useCallback(() => {
    const watchTimeSeconds = watchStartTime
      ? Math.round((Date.now() - watchStartTime) / 1000)
      : undefined;
    trackFunnelEvent('help_video_view_completed', {
      moduleId,
      videoId,
      watchTimeSeconds,
      progressPercent: 100,
    });
    setHasCompleted(true);
    setWatchStartTime(null);
  }, [moduleId, videoId, watchStartTime]);

  const handleSkip = useCallback(() => {
    trackFunnelEvent('help_video_skipped', { moduleId, videoId });
    if (videoRef.current) videoRef.current.pause();
    setIsPlaying(false);
    onClose();
  }, [moduleId, videoId, onClose]);

  const handleDontShow = useCallback(() => {
    trackFunnelEvent('help_video_dont_show', { moduleId, videoId });
    if (videoRef.current) videoRef.current.pause();
    setIsPlaying(false);
    onDontShowAgain?.();
    onClose();
  }, [moduleId, videoId, onDontShowAgain, onClose]);

  const handleClose = useCallback(() => {
    if (videoRef.current) videoRef.current.pause();
    setIsPlaying(false);
    if (!hasCompleted) {
      trackFunnelEvent('help_video_skipped', { moduleId, videoId });
    }
    onClose();
  }, [moduleId, videoId, hasCompleted, onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) handleClose();
    },
    [handleClose]
  );

  if (typeof window === 'undefined') return null;

  return createPortal(
    <>
      {/* Backdrop — Layer 3 floating */}
      <div
        className="fixed inset-0 z-modal bg-black/30 dark:bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={handleOverlayClick}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-modal flex items-center justify-center p-4 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="micro-video-prompt-title"
          className="pointer-events-auto w-full max-w-lg bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 shadow-[0_25px_50px_rgba(0,0,0,0.15),0_12px_24px_rgba(0,0,0,0.1)] dark:shadow-[0_25px_50px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200/60 dark:border-navy-700/60">
            <span
              id="micro-video-prompt-title"
              className="text-sm font-semibold text-slate-900 dark:text-slate-100"
            >
              {t('help.microVideoPrompt.header', 'Quick Tutorial')}
            </span>
            <button
              type="button"
              onClick={handleClose}
              className="w-8 h-8 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700/60 rounded-lg transition-colors"
              aria-label={t('common.close', 'Close')}
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {/* Main video — placeholder or player */}
            {isPlaying && videoUrl ? (
              <div className="aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full h-full object-contain"
                  controls
                  playsInline
                  preload="metadata"
                  onEnded={handleVideoEnded}
                />
              </div>
            ) : isPlaying && !videoUrl ? (
              <div className="aspect-video bg-slate-200 dark:bg-navy-800 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm">
                {t('help.microVideoPrompt.videoPlaceholder', 'Video placeholder')}
              </div>
            ) : (
              <div className="relative aspect-video bg-slate-100 dark:bg-navy-800 rounded-lg overflow-hidden border border-slate-200/60 dark:border-navy-700/60">
                {thumbnailUrl ? (
                  <img src={thumbnailUrl} alt={title} className="w-full h-full object-cover" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-50 dark:bg-navy-900/50" />
                )}
                <button
                  type="button"
                  onClick={handlePlay}
                  className="absolute inset-0 flex items-center justify-center group"
                  aria-label={t('help.microVideo.watch', 'Watch')}
                >
                  <span className="w-14 h-14 flex items-center justify-center rounded-full bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] shadow-lg transition-colors group-hover:scale-105">
                    <Play size={24} fill="currentColor" />
                  </span>
                </button>
                <h3 className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent text-slate-100 text-sm font-medium">
                  {title}
                </h3>
              </div>
            )}

            {/* Recommendations */}
            {displayRecommendations.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                  {t('help.microVideoPrompt.moreToExplore', 'More to explore')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {displayRecommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="flex gap-2 p-2 rounded-lg bg-slate-50/80 dark:bg-navy-800/50 border border-slate-200/40 dark:border-navy-700/40 hover:bg-slate-100 dark:hover:bg-navy-700/40 transition-colors"
                    >
                      <div className="w-16 h-10 shrink-0 rounded bg-slate-200 dark:bg-navy-700 overflow-hidden">
                        {rec.thumbnailUrl ? (
                          <img
                            src={rec.thumbnailUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Play size={12} className="text-slate-600 dark:text-slate-500" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                          {getLocalizedTitle(rec.title, lang)}
                        </p>
                        {rec.duration && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                            <Clock size={10} />
                            {rec.duration}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer — dismissal actions */}
          <div className="px-5 pb-4 pt-2 flex flex-col gap-2">
            {!isPlaying && (
              <button
                type="button"
                onClick={handlePlay}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-xl text-sm font-semibold transition-colors"
              >
                <Play size={16} fill="currentColor" />
                {t('help.microVideo.watch', 'Watch')}
              </button>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSkip}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors"
              >
                <SkipForward size={14} />
                {t('help.microVideo.skip', 'Skip')}
              </button>
              <button
                type="button"
                onClick={handleDontShow}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 rounded-xl text-xs font-medium transition-colors"
              >
                <EyeOff size={12} />
                {t('help.microVideo.dontShow', "Don't show again")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
};

export default MicroVideoPrompt;
