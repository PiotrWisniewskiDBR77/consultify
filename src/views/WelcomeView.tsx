import { ArrowRight, CheckCircle2, Layers, Lock, Zap } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { SessionMode } from '../types';

interface WelcomeViewProps {
  onStartSession: (mode: SessionMode) => void;
  onLoginClick?: () => void;
}

export const WelcomeView: React.FC<WelcomeViewProps> = ({ onStartSession, onLoginClick }) => {
  const { t } = useTranslation();

  // North Star positioning
  const northStar = t('welcome.northStar');

  const text = {
    logIn: t('auth.logIn'),
    register: t('auth.register'),
    titleStart: t('welcome.titleStart'),
    titleEnd: t('welcome.titleEnd'),
    subtitle: t('welcome.subtitle'),
    northStarLabel: t('welcome.northStarLabel'),

    // Primary CTA - low pressure demo path
    demoTitle: t('welcome.demoTitle'),
    demoDesc: t('welcome.demoDesc'),
    demoBtn: t('welcome.demoBtn'),
    demoTime: t('welcome.demoTime'),

    // Secondary paths (de-emphasized)
    quickTitle: t('welcome.quickTitle'),
    quickSteps: t('welcome.quickSteps'),
    quickTime: t('welcome.quickTime'),
    quickDesc: t('welcome.quickDesc'),
    quickBtn: t('welcome.quickBtn'),

    fullTitle: t('welcome.fullTitle'),
    fullSteps: t('welcome.fullSteps'),
    fullTime: t('welcome.fullTime'),
    fullDesc: t('welcome.fullDesc'),
    fullFeatures: [
      t('welcome.fullFeatures.drd'),
      t('welcome.fullFeatures.roadmap'),
      t('welcome.fullFeatures.ai'),
    ],
    fullBtn: t('welcome.fullBtn'),

    masterclassTitle: t('welcome.masterclassTitle'),
    masterclassDesc: t('welcome.masterclassDesc'),
    masterclassLink: t('welcome.masterclassLink'),

    videoTitle: t('welcome.videoTitle'),
    videoPerson: t('welcome.videoPerson'),
    videoRole: t('welcome.videoRole'),
  };

  return (
    <div className="flex flex-col h-full w-full bg-gray-50 dark:bg-navy-950 text-navy-900 dark:text-white overflow-hidden transition-colors duration-300">
      {/* GLOBAL HEADER (Only for Welcome View) */}
      <header className="h-20 border-b border-slate-200 dark:border-elegant flex items-center justify-between px-8 lg:px-12 bg-white dark:bg-navy-950 shrink-0 relative z-50 transition-colors duration-300">
        <div className="flex items-center gap-3 font-bold text-xl tracking-tight text-navy-950 dark:text-white">
          <img
            src="/assets/logos/logo-light.svg?v=20260319"
            alt="Consultify"
            className="h-7 w-auto dark:hidden"
          />
          <img
            src="/assets/logos/logo-dark.svg?v=20260319"
            alt="Consultify"
            className="hidden h-7 w-auto dark:block"
          />
          <span className="tracking-widest text-sm">Consultify</span>
        </div>

        <div className="flex items-center gap-6">
          <div className="h-4 w-px bg-slate-200 dark:bg-white/15"></div>
          <button
            onClick={onLoginClick}
            className="text-sm font-medium text-navy-700 hover:text-primary-600 dark:text-white dark:hover:text-primary-400 transition-colors"
          >
            {text.logIn}
          </button>

          {/* Admin Login Button - Added per request */}

          <button
            onClick={() => onStartSession(SessionMode.FREE)}
            className="px-5 py-2 bg-navy-900 text-white dark:bg-white dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-slate-200 dark:hover:bg-navy-700 font-semibold text-sm rounded-sm transition-colors"
          >
            {text.register}
          </button>
        </div>
      </header>

      {/* MAIN CONTENT SPLIT */}
      <div className="flex flex-1 overflow-hidden" dir="ltr">
        {/* LEFT COLUMN - PATH SELECTION */}
        <div className="w-1/2 p-8 lg:p-12 flex flex-col justify-center  border-slate-200 dark:border-elegant overflow-y-auto">
          <div className="max-w-xl mx-auto w-full space-y-8">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold mb-2 tracking-tight text-navy-950 dark:text-white">
                {text.titleStart}{' '}
                <span className="text-primary-600 dark:text-primary-500">{text.titleEnd}</span>
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-lg mb-4">{text.subtitle}</p>
              {/* North Star Statement */}
              <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-500/20 rounded-lg p-4">
                <p className="text-xs font-medium text-primary-600 dark:text-primary-400 mb-1">
                  {text.northStarLabel}
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300 italic leading-relaxed">
                  {northStar}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* PRIMARY CTA: EXPLORE DEMO (Low Pressure Entry) */}
              <div
                className="group relative bg-gradient-to-br from-primary-600 to-crimson-700 border border-primary-500 rounded-lg p-6 transition-all duration-300 hover:shadow-xl hover:shadow-primary-500/20 cursor-pointer"
                onClick={() => onStartSession(SessionMode.DEMO)}
              >
                <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="text-white" size={24} />
                </div>

                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded bg-slate-50/50 dark:bg-navy-950/30 flex items-center justify-center border border-c-border">
                    <Zap className="text-white" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">{text.demoTitle}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-white/20 text-white">
                        {text.demoTime}
                      </span>
                      <span className="text-xs text-white/70">{t('welcome.demoNoReg')}</span>
                    </div>
                  </div>
                </div>

                <p className="text-white/80 text-sm mb-6 leading-relaxed">{text.demoDesc}</p>

                <button className="w-full py-3 bg-white dark:bg-navy-900 text-primary-700 font-semibold rounded transition-colors hover:bg-white/90 flex items-center justify-center gap-2">
                  {text.demoBtn}
                </button>
              </div>

              {/* SECONDARY: Quick Assessment */}
              <div
                className="group relative bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 hover:border-primary-500/50 rounded-lg p-4 transition-all duration-300 hover:shadow-md cursor-pointer"
                onClick={() => onStartSession(SessionMode.FREE)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center border border-primary-100 dark:border-primary-500/30">
                    <Zap className="text-primary-600 dark:text-primary-300" size={20} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-navy-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                      {text.quickTitle}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {text.quickTime} · {text.quickSteps}
                    </p>
                  </div>
                  <ArrowRight
                    className="text-slate-600 dark:text-slate-500 group-hover:text-primary-500 transition-colors"
                    size={20}
                  />
                </div>
              </div>

              {/* OPTION 2: FULL TRANSFORMATION */}
              <div
                className="group relative bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 hover:border-blue-500/50 rounded-lg p-6 transition-all duration-300 cursor-pointer hover:shadow-lg"
                onClick={() => onStartSession(SessionMode.FULL)}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded bg-slate-100 dark:bg-navy-800 flex items-center justify-center border border-slate-200 dark:border-navy-700 group-hover:border-blue-500/50 transition-colors">
                    <Layers
                      className="text-slate-500 dark:text-slate-300 group-hover:text-blue-500 dark:group-hover:text-blue-400"
                      size={24}
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-navy-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {text.fullTitle}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                        {text.fullSteps}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {text.fullTime}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">
                  {text.fullDesc}
                </p>

                <div className="space-y-2 mb-6">
                  {text.fullFeatures.map((feature, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"
                    >
                      <CheckCircle2 size={14} className="text-blue-500" /> <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <button className="w-full py-3 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] font-medium rounded transition-colors flex items-center justify-center gap-2">
                  <Lock size={16} />
                  {text.fullBtn}
                </button>
              </div>

              {/* OPTION 3: CONSULTING (New) */}
              <div
                className="group relative bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 hover:border-emerald-500/50 rounded-lg p-6 transition-all duration-300 cursor-pointer hover:shadow-lg"
                onClick={() => (window.location.href = '/consulting')}
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center border border-emerald-100 dark:border-emerald-500/30 group-hover:border-emerald-600 transition-colors">
                    <CheckCircle2
                      className="text-emerald-600 dark:text-emerald-300 group-hover:text-emerald-500"
                      size={24}
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-navy-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {t('welcome.consultingTitle')}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {t('welcome.consultingTag')}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">
                  {t('welcome.consultingDesc')}
                </p>

                <button className="w-full py-3 bg-white dark:bg-navy-800 border border-slate-200 dark:border-c-border text-navy-900 dark:text-white font-medium rounded hover:bg-slate-50 dark:hover:bg-navy-700 transition-colors flex items-center justify-center gap-2">
                  {t('welcome.consultingBtn')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN - VIDEO INTRO */}
        <div className="w-1/2 relative bg-gray-50 dark:bg-navy-950 flex flex-col items-center justify-center p-12 transition-colors duration-300">
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary-100/50 dark:from-primary-900/20 via-gray-50 dark:via-navy-950 to-gray-50 dark:to-navy-950 pointer-events-none transition-colors duration-300"></div>
          <div className="absolute bottom-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-blue-100/50 dark:from-blue-900/10 via-gray-50 dark:via-navy-950 to-gray-50 dark:to-navy-950 pointer-events-none transition-colors duration-300"></div>

          <div className="relative z-10 w-full max-w-2xl">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-light tracking-wide text-navy-900 dark:text-white mb-2">
                {text.videoTitle}
              </h2>
              <div className="h-0.5 w-16 bg-navy-900 mx-auto"></div>
            </div>

            {/* Video Player Placeholder */}
            <video className="aspect-video w-full rounded-xl overflow-hidden shadow-2xl" controls>
              <source src={`/videos/en.mp4`} type="video/mp4" />
              Your browser does not support the video tag.
            </video>

            <div className="mt-6 text-center">
              <p className="text-lg font-medium text-navy-900 dark:text-white">
                {text.videoPerson}
              </p>
              <p className="text-sm text-primary-600 dark:text-primary-400">{text.videoRole}</p>
            </div>

            <div className="mt-12 pt-8 border-t border-slate-200 dark:border-navy-700 text-center">
              <h4 className="text-sm font-semibold text-navy-900 dark:text-white mb-2">
                {text.masterclassTitle}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-sm mx-auto">
                {text.masterclassDesc}
              </p>
              <a
                href="#"
                className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300 underline inline-flex items-center gap-1"
              >
                {text.masterclassLink} →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
