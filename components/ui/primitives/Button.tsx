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

import React, { forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
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

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    text-white
    bg-gradient-to-br from-primary-500 to-primary-600
    shadow-[0_4px_14px_rgba(124,58,237,0.25)]
    hover:from-primary-600 hover:to-primary-700
    hover:shadow-[0_6px_20px_rgba(124,58,237,0.35)]
    focus-visible:ring-primary-500/30
    dark:from-primary-500 dark:to-primary-600
  `,
  secondary: `
    text-navy-900 dark:text-white
    bg-slate-100 dark:bg-navy-800
    hover:bg-slate-200 dark:hover:bg-navy-700
    focus-visible:ring-primary-500/20
  `,
  ghost: `
    text-slate-600 dark:text-slate-400
    bg-transparent
    hover:bg-slate-100 dark:hover:bg-white/5
    hover:text-navy-900 dark:hover:text-white
    focus-visible:ring-primary-500/20
  `,
  danger: `
    text-white
    bg-gradient-to-br from-danger-500 to-danger-600
    shadow-[0_4px_14px_rgba(220,38,38,0.2)]
    hover:from-danger-600 hover:to-danger-700
    hover:shadow-[0_6px_20px_rgba(220,38,38,0.3)]
    focus-visible:ring-danger-500/30
  `,
  outline: `
    text-slate-700 dark:text-slate-200
    bg-transparent
    border border-slate-300 dark:border-white/10
    hover:border-primary-500 hover:text-primary-600
    dark:hover:border-primary-500 dark:hover:text-primary-400
    focus-visible:ring-primary-500/20
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-lg',
  md: 'px-4 py-2.5 text-sm gap-2 rounded-xl',
  lg: 'px-6 py-3 text-base gap-2.5 rounded-xl',
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
        `.trim().replace(/\s+/g, ' ')}
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
                ? React.cloneElement(icon as React.ReactElement<{ size?: number }>, { size: iconSize })
                : icon}
            </span>
          )
        )}
        {children && <span>{children}</span>}
        {iconRight && !loading && (
          <span className="flex-shrink-0">
            {React.isValidElement(iconRight)
              ? React.cloneElement(iconRight as React.ReactElement<{ size?: number }>, { size: iconSize })
              : iconRight}
          </span>
        )}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

export default Button;


