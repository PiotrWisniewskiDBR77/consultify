/**
 * PriorityChip — priority level with a compact colored dot SIGNAL.
 *
 * urgent → danger, high → warning, medium → info, low → neutral.
 * The shell stays neutral; only the dot carries color (§N).
 */

import React from 'react';

import { CHIP_TONE_VAR, ChipBase, ChipDot, type ChipSize } from './chipBase';

export type PriorityLevel = 'urgent' | 'high' | 'medium' | 'low';

const PRIORITY_VAR: Record<PriorityLevel, string | undefined> = {
  urgent: CHIP_TONE_VAR.danger,
  high: CHIP_TONE_VAR.warning,
  medium: CHIP_TONE_VAR.info,
  low: undefined, // neutral signal
};

const PRIORITY_FALLBACK_LABEL: Record<PriorityLevel, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export interface PriorityChipProps {
  level: PriorityLevel;
  /** Override the visible label (e.g. localized). Defaults to a capitalized level. */
  label?: React.ReactNode;
  size?: ChipSize;
  className?: string;
  title?: string;
}

export const PriorityChip: React.FC<PriorityChipProps> = ({
  level,
  label,
  size = 'sm',
  className,
  title,
}) => (
  <ChipBase
    size={size}
    title={title}
    className={className}
    leading={<ChipDot colorVar={PRIORITY_VAR[level]} size={size} />}
  >
    {label ?? PRIORITY_FALLBACK_LABEL[level]}
  </ChipBase>
);

export default PriorityChip;
