/**
 * Spinner Component - Apple HIG Design System
 *
 * A loading spinner with smooth animation.
 * Supports multiple sizes and colors.
 *
 * @example
 * <Spinner size="md" />
 * <Spinner size="lg" color="primary" />
 */

import React, { forwardRef } from 'react';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type SpinnerColor = 'primary' | 'white' | 'current';

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Spinner size */
  size?: SpinnerSize;
  /** Spinner color */
  color?: SpinnerColor;
  /** Label for accessibility */
  label?: string;
}

const sizeStyles: Record<SpinnerSize, { container: string; border: string }> = {
  xs: { container: 'w-3 h-3', border: 'border' },
  sm: { container: 'w-4 h-4', border: 'border-[1.5px]' },
  md: { container: 'w-5 h-5', border: 'border-2' },
  lg: { container: 'w-8 h-8', border: 'border-[2.5px]' },
  xl: { container: 'w-12 h-12', border: 'border-[3px]' },
};

const colorStyles: Record<SpinnerColor, { track: string; active: string }> = {
  primary: {
    track: 'border-primary-200 dark:border-primary-900/30',
    active: 'border-t-primary-500',
  },
  white: {
    track: 'border-c-border',
    active: 'border-t-white',
  },
  current: {
    track: 'border-current/20',
    active: 'border-t-current',
  },
};

export const Spinner = forwardRef<HTMLDivElement, SpinnerProps>(
  ({ size = 'md', color = 'primary', label = 'Loading', className = '', ...props }, ref) => {
    const { container, border } = sizeStyles[size];
    const { track, active } = colorStyles[color];

    return (
      <div
        ref={ref}
        role="status"
        aria-label={label}
        className={`
          inline-flex items-center justify-center
          ${className}
        `}
        {...props}
      >
        <div
          className={`
            ${container}
            ${border}
            ${track}
            ${active}
            rounded-full
            animate-spin
          `}
        />
        <span className="sr-only">{label}</span>
      </div>
    );
  }
);

Spinner.displayName = 'Spinner';

// Full page loading overlay
export interface LoadingOverlayProps {
  /** Show overlay */
  visible?: boolean;
  /** Loading message */
  message?: string;
  /** Blur background */
  blur?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible = true,
  message,
  blur = true,
}) => {
  if (!visible) return null;

  return (
    <div
      className={`
        fixed inset-0 z-overlay
        flex flex-col items-center justify-center gap-4
        bg-white/80 dark:bg-navy-950/80
        ${blur ? 'backdrop-blur-sm' : ''}
      `}
    >
      <Spinner size="xl" />
      {message && (
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{message}</p>
      )}
    </div>
  );
};

// Inline loading indicator
export interface InlineLoaderProps {
  /** Show loader */
  loading?: boolean;
  /** Size */
  size?: SpinnerSize;
  /** Text to show while loading */
  text?: string;
  /** Children to show when not loading */
  children?: React.ReactNode;
}

export const InlineLoader: React.FC<InlineLoaderProps> = ({
  loading = false,
  size = 'sm',
  text,
  children,
}) => {
  if (!loading) return <>{children}</>;

  return (
    <span className="inline-flex items-center gap-2">
      <Spinner size={size} />
      {text && <span>{text}</span>}
    </span>
  );
};

export default Spinner;
