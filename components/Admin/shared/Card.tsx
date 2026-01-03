/**
 * Admin Card Component
 * 
 * Clean card variants for Admin module
 * Variants: base, bordered, elevated
 * 
 * Key principles:
 * - No excessive borders
 * - Consistent padding
 * - Subtle backgrounds
 */

import React from 'react';

type CardVariant = 'base' | 'bordered' | 'elevated';

interface CardProps {
    variant?: CardVariant;
    padding?: 'none' | 'sm' | 'md' | 'lg';
    className?: string;
    children: React.ReactNode;
}

const variantClasses: Record<CardVariant, string> = {
    base: 'bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-transparent',
    bordered: 'bg-white dark:bg-transparent border border-slate-200 dark:border-white/[0.06] rounded-xl',
    elevated: 'bg-white dark:bg-slate-800 rounded-xl shadow-lg shadow-slate-200/50 dark:shadow-black/20 border border-slate-100 dark:border-transparent',
};

const paddingClasses: Record<string, string> = {
    none: '',
    sm: 'p-4',
    md: 'p-5',
    lg: 'p-6',
};

export const Card: React.FC<CardProps> = ({
    variant = 'base',
    padding = 'md',
    className = '',
    children,
}) => {
    return (
        <div className={`${variantClasses[variant]} ${paddingClasses[padding]} ${className}`}>
            {children}
        </div>
    );
};

// Card with header
interface CardWithHeaderProps extends Omit<CardProps, 'children'> {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}

export const CardWithHeader: React.FC<CardWithHeaderProps> = ({
    title,
    subtitle,
    action,
    variant = 'bordered',
    className = '',
    children,
}) => {
    return (
        <div className={`${variantClasses[variant]} ${className}`}>
            <div className="flex items-start justify-between p-5 border-b border-slate-200 dark:border-white/[0.06]">
                <div>
                    <h3 className="text-base font-medium text-slate-900 dark:text-slate-100">{title}</h3>
                    {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
                </div>
                {action && <div>{action}</div>}
            </div>
            <div className="p-5">
                {children}
            </div>
        </div>
    );
};

// Stats card wrapper - for metric grids
interface StatsCardProps {
    className?: string;
    children: React.ReactNode;
}

export const StatsCard: React.FC<StatsCardProps> = ({ className = '', children }) => (
    <div className={`bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-white/[0.04] rounded-lg p-4 ${className}`}>
        {children}
    </div>
);

// Section wrapper with title
interface SectionProps {
    title?: string;
    subtitle?: string;
    action?: React.ReactNode;
    className?: string;
    children: React.ReactNode;
}

export const Section: React.FC<SectionProps> = ({
    title,
    subtitle,
    action,
    className = '',
    children,
}) => {
    return (
        <section className={className}>
            {(title || action) && (
                <div className="flex items-start justify-between mb-4">
                    {title && (
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
                            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
                        </div>
                    )}
                    {action && <div>{action}</div>}
                </div>
            )}
            {children}
        </section>
    );
};

export default Card;


