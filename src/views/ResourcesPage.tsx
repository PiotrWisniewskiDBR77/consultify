import { motion } from 'framer-motion';
import { Lock, Play } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { AnnaAssistantWidget } from '@/components/Landing/AnnaAssistantWidget';
import { DemoModeModal } from '@/components/Landing/DemoModeModal';
import { EntryFooter } from '@/components/Landing/EntryFooter';
import { EntryTopBar } from '@/components/Landing/EntryTopBar';
import { FullVideoModal } from '@/components/Landing/FullVideoModal';
import { LANDING_FILMS, LandingFilm } from '@/config/landingFilms';
import { ROUTES } from '@/routes/routeConfig';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { useAppStore } from '@/store/useAppStore';
import { AppView, SessionMode } from '@/types';

export const ResourcesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentUser, setCurrentView, setSessionMode, setCurrentUser, setDemoMode } =
    useAppStore();

  const films = useMemo(
    () => [
      LANDING_FILMS.film1,
      LANDING_FILMS.film2,
      LANDING_FILMS.film3,
      LANDING_FILMS.film4,
      LANDING_FILMS.film5,
      LANDING_FILMS.film6,
    ],
    []
  );

  const [openFullFilm, setOpenFullFilm] = useState<LandingFilm | null>(null);
  const [endedTeasers, setEndedTeasers] = useState<Record<string, boolean>>({});
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [demoModalMode, setDemoModalMode] = useState<'demo' | 'trial'>('trial');

  const handleModalSuccess = (user: any, mode: 'demo' | 'trial') => {
    setCurrentUser({ ...user, hasWorkspace: true, isAuthenticated: true } as any);
    setIsDemoModalOpen(false);
    setSessionMode(mode === 'demo' ? SessionMode.DEMO : SessionMode.FULL);
    if (mode === 'demo') setDemoMode(true);
    else setDemoMode(false);
    setCurrentView(AppView.DASHBOARD);
    navigate(ROUTES.AI_CHAT);
  };

  const handleTrialClick = () => {
    setDemoModalMode('trial');
    setIsDemoModalOpen(true);
  };

  const handleDemoClick = () => {
    setDemoModalMode('demo');
    setIsDemoModalOpen(true);
  };

  const handleContactClick = () => {
    navigate(ROUTES.LEGAL.CONTACT);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-navy-950 transition-colors duration-500">
      <EntryTopBar
        onTrialClick={handleTrialClick}
        onDemoClick={handleDemoClick}
        onLoginClick={() => navigate(ROUTES.LOGIN)}
        onRegisterClick={() => navigate(ROUTES.REGISTER)}
        isLoggedIn={!!currentUser}
        hasWorkspace={!!currentUser?.hasWorkspace}
      />

      <main className="pt-28 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="text-4xl md:text-5xl font-black text-navy-950 dark:text-white tracking-tight"
            >
              {t('landing.resources.title', 'Resources')}
            </motion.h1>
            <p className="mt-4 text-slate-600 dark:text-slate-400 font-medium max-w-2xl mx-auto">
              {t(
                'landing.resources.subtitle',
                'All videos have public teasers. Log in to watch full versions.'
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {films.map((film) => (
              <div
                key={film.id}
                className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-200 dark:border-navy-700 shadow-lg overflow-hidden"
              >
                <div className="bg-black relative">
                  <video
                    className="w-full aspect-video object-contain"
                    playsInline
                    controls
                    onPlay={() =>
                      trackFunnelEvent('landing_video_teaser_started', {
                        filmId: film.id,
                        location: 'resources',
                      })
                    }
                    onEnded={() => {
                      setEndedTeasers((prev) => ({ ...prev, [film.id]: true }));
                      trackFunnelEvent('landing_video_teaser_completed', {
                        filmId: film.id,
                        location: 'resources',
                      });
                    }}
                  >
                    <source src={film.teaserUrl} type="video/mp4" />
                  </video>
                  <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-black/60 text-white text-xs font-semibold">
                    {film.durationLabel}
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  <div className="space-y-1">
                    <p className="text-slate-900 dark:text-white font-black">
                      {t(film.titleKey, film.id)}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {t(film.descriptionKey, 'Video teaser')}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    {endedTeasers[film.id] ? (
                      <button
                        onClick={() => {
                          trackFunnelEvent('landing_watch_full_after_login_clicked', {
                            filmId: film.id,
                            location: 'resources',
                          });
                          if (currentUser?.isAuthenticated) {
                            setOpenFullFilm(film);
                          } else {
                            navigate('/login');
                          }
                        }}
                        className="w-full px-4 py-3 rounded-xl bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                        {currentUser?.isAuthenticated ? (
                          <>
                            <Play size={18} />
                            {t('landing.resources.watchFull', 'Watch full version')}
                          </>
                        ) : (
                          <>
                            <Lock size={18} />
                            {t(
                              'landing.resources.watchFullAfterLogin',
                              'Watch full version after login'
                            )}
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {t(
                          'landing.resources.ctaAfterTeaserHint',
                          'Watch the teaser to unlock the full-video button.'
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => navigate(ROUTES.REGISTER)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-800 text-slate-800 dark:text-slate-200 font-semibold transition-colors"
                    >
                      {t('landing.resources.launchTrial', 'Launch Free Trial')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <EntryFooter />
      <AnnaAssistantWidget
        onDemoClick={handleDemoClick}
        onTrialClick={handleTrialClick}
        onContactClick={handleContactClick}
      />

      <FullVideoModal
        isOpen={!!openFullFilm}
        onClose={() => setOpenFullFilm(null)}
        videoUrl={openFullFilm?.fullUrl ?? ''}
        title={openFullFilm ? t(openFullFilm.titleKey, openFullFilm.id) : undefined}
        onEnded={() => {
          if (openFullFilm) {
            trackFunnelEvent('landing_video_full_completed', {
              filmId: openFullFilm.id,
              location: 'resources',
            });
          }
        }}
      />
      <DemoModeModal
        isOpen={isDemoModalOpen}
        onClose={() => setIsDemoModalOpen(false)}
        onSuccess={handleModalSuccess}
        mode={demoModalMode}
      />
    </div>
  );
};

export default ResourcesPage;
