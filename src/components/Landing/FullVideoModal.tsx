import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface FullVideoModalProps {
  title?: string;
  videoUrl: string;
  isOpen: boolean;
  onClose: () => void;
  onEnded?: () => void;
}

export const FullVideoModal: React.FC<FullVideoModalProps> = ({
  title,
  videoUrl,
  isOpen,
  onClose,
  onEnded,
}) => {
  const { t } = useTranslation();

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
            className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-5xl bg-black rounded-2xl shadow-2xl z-overlay overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="flex items-center justify-between p-4 bg-black/60 border-b border-c-border-subtle">
              <div className="min-w-0">
                <p className="text-white font-bold text-sm truncate">
                  {title ?? t('landing.videos.fullTitleFallback', 'Full video')}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                aria-label={t('common.close', 'Close')}
              >
                <X size={20} className="text-white" />
              </button>
            </div>

            <div className="flex-1 bg-black">
              <video
                className="w-full h-full object-contain"
                autoPlay
                playsInline
                controls
                onEnded={onEnded}
              >
                <source src={videoUrl} type="video/mp4" />
              </video>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default FullVideoModal;
