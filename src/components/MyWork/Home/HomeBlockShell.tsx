import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils';

import type { HomeBlock } from './homeV2Types';

export type HomeBlockShellDensity = 'comfortable' | 'compact';

interface HomeBlockShellProps {
  block: HomeBlock;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  headerRight?: React.ReactNode;
  /** compact = denser radar grid (default). */
  density?: HomeBlockShellDensity;
}

const ACCENT_STYLES: Record<HomeBlock['accent'], string> = {
  ai: 'from-primary-500/15 via-primary-500/8 to-blue-500/[0.12] border-primary-400/20',
  warm: 'from-amber-500/15 via-amber-500/[0.08] to-danger-500/[0.12] border-amber-400/20',
  cool: 'from-indigo-500/15 via-blue-500/[0.08] to-blue-500/[0.12] border-indigo-400/20',
  alert: 'from-danger-500/[0.16] via-amber-500/10 to-amber-500/10 border-danger-400/20',
  success: 'from-emerald-500/15 via-blue-500/[0.08] to-blue-500/10 border-emerald-400/20',
  neutral: 'from-white/[0.06] via-white/[0.03] to-white/[0.02] border-white/[0.08]',
};

const COMFORTABLE_SIZE: Record<HomeBlock['size'], string> = {
  hero: 'col-span-12 min-h-[22rem]',
  lg: 'col-span-12 xl:col-span-7 min-h-[20rem]',
  md: 'col-span-12 md:col-span-6 xl:col-span-5 min-h-[18rem]',
  sm: 'col-span-12 md:col-span-6 xl:col-span-4 min-h-[16rem]',
};

const COMPACT_SIZE: Record<HomeBlock['size'], string> = {
  hero: 'col-span-12 min-h-0',
  lg: 'col-span-12 lg:col-span-6 min-h-0',
  md: 'col-span-12 md:col-span-6 min-h-0',
  sm: 'col-span-12 sm:col-span-6 xl:col-span-4 min-h-0',
};

/** Delicate left rim — signals block “personality” without loud chrome. */
const ACCENT_LEFT_BORDER: Record<HomeBlock['accent'], string> = {
  ai: 'border-l-primary-400/35',
  warm: 'border-l-amber-400/35',
  cool: 'border-l-blue-400/35',
  alert: 'border-l-danger-400/35',
  success: 'border-l-emerald-400/30',
  neutral: 'border-l-slate-400/22',
};

export const HomeBlockShell: React.FC<HomeBlockShellProps> = ({
  block,
  children,
  className,
  contentClassName,
  headerRight,
  density = 'compact',
}) => {
  const { t } = useTranslation();
  const isLive = block.freshnessScore >= 75 || block.priorityWeight >= 92;
  const isCompact = density === 'compact';
  const sizeClasses = isCompact ? COMPACT_SIZE : COMFORTABLE_SIZE;

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 16, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.38, ease: 'easeOut' }}
      className={cn(
        'relative overflow-hidden border bg-white/[0.025] backdrop-blur-xl',
        isCompact
          ? 'rounded-2xl border-white/[0.09] shadow-[0_8px_40px_-18px_rgba(0,0,0,0.65)]'
          : 'rounded-[28px] shadow-[0_18px_60px_-24px_rgba(0,0,0,0.75)]',
        'before:absolute before:inset-0 before:bg-gradient-to-br before:opacity-100 before:pointer-events-none',
        'after:absolute after:inset-x-0 after:top-0 after:h-px after:bg-white/10 after:pointer-events-none',
        isCompact && cn('border-l-2', ACCENT_LEFT_BORDER[block.accent]),
        ACCENT_STYLES[block.accent],
        sizeClasses[block.size],
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.07),transparent_38%)]" />
      <div
        className={cn(
          'relative z-10 h-full',
          isCompact ? 'p-3 md:p-3.5' : 'p-5 md:p-6',
          contentClassName
        )}
      >
        <div className={cn('flex items-start justify-between gap-2', isCompact ? 'mb-2' : 'mb-4')}>
          <div className="min-w-0">
            <div className={cn('flex items-center gap-1.5', isCompact ? 'mb-0.5' : 'mb-1.5')}>
              {isLive && (
                <span className="inline-flex items-center gap-1 font-mono text-[8px] uppercase tracking-wider text-blue-300/70">
                  <Activity size={8} className="text-blue-300/80" />
                  {t('myWork.radar.live')}
                </span>
              )}
              <span className="font-mono text-[8px] font-medium uppercase tracking-wider text-white/30">
                {t('myWork.radar.rel')} {Math.round(block.relevanceScore)}
              </span>
            </div>
            <h3
              className={cn(
                'font-semibold tracking-tight text-white',
                isCompact ? 'text-sm md:text-base' : 'text-lg md:text-xl'
              )}
            >
              {block.title}
            </h3>
            {block.subtitle ? (
              <p
                className={cn(
                  'mt-0.5 max-w-[50ch] text-slate-600/80',
                  isCompact ? 'text-[11px] leading-relaxed' : 'text-sm'
                )}
              >
                {block.subtitle}
              </p>
            ) : null}
          </div>
          {headerRight}
        </div>

        {children}
      </div>
    </motion.section>
  );
};
