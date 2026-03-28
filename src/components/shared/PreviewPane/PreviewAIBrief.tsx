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
      className="flex items-start gap-2 rounded-lg bg-purple-50/40 dark:bg-purple-500/[0.05] border border-purple-200/30 dark:border-purple-500/10 px-2.5 py-2 mb-2"
    >
      <Sparkles size={12} className="text-purple-400 dark:text-purple-500 shrink-0 mt-0.5" />
      {loading ? (
        <div className="flex-1 space-y-1 animate-pulse">
          <div className="h-3 w-4/5 rounded bg-purple-200/40 dark:bg-purple-500/10" />
          <div className="h-3 w-3/5 rounded bg-purple-200/30 dark:bg-purple-500/[0.06]" />
        </div>
      ) : (
        <span className="flex-1 text-[11px] leading-relaxed text-purple-700 dark:text-purple-300">
          {brief}
        </span>
      )}
    </motion.div>
  );
};

export default PreviewAIBrief;
