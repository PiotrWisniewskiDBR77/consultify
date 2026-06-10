/**
 * ToolChip — tool / artifact chip: a COLORED icon on a NEUTRAL surface.
 *
 * Per §N, tool/artifact chips may use a colored icon to identify the tool,
 * but the chip background stays neutral. The icon color is supplied as a
 * CSS-var-friendly color string (e.g. `var(--c-info)`) or any valid CSS
 * color; defaults to the Harvard-crimson accent.
 */

import type { LucideIcon } from 'lucide-react';
import React from 'react';

import { CHIP_ICON_PX, ChipBase, type ChipSize } from './chipBase';

export interface ToolChipProps {
  label: React.ReactNode;
  icon: LucideIcon;
  /** Icon color (any CSS color or `c.*` var). Defaults to the accent. */
  iconColor?: string;
  size?: ChipSize;
  className?: string;
  title?: string;
}

export const ToolChip: React.FC<ToolChipProps> = ({
  label,
  icon: Icon,
  iconColor = 'var(--c-accent)',
  size = 'sm',
  className,
  title,
}) => (
  <ChipBase
    size={size}
    title={title}
    className={className}
    leading={
      <Icon
        size={CHIP_ICON_PX[size]}
        className="shrink-0"
        style={{ color: iconColor }}
        aria-hidden="true"
      />
    }
  >
    {label}
  </ChipBase>
);

export default ToolChip;
