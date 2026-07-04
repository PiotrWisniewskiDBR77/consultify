/**
 * Card Component - Apple HIG Design System
 *
 * A versatile card component with elevation-based depth and smooth hover effects.
 * Supports multiple variants for different use cases.
 *
 * @example
 * <Card variant="elevated" padding="lg">Content here</Card>
 * <Card variant="glass" hoverable>Hover me</Card>
 */

import { HTMLMotionProps, motion } from 'framer-motion';
import React, { forwardRef } from 'react';

export type CardVariant = 'elevated' | 'filled' | 'outlined' | 'glass';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg' | 'xl';

export interface CardProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  /** Visual style variant */
  variant?: CardVariant;
  /** Internal padding */
  padding?: CardPadding;
  /** Enable hover lift effect */
  hoverable?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Card content */
  children?: React.ReactNode;
}

const variantStyles: Record<CardVariant, string> = {
  elevated: `
    bg-white dark:bg-navy-800
    shadow-[0_4px_6px_rgba(0,0,0,0.04),0_2px_4px_rgba(0,0,0,0.06)]
    dark:shadow-[0_4px_6px_rgba(0,0,0,0.25),0_2px_4px_rgba(0,0,0,0.3)]
  `,
  filled: `
    bg-slate-50 dark:bg-navy-900
  `,
  outlined: `
    bg-white dark:bg-navy-900
    border border-slate-200 dark:border-navy-700
  `,
  glass: `
    backdrop-blur-[20px]
    bg-gradient-to-br from-white/90 to-white/70
    dark:from-navy-900/80 dark:to-navy-900/60
    shadow-[0_4px_6px_rgba(0,0,0,0.04),0_2px_4px_rgba(0,0,0,0.06)]
    dark:shadow-[0_4px_6px_rgba(0,0,0,0.25),0_2px_4px_rgba(0,0,0,0.3)]
    border border-c-border dark:border-navy-700
  `,
};

const paddingStyles: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
  xl: 'p-8',
};

const hoverVariants = {
  initial: { y: 0 },
  hover: {
    y: -2,
    transition: { type: 'spring', stiffness: 400, damping: 25 },
  },
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    { variant = 'elevated', padding = 'md', hoverable = false, className = '', children, ...props },
    ref
  ) => {
    const baseClasses = `
      rounded-xl
      transition-shadow duration-200 ease-out
      ${variantStyles[variant]}
      ${paddingStyles[padding]}
      ${hoverable ? 'cursor-pointer' : ''}
      ${className}
    `
      .trim()
      .replace(/\s+/g, ' ');

    const hoverShadow =
      variant === 'elevated' || variant === 'glass'
        ? {
            boxShadow: '0 10px 15px rgba(0,0,0,0.04), 0 4px 6px rgba(0,0,0,0.05)',
          }
        : {};

    const darkHoverShadow = {
      boxShadow: '0 10px 15px rgba(0,0,0,0.3), 0 4px 6px rgba(0,0,0,0.25)',
    };

    if (hoverable) {
      return (
        <motion.div
          ref={ref}
          className={baseClasses}
          initial="initial"
          whileHover="hover"
          variants={hoverVariants as any}
          {...props}
        >
          {children}
        </motion.div>
      );
    }

    return (
      <div ref={ref} className={baseClasses} {...(props as React.HTMLAttributes<HTMLDivElement>)}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

// Card Header component
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Card title */
  title?: string;
  /** Card description/subtitle */
  description?: string;
  /** Actions to display on the right */
  actions?: React.ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ title, description, actions, children, className = '', ...props }, ref) => {
    return (
      <div ref={ref} className={`flex items-start justify-between gap-4 ${className}`} {...props}>
        <div className="flex-1 min-w-0">
          {title && (
            <h3 className="text-base font-semibold text-navy-900 dark:text-white truncate">
              {title}
            </h3>
          )}
          {description && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>
          )}
          {children}
        </div>
        {actions && <div className="flex-shrink-0">{actions}</div>}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

// Card Content component
export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div ref={ref} className={`mt-4 ${className}`} {...props}>
        {children}
      </div>
    );
  }
);

CardContent.displayName = 'CardContent';

// Card Footer component
export const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`mt-4 pt-4 border-t border-slate-200 dark:border-navy-700 flex items-center gap-3 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';

export default Card;
