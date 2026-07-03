import { Clock, EyeOff, PlayCircle, SkipForward, X } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { VideoTutorial } from '../../config/videoTutorialsContent';

export interface MicroVideoHelpModalProps {
  video: VideoTutorial;
  onWatch: () => void;
  onSkip: () => void;
  onDontShowAgain: () => void;
  onClose: () => void;
}

export const MicroVideoHelpModal: React.FC<MicroVideoHelpModalProps> = ({
  video,
  onWatch,
  onSkip,
  onDontShowAgain,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith('pl') ? 'pl' : 'en';
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const title = lang === 'pl' && video.titlePl ? video.titlePl : video.title;
  const description =
    lang === 'pl' && video.descriptionPl ? video.descriptionPl : video.description;

  const handleWatch = useCallback(() => {
    setIsPlaying(true);
    onWatch();
    if (videoRef.current) {
      videoRef.current.play().catch(() => {
        // Autoplay may be blocked — user can click play
      });
    }
  }, [onWatch]);

  const handleSkip = useCallback(() => {
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
    onSkip();
  }, [onSkip]);

  const handleDontShow = useCallback(() => {
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
    onDontShowAgain();
  }, [onDontShowAgain]);

  const handleClose = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    onClose();
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 dark:bg-black/60 z-modal transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-modal flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-lg bg-white dark:bg-navy-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-navy-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-navy-700">
            <div className="flex items-center gap-2">
              <PlayCircle size={18} className="text-primary-500" />
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {t('help.microVideo.header', 'Quick Tutorial')}
              </span>
            </div>
            <button
              onClick={handleClose}
              className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-danger-500 dark:hover:text-danger-400 rounded-lg hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Video area */}
          {isPlaying ? (
            <div className="aspect-video bg-black">
              <video
                ref={videoRef}
                src={video.videoUrl}
                className="w-full h-full"
                controls
                playsInline
                preload="metadata"
              />
            </div>
          ) : (
            <div className="px-5 py-5">
              {/* Thumbnail / preview */}
              <div className="relative aspect-video bg-gradient-to-br from-primary-100 to-crimson-100 dark:from-primary-900/30 dark:to-crimson-900/30 rounded-xl flex items-center justify-center mb-4 border border-slate-200 dark:border-navy-700">
                {video.thumbnailUrl ? (
                  <img
                    src={video.thumbnailUrl}
                    alt={title}
                    className="w-full h-full object-cover rounded-xl"
                  />
                ) : (
                  <div className="text-center">
                    <PlayCircle
                      size={48}
                      className="mx-auto text-primary-400 dark:text-primary-500 mb-2"
                    />
                    {video.duration && (
                      <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Clock size={12} />
                        {video.duration}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Title + description */}
              <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">{title}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {description}
              </p>
            </div>
          )}

          {/* CTA buttons */}
          <div className="px-5 pb-4 pt-2 space-y-2">
            {!isPlaying && (
              <button
                onClick={handleWatch}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-xl text-sm font-semibold transition-colors"
              >
                <PlayCircle size={16} />
                {t('help.microVideo.watch', 'Watch')}
                {video.duration && (
                  <span className="text-primary-200 text-xs ml-1">({video.duration})</span>
                )}
              </button>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSkip}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium transition-colors"
              >
                <SkipForward size={14} />
                {t('help.microVideo.skip', 'Skip')}
              </button>
              <button
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
    </>
  );
};

export default MicroVideoHelpModal;
