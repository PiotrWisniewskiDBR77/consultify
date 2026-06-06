/**
 * MetaChip — neutral metadata chip: text + optional leading icon.
 *
 * Always neutral surface and neutral icon (metadata is never colored — §N).
 * Use for tags, counts, dates-without-risk, source labels, etc.
 */

import type { LucideIcon } from 'lucide-react';
import React from 'react';

import { CHIP_ICON_PX, ChipBase, type ChipSize } from './chipBase';

export interface MetaChipProps {
  label: React.ReactNode;
  /** Optional leading icon (rendered in the neutral muted color). */
  icon?: LucideIcon;
  size?: ChipSize;
  /** Optional trailing slot (e.g. a small count). */
  trailing?: React.ReactNode;
  className?: string;
  title?: string;
}

export const MetaChip: React.FC<MetaChipProps> = ({
  label,
  icon: Icon,
  size = 'sm',
  trailing,
  className,
  title,
}) => (
  <ChipBase
    size={size}
    title={title}
    className={className}
    leading={
      Icon ? (
        <Icon size={CHIP_ICON_PX[size]} className="shrink-0 text-c-text-muted" aria-hidden="true" />
      ) : undefined
    }
    trailing={trailing}
  >
    {label}
  </ChipBase>
);

export default MetaChip;
