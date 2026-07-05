import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import React from 'react';

export interface PreviewAIBriefProps {
  brief: string | null;
  loading?: boolean;
}

export const PreviewAIBrief: React.FC<PreviewAIBriefProps> = ({ brief, loading }) => {
  if (!brief && !loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.15 }}
      className="flex items-start gap-2 rounded-lg bg-[color-mix(in_srgb,var(--c-info)_6%,transparent)] dark:bg-[color-mix(in_srgb,var(--c-info)_5%,transparent)] border border-c-info/20 dark:border-c-info/10 px-2.5 py-2 mb-2"
    >
      <Sparkles size={12} className="text-c-info shrink-0 mt-0.5" />
      {loading ? (
        <div className="flex-1 space-y-1 animate-pulse">
          <div className="h-3 w-4/5 rounded bg-[color-mix(in_srgb,var(--c-info)_15%,transparent)]" />
          <div className="h-3 w-3/5 rounded bg-[color-mix(in_srgb,var(--c-info)_10%,transparent)]" />
        </div>
      ) : (
        <span className="flex-1 text-[11px] leading-relaxed text-c-text-secondary">
          {brief}
        </span>
      )}
    </motion.div>
  );
};

export default PreviewAIBrief;
