/**
 * Admin Button — COMPATIBILITY ADAPTER (fork retired, X1 Design System)
 *
 * The bespoke Admin button implementation was deleted. This module is now a thin
 * adapter that delegates rendering to the canonical primitive
 * `src/components/ui/primitives/Button`, preserving the legacy Admin API
 * (`icon` as a LucideIcon component, `iconPosition`, variants) so existing
 * Admin / SuperAdmin views keep working. Prefer importing directly from
 * `@/components/ui/primitives` in new code.
 */

import { Loader2, LucideIcon } from 'lucide-react';
import React from 'react';

import {
  Button as PrimitiveButton,
  type ButtonSize,
  type ButtonVariant as PrimitiveButtonVariant,
} from '../../ui/primitives/Button';

type AdminButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AdminButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  children?: React.ReactNode;
}

// Admin variants map 1:1 onto canonical primitive variants.
const variantMap: Record<AdminButtonVariant, PrimitiveButtonVariant> = {
  primary: 'primary',
  secondary: 'secondary',
  ghost: 'ghost',
  danger: 'danger',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  children,
  ...props
}) => {
  const iconEl = Icon ? <Icon /> : undefined;
  return (
    <PrimitiveButton
      variant={variantMap[variant]}
      size={size}
      loading={loading}
      icon={iconPosition === 'left' ? iconEl : undefined}
      iconRight={iconPosition === 'right' ? iconEl : undefined}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </PrimitiveButton>
  );
};

// Icon-only button — kept as a small composed wrapper (no direct primitive equivalent).
interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  size?: ButtonSize;
  variant?: 'ghost' | 'danger';
  label?: string;
  loading?: boolean;
}

const iconSizes: Record<ButtonSize, number> = { sm: 14, md: 16, lg: 18 };

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
      ? 'text-navy-500 dark:text-navy-400 hover:text-danger-600 dark:hover:text-danger-400 hover:bg-danger-500/10'
      : 'text-navy-500 dark:text-navy-400 hover:text-navy-900 dark:hover:text-white hover:bg-c-surface-raised dark:hover:bg-white/[0.04]';

  return (
    <button
      className={`${paddingClass} rounded-token-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson-600/40 disabled:opacity-50 disabled:cursor-not-allowed ${variantClass} ${className}`
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
