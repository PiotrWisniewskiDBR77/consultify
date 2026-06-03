/**
 * Menu3Row — canonical JSX shell for the Menu 3 command row.
 *
 * Hubs render a `flex items-center justify-between` row with preset chips on the
 * left and actions on the right. Historically ~23 hub sites hand-rebuilt this
 * structure with the raw MENU_3 class constants. This shell standardizes it:
 * pass `left` and `right` React nodes and the canonical inner wrapper +
 * left/right groupings are applied for you.
 *
 * Note: this is distinct from the `Menu3Row` exported by `ModuleMenu3.tsx`,
 * which takes a single `children` slot and also renders the outer row chrome.
 * This component renders ONLY the inner `MENU_3_INNER_CLASS` row, matching the
 * shape that hubs pass into `commandRowContent`.
 */

import React from 'react';

import {
  MENU_3_INNER_CLASS,
  MENU_3_LEFT_CLASS,
  MENU_3_RIGHT_CLASS,
} from '@/components/shared/ModuleMenu3';
import { cn } from '@/utils/cn';

export interface Menu3RowProps {
  /** Left-aligned content (typically preset filter chips). */
  left?: React.ReactNode;
  /** Right-aligned content (typically AI / primary actions). */
  right?: React.ReactNode;
  /** Extra classes merged onto the inner flex row. */
  className?: string;
  /** Extra classes merged onto the left group. */
  leftClassName?: string;
  /** Extra classes merged onto the right group. */
  rightClassName?: string;
}

export const Menu3Row: React.FC<Menu3RowProps> = ({
  left,
  right,
  className,
  leftClassName,
  rightClassName,
}) => {
  return (
    <div className={cn(MENU_3_INNER_CLASS, className)}>
      <div className={cn(MENU_3_LEFT_CLASS, leftClassName)}>{left}</div>
      <div className={cn(MENU_3_RIGHT_CLASS, rightClassName)}>{right}</div>
    </div>
  );
};

export default Menu3Row;
