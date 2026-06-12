/**
 * Button Component - Apple HIG Design System
 *
 * A premium button component with elegant animations and depth-based styling.
 * Supports multiple variants, sizes, and states following Apple Human Interface Guidelines.
 *
 * @example
 * <Button variant="primary" size="md">Save Changes</Button>
 * <Button variant="ghost" icon={<Settings />}>Settings</Button>
 * <Button variant="danger" loading>Deleting...</Button>
 */

import { HTMLMotionProps, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import React, { forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'brand' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  /** Visual style variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Full width button */
  fullWidth?: boolean;
  /** Icon to display before children */
  icon?: React.ReactNode;
  /** Icon to display after children */
  iconRight?: React.ReactNode;
  /** Loading state - shows spinner and disables button */
  loading?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Button content */
  children?: React.ReactNode;
}

/* VISUAL_STANDARD.md §5.1:
 * - primary = NEUTRAL high-contrast (navy-on-light / white-on-dark, OpenAI/Linear
 *   dark pattern) — the single "main action" look across all modules.
 * - brand (crimson) is reserved for brand moments (Talk to Teresa); red budget §2.3.
 * - focus rings are blue (--c-focus), never crimson. */
const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    text-white dark:text-navy-950
    bg-navy-900 dark:bg-[#F4F7FB]
    hover:bg-navy-800 dark:hover:bg-[#DDE5EF]
    active:bg-navy-950 dark:active:bg-[#C9D4E3]
    focus-visible:ring-c-focus
  `,
  brand: `
    text-white
    bg-crimson-600
    hover:bg-crimson-700
    active:bg-crimson-800
    focus-visible:ring-c-focus
    dark:bg-crimson-500 dark:hover:bg-crimson-600 dark:active:bg-crimson-700
  `,
  secondary: `
    text-navy-900 dark:text-white
    bg-slate-100 dark:bg-navy-800
    hover:bg-slate-200 dark:hover:bg-navy-700
    focus-visible:ring-c-focus
  `,
  ghost: `
    text-slate-600 dark:text-slate-400
    bg-transparent
    hover:bg-slate-100 dark:hover:bg-white/5
    hover:text-navy-900 dark:hover:text-white
    focus-visible:ring-c-focus
  `,
  danger: `
    text-white
    bg-danger-600
    hover:bg-danger-700
    active:bg-danger-800
    dark:bg-danger-500 dark:hover:bg-danger-600
    focus-visible:ring-c-focus
  `,
  outline: `
    text-slate-700 dark:text-slate-200
    bg-transparent
    border border-slate-300 dark:border-c-border
    hover:border-slate-400 dark:hover:border-c-border-strong dark:hover:bg-white/5
    hover:bg-slate-50
    focus-visible:ring-c-focus
  `,
};

/* Controls are 8px-radius rectangles (rounded-lg); pills are reserved for
 * badges/chips/avatars (VISUAL_STANDARD.md §4). */
const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'px-4 py-2.5 text-sm gap-2 rounded-lg',
  lg: 'px-6 py-3 text-base gap-2 rounded-lg',
};

const iconSizeMap: Record<ButtonSize, number> = {
  sm: 14,
  md: 16,
  lg: 18,
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      icon,
      iconRight,
      loading = false,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    const iconSize = iconSizeMap[size];

    return (
      <motion.button
        ref={ref}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center
          font-medium
          transition-all duration-150 ease-out
          outline-none
          focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-navy-950
          disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `
          .trim()
          .replace(/\s+/g, ' ')}
        whileTap={!isDisabled ? { scale: 0.97 } : undefined}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        {...props}
      >
        {loading ? (
          <Loader2 size={iconSize} className="animate-spin" />
        ) : (
          icon && (
            <span className="flex-shrink-0">
              {React.isValidElement(icon)
                ? React.cloneElement(icon as React.ReactElement<{ size?: number }>, {
                    size: iconSize,
                  })
                : icon}
            </span>
          )
        )}
        {children && <span>{children}</span>}
        {iconRight && !loading && (
          <span className="flex-shrink-0">
            {React.isValidElement(iconRight)
              ? React.cloneElement(iconRight as React.ReactElement<{ size?: number }>, {
                  size: iconSize,
                })
              : iconRight}
          </span>
        )}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
