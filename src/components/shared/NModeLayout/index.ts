/**
 * NModeLayout — Standard layout kit for N-mode artifact detail views
 *
 * This module provides the complete layout infrastructure for the N-mode
 * (page-first, 2-pane) detail view, which is the PRIMARY standard for all
 * artifact types: Decision, Task, Notification, Initiative, and future artifacts.
 *
 * Components:
 * - NModeShell        — Top-level layout composer
 * - NModeHeader       — Title bar with save, chat, mode switcher
 * - NModePropertiesStrip — Full-width property fields row
 * - NModeActionBar    — Primary + contextual AI action buttons
 * - NModeLeftNav      — Section navigation rail (242px)
 * - NModeCanvas       — Animated section content area
 * - NModeSectionWrapper — Utility wrapper for section content
 *
 * Types:
 * - NModeSection, NModePropertyField, NModeAction, NModeAIContextAction
 * - NModeHeaderConfig, NModeShellProps, ActionVariant, PropertyFieldType
 *
 * Usage:
 * ```tsx
 * import { NModeShell, type NModeSection, type NModePropertyField } from '@/components/shared/NModeLayout';
 * ```
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md
 */

// ── Layout Components ───────────────────────────────────────────────────────
export { NModeActionBar } from './NModeActionBar';
export { FieldAIButton } from './FieldAIButton';
export type { FieldAIButtonProps } from './FieldAIButton';
export { NModeCanvas } from './NModeCanvas';
export { NModeCBoard } from './NModeCBoard';
export { NModeHeader } from './NModeHeader';
export { NModeLeftNav } from './NModeLeftNav';
export { NModePropertiesStrip } from './NModePropertiesStrip';
export { EvidenceBadge, NModeSectionWrapper } from './NModeSectionWrapper';
export type { QuoteRequirementLevel } from './NModeSectionWrapper';
export { NModeCardState, NModeCardBadge } from './NModeCardState';
export type { NModeCardStatus, NModeCardStateProps } from './NModeCardState';
// ── Card management (wzorzec N §3.5) ────────────────────────────────────────
export { useCardLayout } from './useCardLayout';
export type {
  CardLayout,
  CardLayoutItem,
  UseCardLayoutOptions,
  UseCardLayoutResult,
} from './useCardLayout';
export {
  NModeCardManager,
  AddCardMenu,
  SectionsManagerMenu,
} from './NModeCardManager';
export type {
  NModeCardManagerProps,
  AddCardMenuProps,
  SectionsManagerMenuProps,
} from './NModeCardManager';
export { DEFAULT_CARD_SETS, getCardSpec } from './cardSets';
export type {
  NModeArtifactType,
  CardCatalogEntry,
  CardSet,
  ArtifactCardSpec,
} from './cardSets';
export { NModeShell, NMODE_TOOLBAR_SHELL_CLASS } from './NModeShell';
export {
  NModeToolbar,
  ToolbarAISolidButton,
  ToolbarAISplitButton,
  ToolbarGhostButton,
  ToolbarIconButton,
  ToolbarSubtleButton,
} from './NModeToolbar';
export { SummaryCard } from './SummaryCard';

// ── Types ───────────────────────────────────────────────────────────────────
export type { NModeToolbarProps } from './NModeToolbar';
export type { SummaryCardMetric, SummaryCardMetricTone, SummaryCardProps } from './SummaryCard';
export type {
  ActionVariant,
  NModeAction,
  NModeAIContextAction,
  NModeHeaderConfig,
  NModePropertyField,
  NModeSection,
  NModeShellProps,
  PropertyFieldOption,
  PropertyFieldType,
} from './types';
