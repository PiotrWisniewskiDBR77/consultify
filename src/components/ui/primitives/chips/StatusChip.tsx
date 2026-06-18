/**
 * StatusChip — a status label with a compact colored dot SIGNAL.
 *
 * Signal tones (success/warning/danger/info) carry a FILLED shell — tinted
 * background + border + toned text — in BOTH light and dark, per
 * light-mode-readability §5 / §18.2 (SYS-3 / VIS-001). The dot stays as the
 * grayscale-safe redundant signal (§8). Neutral keeps the plain chip surface.
 *
 * Centralizing the fill here fixes ~34 EntityStatusChip/StatusChip call sites
 * at once — previously every chip used the neutral shell, so a danger status
 * read as a plain grey pill in light mode (no fill = doesn't read as danger).
 *
 * a11y: renders `role="status"` so assistive tech announces the state.
 */

import React from 'react';

import { CHIP_TONE_VAR, ChipBase, ChipDot, type ChipSize } from './chipBase';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/**
 * Filled signal shells. Maps to the canonical Tailwind semantic scales
 * (info=blue, success=emerald, warning=amber, danger=red) — light gets
 * `50` fill + `200/300` border + `800/900` text (§5); dark gets the lifted
 * soft-tint + `300` text.
 */
const TONE_SHELL: Record<Exclude<StatusTone, 'neutral'>, string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-800 dark:border-transparent dark:bg-blue-500/15 dark:text-blue-300',
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-transparent dark:bg-emerald-500/15 dark:text-emerald-300',
  warning:
    'border-amber-300 bg-amber-50 text-amber-900 dark:border-transparent dark:bg-amber-500/15 dark:text-amber-300',
  danger:
    'border-red-200 bg-red-50 text-red-800 dark:border-transparent dark:bg-red-500/15 dark:text-red-300',
};

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
  const shell = tone === 'neutral' ? undefined : TONE_SHELL[tone];
  return (
    <ChipBase
      size={size}
      role="status"
      title={title}
      shell={shell}
      className={className}
      leading={hideDot ? undefined : <ChipDot colorVar={colorVar} size={size} />}
    >
      {label}
    </ChipBase>
  );
};

export default StatusChip;
