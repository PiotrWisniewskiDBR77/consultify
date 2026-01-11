/**
 * Admin Button Component
 *
 * Minimalist button variants for Admin module
 * Variants: primary, secondary, ghost, icon
 * Sizes: sm, md, lg
 */

import { Loader2, LucideIcon } from 'lucide-react';
import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  children?: React.ReactNode;
}

/**
 * DBR77 Color System - Button Variants
 * See: docs/00_foundation/COLOR_SYSTEM_STANDARD.md
 */
const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary-600 hover:bg-primary-700 text-white', // Fiolet
  secondary: 'bg-secondary-800 hover:bg-secondary-900 text-white border border-white/10', // Navy
  ghost: 'hover:bg-white/[0.04] text-slate-400 dark:text-slate-500 hover:text-slate-300',
  danger: 'bg-danger-600/10 hover:bg-danger-600/20 text-danger-400 border border-danger-500/20', // Czerwień
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-sm gap-2',
};

const iconSizes: Record<ButtonSize, number> = {
  sm: 14,
  md: 16,
  lg: 18,
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}) => {
  const isDisabled = disabled || loading;
  const iconSize = iconSizes[size];

  return (
    <button
      className={`
                inline-flex items-center justify-center font-medium rounded-lg 
                transition-colors focus:outline-none focus-visible:ring-2 
                focus-visible:ring-primary-500/50 focus-visible:ring-offset-2 
                focus-visible:ring-offset-slate-900
                disabled:opacity-50 disabled:cursor-not-allowed
                ${variantClasses[variant]}
                ${sizeClasses[size]}
                ${className}
            `
        .trim()
        .replace(/\s+/g, ' ')}
      disabled={isDisabled}
      {...props}
    >
      {loading ? (
        <Loader2 size={iconSize} className="animate-spin" />
      ) : (
        Icon && iconPosition === 'left' && <Icon size={iconSize} />
      )}
      {children}
      {!loading && Icon && iconPosition === 'right' && <Icon size={iconSize} />}
    </button>
  );
};

// Icon-only button variant
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  size?: ButtonSize;
  variant?: 'ghost' | 'danger';
  label?: string;
  loading?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon: Icon,
  size = 'md',
  variant = 'ghost',
  label,
  loading = false,
  disabled,
  className = '',
  ...props
}) => {
  const iconSize = iconSizes[size];
  const paddingClass = size === 'sm' ? 'p-1.5' : size === 'lg' ? 'p-2.5' : 'p-2';

  const variantClass =
    variant === 'danger'
      ? 'text-slate-400 dark:text-slate-500 hover:text-red-400 hover:bg-red-500/10'
      : 'text-slate-400 dark:text-slate-500 hover:text-white hover:bg-white/[0.04]';

  return (
    <button
      className={`
                ${paddingClass} rounded-lg transition-colors
                focus:outline-none focus-visible:ring-2 
                focus-visible:ring-primary-500/50
                disabled:opacity-50 disabled:cursor-not-allowed
                ${variantClass}
                ${className}
            `
        .trim()
        .replace(/\s+/g, ' ')}
      disabled={disabled || loading}
      title={label}
      aria-label={label}
      {...props}
    >
      {loading ? <Loader2 size={iconSize} className="animate-spin" /> : <Icon size={iconSize} />}
    </button>
  );
};

export default Button;
