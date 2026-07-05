/**
 * Tool Video Modal
 *
 * Modal component for playing tool teaser videos with CTA
 */

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Clock, Play, X } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { EducationTool } from '@/data/toolEducationData.ts';

// ============================================
// DYNAMIC ICON
// ============================================

const DynamicIcon: React.FC<{ name: string; size?: number; className?: string }> = ({
  name,
  size = 24,
  className,
}) => {
  const IconComponent = (LucideIcons as any)[name];
  if (!IconComponent) return <Play size={size} className={className} />;
  return <IconComponent size={size} className={className} />;
};

// ============================================
// MODAL PROPS
// ============================================

interface ToolVideoModalProps {
  tool: EducationTool | null;
  isOpen: boolean;
  onClose: () => void;
  onTryTool: () => void;
}

// ============================================
// MODAL COMPONENT
// ============================================

export const ToolVideoModal: React.FC<ToolVideoModalProps> = ({
  tool,
  isOpen,
  onClose,
  onTryTool,
}) => {
  const { t } = useTranslation();
  if (!tool) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-overlay"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-4xl bg-slate-50 dark:bg-navy-900 rounded-2xl shadow-2xl z-overlay overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-navy-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500 to-crimson-600 flex items-center justify-center">
                  <DynamicIcon name={tool.icon} size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    {t(`showcase.tools.items.${tool.id}.name`)}
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {t(`showcase.tools.items.${tool.id}.framework` as any) ||
                      t('showcase.common.framework')}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
              >
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            {/* Video Area */}
            <div className="flex-1 bg-slate-900 relative">
              {tool.videoUrl ? (
                <iframe
                  src={tool.videoUrl}
                  className="w-full h-full min-h-[300px] md:min-h-[400px]"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                /* Placeholder when no video */
                <div className="w-full h-full min-h-[300px] md:min-h-[400px] flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                  <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mb-4">
                    <Play size={32} className="text-white/60 ml-1" />
                  </div>
                  <p className="text-white/60 text-lg font-medium mb-2">Video not available</p>
                  <p className="text-white/40 text-sm max-w-md text-center px-4">
                    We're preparing an in-depth walkthrough of this tool. In the meantime, try it
                    yourself!
                  </p>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                {t(`showcase.tools.items.${tool.id}.description`)}
              </p>

              {/* Outputs */}
              <div className="mb-6">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('showcase.common.whatYouGet')}:
                </p>
                <div className="flex flex-wrap gap-2">
                  {[0, 1, 2].map((idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 text-sm rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                    >
                      {t(`showcase.tools.items.${tool.id}.outputs.${idx}` as any)}
                    </span>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={onTryTool}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-crimson-600 text-white font-semibold rounded-xl hover:from-primary-700 hover:to-crimson-700 transition-all shadow-lg"
                >
                  Try It Free
                  <ArrowRight size={18} />
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3 border border-slate-200 dark:border-navy-700 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                >
                  Maybe Later
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ToolVideoModal;
