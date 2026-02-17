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
 * - NModeLeftNav      — Section navigation rail (220px)
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
export { NModeCanvas } from './NModeCanvas';
export { NModeHeader } from './NModeHeader';
export { NModeLeftNav } from './NModeLeftNav';
export { NModePropertiesStrip } from './NModePropertiesStrip';
export { NModeSectionWrapper } from './NModeSectionWrapper';
export { NModeShell } from './NModeShell';

// ── Types ───────────────────────────────────────────────────────────────────
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
