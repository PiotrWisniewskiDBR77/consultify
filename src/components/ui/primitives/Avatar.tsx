/**
 * Avatar Component - Apple HIG Design System
 *
 * A user/entity avatar with fallback initials and status indicator.
 * Supports images, initials, and icons.
 *
 * @example
 * <Avatar src="/user.jpg" name="John Doe" />
 * <Avatar name="John Doe" status="online" />
 * <AvatarGroup max={3}>{avatars}</AvatarGroup>
 */

import { User } from 'lucide-react';
import React, { forwardRef, useState } from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type AvatarStatus = 'online' | 'offline' | 'busy' | 'away';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Image source URL */
  src?: string;
  /** Alt text for image */
  alt?: string;
  /** Name for generating initials */
  name?: string;
  /** Avatar size */
  size?: AvatarSize;
  /** Status indicator */
  status?: AvatarStatus;
  /** Custom fallback icon */
  fallbackIcon?: React.ReactNode;
  /** Ring color on focus/selection */
  ring?: boolean;
}

const sizeStyles: Record<
  AvatarSize,
  { container: string; text: string; status: string; icon: number }
> = {
  xs: { container: 'w-6 h-6', text: 'text-[10px]', status: 'w-2 h-2 border', icon: 12 },
  sm: { container: 'w-8 h-8', text: 'text-xs', status: 'w-2.5 h-2.5 border-[1.5px]', icon: 14 },
  md: { container: 'w-10 h-10', text: 'text-sm', status: 'w-3 h-3 border-2', icon: 16 },
  lg: { container: 'w-12 h-12', text: 'text-base', status: 'w-3.5 h-3.5 border-2', icon: 20 },
  xl: { container: 'w-16 h-16', text: 'text-lg', status: 'w-4 h-4 border-2', icon: 24 },
  '2xl': { container: 'w-20 h-20', text: 'text-xl', status: 'w-5 h-5 border-2', icon: 28 },
};

const statusColors: Record<AvatarStatus, string> = {
  online: 'bg-success-500',
  offline: 'bg-slate-400',
  busy: 'bg-danger-500',
  away: 'bg-amber-500',
};

// Generate initials from name
const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// Generate consistent color from name
const getColorFromName = (name: string): string => {
  const colors = [
    'bg-sky-500',
    'bg-secondary-500',
    'bg-success-500',
    'bg-amber-500',
    'bg-pink-500',
    'bg-blue-500',
    'bg-indigo-500',
    'bg-danger-500',
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
};

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  (
    { src, alt, name, size = 'md', status, fallbackIcon, ring = false, className = '', ...props },
    ref
  ) => {
    const [imageError, setImageError] = useState(false);
    const { container, text, status: statusSize, icon: iconSize } = sizeStyles[size];

    const showImage = src && !imageError;
    const showInitials = !showImage && name;
    const showIcon = !showImage && !showInitials;

    const bgColor = name ? getColorFromName(name) : 'bg-slate-200 dark:bg-navy-700';

    return (
      <div
        ref={ref}
        className={`
          relative inline-flex items-center justify-center
          ${container}
          rounded-full
          overflow-hidden
          ${showImage ? '' : bgColor}
          ${ring ? 'ring-2 ring-c-info ring-offset-2 ring-offset-white dark:ring-offset-navy-900' : ''}
          ${className}
        `
          .trim()
          .replace(/\s+/g, ' ')}
        {...props}
      >
        {showImage && (
          <img
            src={src}
            alt={alt || name || 'Avatar'}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        )}

        {showInitials && (
          <span className={`font-medium text-white ${text}`}>{getInitials(name)}</span>
        )}

        {showIcon && (
          <span className="text-slate-500 dark:text-slate-400">
            {fallbackIcon || <User size={iconSize} />}
          </span>
        )}

        {status && (
          <span
            className={`
              absolute bottom-0 right-0
              ${statusSize}
              ${statusColors[status]}
              rounded-full
              border-white dark:border-navy-900
            `}
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

// Avatar Group
export interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Maximum avatars to show */
  max?: number;
  /** Avatar size */
  size?: AvatarSize;
  /** Children (Avatar components) */
  children: React.ReactNode;
}

export const AvatarGroup = forwardRef<HTMLDivElement, AvatarGroupProps>(
  ({ max = 4, size = 'md', children, className = '', ...props }, ref) => {
    const avatars = React.Children.toArray(children);
    const visibleAvatars = avatars.slice(0, max);
    const remainingCount = avatars.length - max;

    const { container, text } = sizeStyles[size];

    // Calculate negative margin based on size
    const overlapMargin = {
      xs: '-ml-2',
      sm: '-ml-2.5',
      md: '-ml-3',
      lg: '-ml-4',
      xl: '-ml-5',
      '2xl': '-ml-6',
    }[size];

    return (
      <div ref={ref} className={`flex items-center ${className}`} {...props}>
        {visibleAvatars.map((avatar, index) => (
          <div
            key={index}
            className={`
              ${index > 0 ? overlapMargin : ''}
              ring-2 ring-white dark:ring-navy-900
              rounded-full
            `}
          >
            {React.isValidElement(avatar)
              ? React.cloneElement(avatar as React.ReactElement<AvatarProps>, { size })
              : avatar}
          </div>
        ))}

        {remainingCount > 0 && (
          <div
            className={`
              ${overlapMargin}
              ${container}
              flex items-center justify-center
              rounded-full
              bg-slate-200 dark:bg-navy-700
              ring-2 ring-white dark:ring-navy-900
            `}
          >
            <span className={`font-medium text-slate-600 dark:text-slate-300 ${text}`}>
              +{remainingCount}
            </span>
          </div>
        )}
      </div>
    );
  }
);

AvatarGroup.displayName = 'AvatarGroup';

export default Avatar;
