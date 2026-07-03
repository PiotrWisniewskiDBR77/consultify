/**
 * What's New Modal Component
 *
 * Shows release notes and new features after platform updates.
 * Automatically displays when new version is detected.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Sparkles,
  Star,
  Video,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  getLatestRelease,
  hasNewRelease,
  ReleaseFeature,
  ReleaseNote,
} from '../../config/releaseNotes';
import DynamicIcon from '../shared/DynamicIcon';

// Storage key for last seen version
const LAST_SEEN_KEY = 'consultify_last_seen_version';
const DONT_SHOW_KEY = 'consultify_dont_show_whatsnew';

interface WhatsNewModalProps {
  forceShow?: boolean;
  onClose?: () => void;
}

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ forceShow = false, onClose }) => {
  const { t, i18n } = useTranslation();
  const baseLang = (i18n.language || 'en').split('-')[0].toLowerCase();
  const lang: 'en' | 'pl' = baseLang === 'pl' ? 'pl' : 'en';

  const [isOpen, setIsOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);

  const release = getLatestRelease();

  // Check if should show on mount
  useEffect(() => {
    if (forceShow) {
      setIsOpen(true);
      return;
    }

    try {
      const dontShow = localStorage.getItem(DONT_SHOW_KEY);
      if (dontShow === 'true') return;

      const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
      if (hasNewRelease(lastSeen || '0.0.0')) {
        setIsOpen(true);
      }
    } catch {
      // Ignore storage errors
    }
  }, [forceShow]);

  // Handle close
  const handleClose = () => {
    setIsOpen(false);

    try {
      localStorage.setItem(LAST_SEEN_KEY, release.version);
      if (dontShowAgain) {
        localStorage.setItem(DONT_SHOW_KEY, 'true');
      }
    } catch {
      // Ignore storage errors
    }

    onClose?.();
  };

  // Navigate features
  const nextFeature = () => {
    setCurrentFeatureIndex((i: number) => Math.min(i + 1, release.features.length - 1));
  };

  const prevFeature = () => {
    setCurrentFeatureIndex((i: number) => Math.max(i - 1, 0));
  };

  // Type badge color
  const typeBadgeColor = {
    major: 'bg-navy-900',
    minor: 'bg-blue-500',
    patch: 'bg-green-500',
  };

  // Translations from i18n
  const tTrans = {
    title: t('help.whatsNew.title'),
    version: t('help.whatsNew.version'),
    features: t('help.whatsNew.features'),
    improvements: t('help.whatsNew.improvements'),
    fixes: t('help.whatsNew.fixes'),
    breaking: t('help.whatsNew.breaking'),
    dontShow: t('help.whatsNew.dontShow'),
    gotIt: t('help.whatsNew.gotIt'),
    learnMore: t('help.whatsNew.learnMore'),
    changelog: t('help.whatsNew.changelog'),
  };

  if (!isOpen) return null;

  const currentFeature = release.features[currentFeatureIndex];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-modal flex items-center justify-center p-4"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="relative bg-gradient-to-r from-primary-600 via-crimson-600 to-blue-600 px-6 py-8 text-white">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                  backgroundSize: '24px 24px',
                }}
              />
            </div>

            {/* Close Button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 hover:bg-slate-100 dark:hover:bg-navy-800/40 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>

            {/* Content */}
            <div className="relative">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={24} />
                <span className="text-lg font-semibold">{tTrans.title}</span>
              </div>
              <h2 className="text-2xl font-bold mb-2">{release.title[lang]}</h2>
              <div className="flex items-center gap-3">
                <span
                  className={`px-2 py-0.5 ${(typeBadgeColor as any)[release.type]} rounded text-xs font-medium uppercase`}
                >
                  {release.type}
                </span>
                <span className="text-white/80 text-sm">
                  {tTrans.version} {release.version} • {new Date(release.date).toLocaleDateString()}
                </span>
              </div>
              {release.summary && (
                <p className="mt-3 text-white/90 text-sm">{release.summary[lang]}</p>
              )}
            </div>
          </div>

          {/* Feature Carousel */}
          {release.features.length > 0 && (
            <div className="px-6 py-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
                {tTrans.features}
              </h3>

              <div className="relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentFeatureIndex}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex items-start gap-4"
                  >
                    {/* Icon */}
                    <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                      {currentFeature.icon ? (
                        <DynamicIcon
                          name={currentFeature.icon}
                          size={24}
                          className="text-primary-600 dark:text-primary-400"
                        />
                      ) : (
                        <Star size={24} className="text-primary-600 dark:text-primary-400" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900 dark:text-white mb-1">
                        {currentFeature.title[lang]}
                      </h4>
                      <p className="text-slate-600 dark:text-slate-300 text-sm">
                        {currentFeature.description[lang]}
                      </p>
                      {currentFeature.videoId && (
                        <button className="mt-2 inline-flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
                          <Video size={14} />
                          {t('help.whatsNew.watchDemo')}
                        </button>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* Navigation */}
                {release.features.length > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <button
                      onClick={prevFeature}
                      disabled={currentFeatureIndex === 0}
                      className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={20} />
                    </button>

                    {/* Dots */}
                    <div className="flex items-center gap-2">
                      {release.features.map((_: any, i: number) => (
                        <button
                          key={i}
                          onClick={() => setCurrentFeatureIndex(i)}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            i === currentFeatureIndex
                              ? 'bg-navy-900'
                              : 'bg-slate-300 dark:bg-slate-600 hover:bg-slate-400'
                          }`}
                        />
                      ))}
                    </div>

                    <button
                      onClick={nextFeature}
                      disabled={currentFeatureIndex === release.features.length - 1}
                      className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Improvements & Fixes */}
          <div className="px-6 py-4 max-h-48 overflow-y-auto">
            {release.improvements.length > 0 && (
              <div className="mb-4">
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  {tTrans.improvements}
                </h4>
                <ul className="space-y-1">
                  {release.improvements.slice(0, 3).map((item: any, i: number) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300"
                    >
                      <Check size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                      {item[lang]}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {release.fixes.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                  {tTrans.fixes}
                </h4>
                <ul className="space-y-1">
                  {release.fixes.slice(0, 3).map((item: any, i: number) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300"
                    >
                      <Check size={14} className="text-blue-500 mt-0.5 flex-shrink-0" />
                      {item[lang]}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {tTrans.dontShow}
                </span>
              </label>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.open('/changelog', '_blank')}
                  className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  {tTrans.changelog}
                  <ExternalLink size={14} />
                </button>

                <button
                  onClick={handleClose}
                  className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg font-medium transition-colors"
                >
                  {tTrans.gotIt}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default WhatsNewModal;
