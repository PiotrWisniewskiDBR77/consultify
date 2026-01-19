/**
 * Skeleton - Loading state components for Strategic Tools
 *
 * Provides skeleton loaders for various tool components.
 */

import React from 'react';

// ==================== BASE SKELETON ====================

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  width,
  height,
  animation = 'pulse',
}) => {
  const baseClasses = 'bg-slate-200 dark:bg-navy-700';
  
  const variantClasses = {
    text: 'rounded',
    circular: 'rounded-full',
    rectangular: '',
    rounded: 'rounded-lg',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-hig-skeleton bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-navy-700 dark:via-navy-600 dark:to-navy-700 bg-[length:200%_100%]',
    none: '',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;
  if (variant === 'text' && !height) style.height = '1em';

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
    />
  );
};

// ==================== COMPOUND SKELETONS ====================

/**
 * Skeleton for tool header
 */
export const ToolHeaderSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700">
    {/* Top bar */}
    <div className="px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Skeleton variant="circular" width={40} height={40} />
        <div className="space-y-2">
          <Skeleton width={150} height={20} />
          <Skeleton width={100} height={14} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton width={100} height={8} variant="rounded" />
        <Skeleton width={40} height={20} />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton variant="circular" width={36} height={36} />
        <Skeleton variant="circular" width={36} height={36} />
        <Skeleton width={140} height={36} variant="rounded" />
      </div>
    </div>

    {/* Step navigation */}
    <div className="px-4 py-2 flex items-center gap-2">
      {Array.from({ length: 7 }).map((_, i) => (
        <Skeleton key={i} width={100} height={32} variant="rounded" />
      ))}
    </div>
  </div>
);

/**
 * Skeleton for SWOT matrix
 */
export const SWOTMatrixSkeleton: React.FC = () => (
  <div className="grid grid-cols-2 gap-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <div
        key={i}
        className="p-4 rounded-lg border border-slate-200 dark:border-navy-700"
      >
        <div className="flex items-center gap-2 mb-3">
          <Skeleton variant="circular" width={24} height={24} />
          <Skeleton width={100} height={16} />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, j) => (
            <Skeleton key={j} height={48} variant="rounded" />
          ))}
        </div>
      </div>
    ))}
  </div>
);

/**
 * Skeleton for Porter radar
 */
export const PorterRadarSkeleton: React.FC = () => (
  <div className="space-y-6">
    {/* Overall attractiveness */}
    <div className="p-4 rounded-lg border border-slate-200 dark:border-navy-700">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton width={150} height={20} />
          <Skeleton width={200} height={14} />
        </div>
        <Skeleton width={60} height={40} />
      </div>
      <Skeleton className="mt-4" width="100%" height={12} variant="rounded" />
    </div>

    {/* Force bars */}
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center justify-between">
            <Skeleton width={150} height={16} />
            <Skeleton width={40} height={16} />
          </div>
          <Skeleton height={8} variant="rounded" />
        </div>
      ))}
    </div>
  </div>
);

/**
 * Skeleton for initiative card
 */
export const InitiativeCardSkeleton: React.FC = () => (
  <div className="p-4 rounded-lg border border-slate-200 dark:border-navy-700 space-y-3">
    <div className="flex items-start justify-between">
      <div className="space-y-2 flex-1">
        <Skeleton width="70%" height={20} />
        <Skeleton width="100%" height={14} />
        <Skeleton width="80%" height={14} />
      </div>
      <Skeleton width={80} height={24} variant="rounded" />
    </div>
    <div className="flex items-center gap-4">
      <Skeleton width={80} height={14} />
      <Skeleton width={80} height={14} />
    </div>
  </div>
);

/**
 * Skeleton for step content area
 */
export const StepContentSkeleton: React.FC = () => (
  <div className="space-y-6">
    {/* Title */}
    <div className="flex items-center gap-3">
      <Skeleton variant="circular" width={40} height={40} />
      <Skeleton width={200} height={28} />
    </div>

    {/* Form fields */}
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton width={120} height={16} />
        <Skeleton height={80} variant="rounded" />
      </div>
      <div className="space-y-2">
        <Skeleton width={120} height={16} />
        <Skeleton height={60} variant="rounded" />
      </div>
    </div>

    {/* Info box */}
    <Skeleton height={60} variant="rounded" />
  </div>
);

/**
 * Skeleton for chat sidebar
 */
export const ChatSidebarSkeleton: React.FC = () => (
  <div className="w-96 border-l border-slate-200 dark:border-navy-700 flex flex-col">
    {/* Header */}
    <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700">
      <div className="flex items-center justify-between">
        <Skeleton width={100} height={20} />
        <Skeleton width={70} height={28} variant="rounded" />
      </div>
    </div>

    {/* Messages */}
    <div className="flex-1 p-4 space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
          <Skeleton
            width={i % 2 === 0 ? '75%' : '60%'}
            height={60}
            variant="rounded"
          />
        </div>
      ))}
    </div>

    {/* Input */}
    <div className="p-4 border-t border-slate-200 dark:border-navy-700">
      <div className="flex items-end gap-2">
        <Skeleton className="flex-1" height={60} variant="rounded" />
        <Skeleton width={40} height={40} variant="circular" />
      </div>
    </div>
  </div>
);

/**
 * Full workspace skeleton
 */
export const ToolWorkspaceSkeleton: React.FC = () => (
  <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950">
    <ToolHeaderSkeleton />
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 p-6">
        <StepContentSkeleton />
      </div>
      <ChatSidebarSkeleton />
    </div>
    {/* Action bar */}
    <div className="px-4 py-3 border-t border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
      <div className="flex items-center justify-between">
        <Skeleton width={100} height={36} variant="rounded" />
        <div className="flex items-center gap-2">
          <Skeleton width={120} height={36} variant="rounded" />
          <Skeleton width={100} height={36} variant="rounded" />
        </div>
      </div>
    </div>
  </div>
);

export default Skeleton;
