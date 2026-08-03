/**
 * NModeLayout — Standard layout kit for N-mode artifact detail views
 *
 * This module provides the complete layout infrastructure for the N-mode
 * (page-first, 2-pane) detail view, which is the PRIMARY standard for all
 * artifact types: Decision, Task, Notification, Initiative, and future artifacts.
 *
 * Components:
 * - NModeShell        — Top-level layout composer
 * - NModeHeader       — Title bar with save, chat, primary CTA
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
export type { FieldAIButtonProps } from './FieldAIButton';
export { FieldAIButton } from './FieldAIButton';
export { NModeActionBar } from './NModeActionBar';
export { NModeCanvas } from './NModeCanvas';
export type { NModeCardStateProps, NModeCardStatus } from './NModeCardState';
export { NModeCardBadge, NModeCardState } from './NModeCardState';
export { NModeCBoard } from './NModeCBoard';
export type { NModeContentBlockProps } from './NModeContentBlock';
export { NModeContentBlock } from './NModeContentBlock';
export { NModeHeader } from './NModeHeader';
export { NModeLeftNav } from './NModeLeftNav';
// ── Menu 2 (ETAP 1.2 standardu n-Type) ──────────────────────────────────────
export type {
  Menu2AIButtonProps,
  Menu2HowToButtonProps,
  Menu2ModeToggleProps,
  NModeMenu2Props,
} from './NModeMenu2';
export { Menu2AIButton, Menu2HowToButton, Menu2ModeToggle, NModeMenu2 } from './NModeMenu2';
// ── „Analizuj z AI" (ETAP 3 standardu n-Type) ───────────────────────────────
// Panel wyników + szew stanu. Silnik (rubryka, prompt, wywołanie LLM) mieszka
// w `src/services/cardAnalysis` — powłoka go tylko konsumuje.
export type { NCardAIAnalysisPanelProps } from './NCardAIAnalysisPanel';
export { NCardAIAnalysisPanel } from './NCardAIAnalysisPanel';
export { NModePropertiesStrip } from './NModePropertiesStrip';
export type { QuoteRequirementLevel } from './NModeSectionWrapper';
export { EvidenceBadge, NModeSectionWrapper } from './NModeSectionWrapper';
export type { UseCardAIAnalysisOptions, UseCardAIAnalysisResult } from './useCardAIAnalysis';
export { useCardAIAnalysis } from './useCardAIAnalysis';
// ── Card management (wzorzec N §3.5) ────────────────────────────────────────
export type { ArtifactCardSpec, CardCatalogEntry, CardSet, NModeArtifactType } from './cardSets';
export { DEFAULT_CARD_SETS, getCardSpec } from './cardSets';
export type {
  AddCardMenuProps,
  NModeCardManagerProps,
  SectionsManagerMenuProps,
} from './NModeCardManager';
export { AddCardMenu, NModeCardManager, SectionsManagerMenu } from './NModeCardManager';
export { NMODE_TOOLBAR_SHELL_CLASS, NModeShell } from './NModeShell';
export {
  NModeToolbar,
  ToolbarAISolidButton,
  ToolbarAISplitButton,
  ToolbarGhostButton,
  ToolbarIconButton,
  ToolbarSubtleButton,
} from './NModeToolbar';
export { SummaryCard } from './SummaryCard';
export type {
  CardLayout,
  CardLayoutItem,
  UseCardLayoutOptions,
  UseCardLayoutResult,
} from './useCardLayout';
export { useCardLayout } from './useCardLayout';

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
