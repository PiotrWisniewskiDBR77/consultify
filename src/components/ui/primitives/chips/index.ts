/**
 * Canonical chip / badge primitives.
 *
 * One self-contained system that replaces hand-rolled `inline-flex
 * rounded-full px-2 py-0.5 …` chip spans across the app. All chips share a
 * single shell (`ChipBase`) built on the semantic `c.*` palette, so they
 * are token-driven, light/dark-aware, and visually consistent per
 * docs/ui-standards/03-modules/module-hub-standard.md §3.3 + §N.
 *
 * NOTE: intentionally NOT re-exported from the big primitives/ui barrels —
 * those are wired separately to avoid merge churn.
 */

export { categoryTone } from './categoryTone';
export {
  CHIP_ICON_PX,
  CHIP_TONE_VAR,
  ChipBase,
  type ChipBaseProps,
  ChipDot,
  type ChipSize,
  type ChipTone,
} from './chipBase';
export { deriveDueRisk, DueChip, type DueChipProps, type DueRisk } from './DueChip';
export {
  EntityStatusChip,
  type EntityStatusChipProps,
  statusChipLabel,
  statusChipTone,
} from './EntityStatusChip';
export { MetaChip, type MetaChipProps } from './MetaChip';
export { PriorityChip, type PriorityChipProps, type PriorityLevel } from './PriorityChip';
export { StatusChip, type StatusChipProps, type StatusTone } from './StatusChip';
export { ToolChip, type ToolChipProps } from './ToolChip';
