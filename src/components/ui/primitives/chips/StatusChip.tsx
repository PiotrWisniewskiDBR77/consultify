/**
 * StatusChip — a status label with a compact colored dot SIGNAL.
 *
 * Tone maps to the semantic `c.*` color vars (success/warning/danger/info)
 * or stays neutral. The dot carries the color; the shell stays the neutral
 * chip surface so color reads as a signal, not decoration (§N).
 *
 * a11y: renders `role="status"` so assistive tech announces the state.
 */

import React from 'react';

import { CHIP_TONE_VAR, ChipBase, ChipDot, type ChipSize } from './chipBase';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

export interface StatusChipProps {
  label: React.ReactNode;
  tone?: StatusTone;
  size?: ChipSize;
  /** Hide the leading dot (text-only status). */
  hideDot?: boolean;
  className?: string;
  title?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  label,
  tone = 'neutral',
  size = 'sm',
  hideDot = false,
  className,
  title,
}) => {
  const colorVar = tone === 'neutral' ? undefined : CHIP_TONE_VAR[tone];
  return (
    <ChipBase
      size={size}
      role="status"
      title={title}
      className={className}
      leading={hideDot ? undefined : <ChipDot colorVar={colorVar} size={size} />}
    >
      {label}
    </ChipBase>
  );
};

export default StatusChip;
