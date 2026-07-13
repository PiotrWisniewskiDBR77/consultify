import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LandingFilm } from '@/config/landingFilms';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

interface LandingFilmModalProps {
  film: LandingFilm;
  isOpen: boolean;
  onClose: () => void;
  onLaunchTrial: () => void;
  variant: string;
}

export const LandingFilmModal: React.FC<LandingFilmModalProps> = ({
  film,
  isOpen,
  onClose,
  onLaunchTrial,
  variant,
}) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasEnded, setHasEnded] = useState(false);

  const autoCloseDelayMs = useMemo(() => 8000, []);

  useEffect(() => {
    if (!isOpen) return;
    setHasEnded(false);
    trackFunnelEvent('landing_video_full_opened', { filmId: film.id, variant });
  }, [film.id, isOpen, variant]);

  useEffect(() => {
    if (!isOpen) return;
    if (!hasEnded) return;
    const timer = window.setTimeout(() => onClose(), autoCloseDelayMs);
    return () => window.clearTimeout(timer);
  }, [autoCloseDelayMs, hasEnded, isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-overlay"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            className="fixed inset-0 z-overlay flex items-center justify-center"
          >
            <div className="absolute inset-0" />
            <div className="relative w-full h-full bg-black">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-black/40 hover:bg-black/60 transition-colors"
                aria-label={t('common.close', 'Close')}
              >
                <X size={22} className="text-white" />
              </button>

              <video
                ref={videoRef}
                className="w-full h-full object-contain"
                autoPlay
                playsInline
                controls
                onEnded={() => {
                  setHasEnded(true);
                  trackFunnelEvent('landing_video_full_completed', { filmId: film.id, variant });
                }}
                onPlay={() =>
                  trackFunnelEvent('landing_video_full_started', { filmId: film.id, variant })
                }
              >
                <source src={film.fullUrl} type="video/mp4" />
              </video>

              {hasEnded ? (
                <div className="absolute inset-x-0 bottom-0 p-6 md:p-10 bg-gradient-to-t from-black/95 via-black/60 to-transparent">
                  <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-white font-black text-xl">
                        {t('landing.films.after.title', 'Ready to launch?')}
                      </p>
                      <p className="text-white/70 text-sm">
                        {t(
                          'landing.films.after.subtitle',
                          'Start your free trial and watch all full videos.'
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        trackFunnelEvent('landing_primary_cta_clicked', {
                          cta: 'launch_free_trial',
                          variant,
                        });
                        onLaunchTrial();
                        onClose();
                      }}
                      className="w-full md:w-auto px-6 py-3 rounded-xl bg-c-text hover:opacity-90 text-c-surface font-semibold shadow-lg shadow-c-text/15 transition-opacity"
                    >
                      {t('landing.films.after.cta', 'Launch Free Trial')}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default LandingFilmModal;
