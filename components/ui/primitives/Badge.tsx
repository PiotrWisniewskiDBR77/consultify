/**
 * Badge Component - Apple HIG Design System
 *
 * A small status indicator for counts, labels, and statuses.
 * Supports multiple variants and sizes.
 *
 * @example
 * <Badge variant="primary">New</Badge>
 * <Badge variant="success" dot>Active</Badge>
 * <Badge variant="danger" count={5} />
 */

import React, { forwardRef } from 'react';

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'neutral';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    /** Visual style variant */
    variant?: BadgeVariant;
    /** Badge size */
    size?: BadgeSize;
    /** Show status dot */
    dot?: boolean;
    /** Count number (for notification badges) */
    count?: number;
    /** Max count to display */
    maxCount?: number;
    /** Pill shape (more rounded) */
    pill?: boolean;
    /** Badge content */
    children?: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
    primary: `
    bg-primary-100 text-primary-700
    dark:bg-primary-900/30 dark:text-primary-300
  `,
    secondary: `
    bg-secondary-100 text-secondary-700
    dark:bg-secondary-900/30 dark:text-secondary-300
  `,
    success: `
    bg-success-100 text-success-700
    dark:bg-success-900/30 dark:text-success-300
  `,
    danger: `
    bg-danger-100 text-danger-700
    dark:bg-danger-900/30 dark:text-danger-300
  `,
    warning: `
    bg-amber-100 text-amber-700
    dark:bg-amber-900/30 dark:text-amber-300
  `,
    neutral: `
    bg-slate-100 text-slate-700
    dark:bg-slate-800 dark:text-slate-300
  `,
};

const dotColors: Record<BadgeVariant, string> = {
    primary: 'bg-primary-500',
    secondary: 'bg-secondary-500',
    success: 'bg-success-500',
    danger: 'bg-danger-500',
    warning: 'bg-amber-500',
    neutral: 'bg-slate-500',
};

const sizeStyles: Record<BadgeSize, { badge: string; dot: string }> = {
    sm: { badge: 'px-1.5 py-0.5 text-[10px]', dot: 'w-1.5 h-1.5' },
    md: { badge: 'px-2 py-0.5 text-xs', dot: 'w-2 h-2' },
    lg: { badge: 'px-2.5 py-1 text-sm', dot: 'w-2.5 h-2.5' },
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
    (
        {
            variant = 'neutral',
            size = 'md',
            dot = false,
            count,
            maxCount = 99,
            pill = true,
            children,
            className = '',
            ...props
        },
        ref,
    ) => {
        const { badge: sizeClass, dot: dotSize } = sizeStyles[size];

        // For count badges
        const displayCount = count !== undefined ? (count > maxCount ? `${maxCount}+` : count.toString()) : null;

        // Don't render if count is 0
        if (count !== undefined && count === 0) return null;

        return (
            <span
                ref={ref}
                className={`
          inline-flex items-center gap-1.5
          font-medium
          ${pill ? 'rounded-full' : 'rounded-md'}
          ${variantStyles[variant]}
          ${sizeClass}
          ${className}
        `
                    .trim()
                    .replace(/\s+/g, ' ')}
                {...props}
            >
                {dot && <span className={`${dotSize} rounded-full ${dotColors[variant]} flex-shrink-0`} />}
                {displayCount ?? children}
            </span>
        );
    },
);

Badge.displayName = 'Badge';

// Notification dot badge (absolute positioned)
export interface NotificationBadgeProps {
    /** Count to display */
    count?: number;
    /** Max count */
    maxCount?: number;
    /** Show even if count is 0 */
    showZero?: boolean;
    /** Just show a dot without count */
    dot?: boolean;
    /** Position offset */
    offset?: [number, number];
    /** Children to wrap */
    children: React.ReactNode;
}

export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
    count = 0,
    maxCount = 99,
    showZero = false,
    dot = false,
    offset = [-4, -4],
    children,
}) => {
    const shouldShow = dot || showZero || count > 0;
    const displayCount = count > maxCount ? `${maxCount}+` : count;

    return (
        <div className="relative inline-flex">
            {children}
            {shouldShow && (
                <span
                    className={`
            absolute
            flex items-center justify-center
            ${dot ? 'w-2.5 h-2.5' : 'min-w-[18px] h-[18px] px-1'}
            bg-danger-500 text-white
            text-[10px] font-bold
            rounded-full
            border-2 border-white dark:border-navy-900
            transform
          `}
                    style={{
                        top: offset[1],
                        right: offset[0],
                    }}
                >
                    {!dot && displayCount}
                </span>
            )}
        </div>
    );
};

export default Badge;
