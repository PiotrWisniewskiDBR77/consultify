/**
 * Skeleton Component - Apple HIG Design System
 *
 * Loading placeholder with smooth shimmer animation.
 * Helps maintain layout during content loading.
 *
 * @example
 * <Skeleton width={200} height={20} />
 * <Skeleton variant="circular" size={48} />
 * <Skeleton variant="text" lines={3} />
 */

import React, { forwardRef } from 'react';

export type SkeletonVariant = 'rectangular' | 'circular' | 'text';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Shape variant */
    variant?: SkeletonVariant;
    /** Width (px or string) */
    width?: number | string;
    /** Height (px or string) */
    height?: number | string;
    /** Size for circular variant */
    size?: number;
    /** Number of lines for text variant */
    lines?: number;
    /** Animation enabled */
    animation?: boolean;
}

export const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
    (
        { variant = 'rectangular', width, height, size, lines = 1, animation = true, className = '', style, ...props },
        ref,
    ) => {
        const baseClasses = `
      bg-slate-200 dark:bg-slate-700
      ${animation ? 'animate-hig-skeleton bg-[length:200%_100%]' : ''}
    `.trim();

        const shimmerGradient = animation
            ? {
                  backgroundImage:
                      'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
              }
            : {};

        // Circular variant
        if (variant === 'circular') {
            const circleSize = size || 40;
            return (
                <div
                    ref={ref}
                    className={`${baseClasses} rounded-full ${className}`}
                    style={{
                        width: circleSize,
                        height: circleSize,
                        ...shimmerGradient,
                        ...style,
                    }}
                    {...props}
                />
            );
        }

        // Text variant (multiple lines)
        if (variant === 'text') {
            return (
                <div ref={ref} className={`space-y-2 ${className}`} {...props}>
                    {Array.from({ length: lines }).map((_, index) => (
                        <div
                            key={index}
                            className={`${baseClasses} rounded-md dark:bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.1)_50%,transparent_100%)]`}
                            style={{
                                height: height || 16,
                                width: index === lines - 1 && lines > 1 ? '75%' : width || '100%',
                                ...shimmerGradient,
                            }}
                        />
                    ))}
                </div>
            );
        }

        // Rectangular variant (default)
        return (
            <div
                ref={ref}
                className={`${baseClasses} rounded-lg dark:bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.1)_50%,transparent_100%)] ${className}`}
                style={{
                    width: width || '100%',
                    height: height || 20,
                    ...shimmerGradient,
                    ...style,
                }}
                {...props}
            />
        );
    },
);

Skeleton.displayName = 'Skeleton';

// Card Skeleton preset
export interface CardSkeletonProps {
    /** Show avatar */
    avatar?: boolean;
    /** Number of text lines */
    lines?: number;
    /** Show action buttons */
    actions?: boolean;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({ avatar = true, lines = 3, actions = false }) => {
    return (
        <div className="p-4 rounded-2xl bg-white dark:bg-navy-800 shadow-hig-md">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
                {avatar && <Skeleton variant="circular" size={40} />}
                <div className="flex-1">
                    <Skeleton width="60%" height={16} className="mb-2" />
                    <Skeleton width="40%" height={12} />
                </div>
            </div>

            {/* Content */}
            <Skeleton variant="text" lines={lines} className="mb-4" />

            {/* Actions */}
            {actions && (
                <div className="flex gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-white/10">
                    <Skeleton width={80} height={32} className="rounded-lg" />
                    <Skeleton width={80} height={32} className="rounded-lg" />
                </div>
            )}
        </div>
    );
};

// Table Row Skeleton
export interface TableRowSkeletonProps {
    /** Number of columns */
    columns?: number;
    /** Number of rows */
    rows?: number;
}

export const TableRowSkeleton: React.FC<TableRowSkeletonProps> = ({ columns = 4, rows = 5 }) => {
    return (
        <>
            {Array.from({ length: rows }).map((_, rowIndex) => (
                <tr key={rowIndex}>
                    {Array.from({ length: columns }).map((_, colIndex) => (
                        <td key={colIndex} className="px-4 py-3">
                            <Skeleton
                                width={colIndex === 0 ? '70%' : colIndex === columns - 1 ? 60 : '50%'}
                                height={16}
                            />
                        </td>
                    ))}
                </tr>
            ))}
        </>
    );
};

// Avatar Group Skeleton
export interface AvatarGroupSkeletonProps {
    /** Number of avatars */
    count?: number;
    /** Avatar size */
    size?: number;
}

export const AvatarGroupSkeleton: React.FC<AvatarGroupSkeletonProps> = ({ count = 4, size = 32 }) => {
    return (
        <div className="flex -space-x-2">
            {Array.from({ length: count }).map((_, index) => (
                <Skeleton key={index} variant="circular" size={size} className="ring-2 ring-white dark:ring-navy-900" />
            ))}
        </div>
    );
};

export default Skeleton;
