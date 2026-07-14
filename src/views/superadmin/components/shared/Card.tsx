/**
 * Admin Card — COMPATIBILITY ADAPTER (fork retired, X1 Design System)
 *
 * The bespoke Admin card implementation was deleted. This module now delegates
 * to the canonical primitive `src/components/ui/primitives/Card`, preserving the
 * legacy Admin API (`variant="base|bordered|elevated"`, `padding`, `onClick`,
 * plus the `CardWithHeader` / `StatsCard` / `Section` composed helpers) so
 * existing Admin / SuperAdmin views keep working. Prefer importing directly from
 * `@/components/ui/primitives` in new code.
 */

import React from 'react';

import {
  Card as PrimitiveCard,
  type CardPadding,
  type CardVariant as PrimitiveCardVariant,
} from '../../../../components/ui/primitives/Card';

type AdminCardVariant = 'base' | 'bordered' | 'elevated';

// Map legacy Admin variants onto canonical primitive variants.
const variantMap: Record<AdminCardVariant, PrimitiveCardVariant> = {
  base: 'filled',
  bordered: 'outlined',
  elevated: 'elevated',
};

interface CardProps {
  variant?: AdminCardVariant;
  padding?: CardPadding;
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({
  variant = 'base',
  padding = 'md',
  className = '',
  children,
  onClick,
}) => {
  const clickable = typeof onClick === 'function';
  return (
    <PrimitiveCard
      variant={variantMap[variant]}
      padding={padding}
      hoverable={clickable}
      className={className}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick?.();
            }
          : undefined
      }
    >
      {children}
    </PrimitiveCard>
  );
};

// Card with header — composed wrapper on the primitive Card.
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
    <PrimitiveCard variant={variantMap[variant]} padding="none" className={className}>
      <div className="flex items-start justify-between p-4 border-b border-navy-200 dark:border-white/[0.06]">
        <div>
          <h3 className="text-base font-medium text-navy-900 dark:text-navy-100">{title}</h3>
          {subtitle && (
            <p className="text-sm text-navy-500 dark:text-navy-400 mt-0.5">{subtitle}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </PrimitiveCard>
  );
};

// Stats card wrapper — for metric grids.
interface StatsCardProps {
  className?: string;
  children: React.ReactNode;
}

export const StatsCard: React.FC<StatsCardProps> = ({ className = '', children }) => (
  <PrimitiveCard variant="filled" padding="md" className={className}>
    {children}
  </PrimitiveCard>
);

// Section wrapper with title — pure layout, no card surface.
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
              <h2 className="text-lg font-semibold text-navy-900 dark:text-navy-100">{title}</h2>
              {subtitle && (
                <p className="text-sm text-navy-500 dark:text-navy-400 mt-0.5">{subtitle}</p>
              )}
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
