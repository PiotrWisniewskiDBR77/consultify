/**
 * AppIcon — Canonical icon wrapper (T101)
 *
 * Enforces consistent sizing, stroke width, and color behavior
 * across the application per docs/ui-standards visual-language.md.
 *
 * Size tokens: xs=14, sm=16, md=18, lg=20, xl=24, 2xl=32
 * Stroke: 1.75 (canonical, never drifts per-screen)
 * Color: inherits text color from parent (currentColor) — never colored in nav.
 */

import type { LucideIcon, LucideProps } from 'lucide-react';
import React from 'react';

export const ICON_SIZE_TOKENS = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 20,
  xl: 24,
  '2xl': 32,
} as const;

export type IconSize = keyof typeof ICON_SIZE_TOKENS;

const CANONICAL_STROKE_WIDTH = 1.75;

export interface AppIconProps extends Omit<LucideProps, 'size' | 'ref'> {
  icon: LucideIcon;
  size?: IconSize | number;
  /** Override stroke width (default: 1.75). Use sparingly. */
  strokeWidth?: number;
  /** Accessibility: decorative icons get aria-hidden automatically. Set to false for interactive icons with aria-label. */
  decorative?: boolean;
}

export const AppIcon: React.FC<AppIconProps> = ({
  icon: Icon,
  size = 'lg',
  strokeWidth = CANONICAL_STROKE_WIDTH,
  decorative = true,
  className,
  ...rest
}) => {
  const px = typeof size === 'number' ? size : ICON_SIZE_TOKENS[size];

  return (
    <Icon
      size={px}
      strokeWidth={strokeWidth}
      className={className}
      aria-hidden={decorative ? true : undefined}
      {...rest}
    />
  );
};

export default AppIcon;
