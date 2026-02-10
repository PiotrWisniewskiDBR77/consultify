/**
 * StatusBadge + PriorityDot — Shared micro-components for consistent
 * status/priority rendering across all three view styles.
 */

import React from 'react';

/* ─────────────── Status Badge ─────────────── */

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    text: 'text-emerald-700 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    text: 'text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  danger: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    text: 'text-red-700 dark:text-red-400',
    dot: 'bg-red-500',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    text: 'text-blue-700 dark:text-blue-400',
    dot: 'bg-blue-500',
  },
  neutral: {
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-400',
    dot: 'bg-slate-400',
  },
  purple: {
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    text: 'text-purple-700 dark:text-purple-400',
    dot: 'bg-purple-500',
  },
};

interface StatusBadgeProps {
  label?: string;
  variant?: string;
  compact?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  variant = 'neutral',
  compact = false,
}) => {
  if (!label) return null;
  const colors = STATUS_COLORS[variant] || STATUS_COLORS.neutral;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-medium ${colors.bg} ${colors.text} ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
      {label}
    </span>
  );
};

/* ─────────────── Priority Dot ─────────────── */

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'text-red-500',
  high: 'text-orange-500',
  medium: 'text-blue-500',
  low: 'text-slate-400',
};

interface PriorityDotProps {
  label?: string;
  variant?: string;
  showLabel?: boolean;
}

export const PriorityDot: React.FC<PriorityDotProps> = ({
  label,
  variant = 'medium',
  showLabel = true,
}) => {
  if (!label) return null;
  const color = PRIORITY_COLORS[variant] || PRIORITY_COLORS.medium;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
      <svg width="8" height="8" viewBox="0 0 8 8" className="flex-shrink-0">
        <circle cx="4" cy="4" r="4" fill="currentColor" />
      </svg>
      {showLabel && <span className="capitalize">{label}</span>}
    </span>
  );
};

/* ─────────────── Avatar ─────────────── */

interface AvatarProps {
  name?: string;
  url?: string;
  size?: 'sm' | 'md';
}

export const Avatar: React.FC<AvatarProps> = ({ name, url, size = 'sm' }) => {
  if (!name && !url) return null;
  const sizeClass = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-7 h-7 text-xs';
  const initial = name ? name.charAt(0).toUpperCase() : '?';

  if (url) {
    return (
      <img
        src={url}
        alt={name || ''}
        className={`${sizeClass} rounded-full object-cover ring-1 ring-white dark:ring-navy-800`}
      />
    );
  }
  return (
    <span
      className={`${sizeClass} rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center font-semibold ring-1 ring-white dark:ring-navy-800`}
      title={name}
    >
      {initial}
    </span>
  );
};
