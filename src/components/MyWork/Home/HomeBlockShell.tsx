import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import React from 'react';

import { cn } from '@/lib/utils';

import type { HomeBlock } from './homeV2Types';

interface HomeBlockShellProps {
  block: HomeBlock;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  headerRight?: React.ReactNode;
}

const ACCENT_STYLES: Record<HomeBlock['accent'], string> = {
  ai: 'from-primary-500/15 via-violet-500/8 to-cyan-500/12 border-primary-400/20',
  warm: 'from-amber-500/15 via-orange-500/8 to-rose-500/12 border-amber-400/20',
  cool: 'from-indigo-500/15 via-cyan-500/8 to-blue-500/12 border-indigo-400/20',
  alert: 'from-rose-500/16 via-amber-500/10 to-orange-500/10 border-rose-400/20',
  success: 'from-emerald-500/15 via-teal-500/8 to-cyan-500/10 border-emerald-400/20',
  neutral: 'from-white/[0.06] via-white/[0.03] to-white/[0.02] border-white/[0.08]',
};

const SIZE_CLASSES: Record<HomeBlock['size'], string> = {
  hero: 'col-span-12 min-h-[22rem]',
  lg: 'col-span-12 xl:col-span-7 min-h-[20rem]',
  md: 'col-span-12 md:col-span-6 xl:col-span-5 min-h-[18rem]',
  sm: 'col-span-12 md:col-span-6 xl:col-span-4 min-h-[16rem]',
};

export const HomeBlockShell: React.FC<HomeBlockShellProps> = ({
  block,
  children,
  className,
  contentClassName,
  headerRight,
}) => {
  const isLive = block.freshnessScore >= 75 || block.priorityWeight >= 92;

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 24, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className={cn(
        'relative overflow-hidden rounded-[28px] border bg-white/[0.03] backdrop-blur-xl shadow-[0_18px_60px_-24px_rgba(0,0,0,0.75)]',
        'before:absolute before:inset-0 before:bg-gradient-to-br before:opacity-100 before:pointer-events-none',
        'after:absolute after:inset-x-0 after:top-0 after:h-px after:bg-white/10 after:pointer-events-none',
        ACCENT_STYLES[block.accent],
        SIZE_CLASSES[block.size],
        className
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.10),transparent_35%)] pointer-events-none" />
      <div className={cn('relative z-10 h-full p-5 md:p-6', contentClassName)}>
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              {isLive && (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                  <Activity size={10} className="text-primary-300" />
                  Live
                </span>
              )}
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                Relevance {Math.round(block.relevanceScore)}
              </span>
            </div>
            <h3 className="text-lg md:text-xl font-semibold text-white tracking-tight">
              {block.title}
            </h3>
            {block.subtitle ? (
              <p className="mt-1 text-sm text-slate-300/80 max-w-[46ch]">{block.subtitle}</p>
            ) : null}
          </div>
          {headerRight}
        </div>

        {children}
      </div>
    </motion.section>
  );
};
