/**
 * NModeLayout — Type definitions
 *
 * Shared types for the N-Mode (page-first, 2-pane) detail view layout.
 * This is the standard layout for all artifact detail views:
 * Decision, Task, Notification, Initiative, and future artifacts.
 *
 * Layout structure:
 *   ┌──────────────────────────────────────────┐
 *   │  NModeHeader (title, save, chat, mode)   │
 *   ├──────────────────────────────────────────┤
 *   │  NModePropertiesStrip (fields row)       │
 *   │  NModeActionBar (Approve, Reject, ...)   │
 *   ├──────────┬───────────────────────────────┤
 *   │ LeftNav  │  Canvas (selected section)    │
 *   │ (220px)  │                               │
 *   │          │                               │
 *   └──────────┴───────────────────────────────┘
 *
 * @see docs/ui-standards/01-shell-layout/presentation-modes.md §2.5
 */

import type React from 'react';

// ── Section Definition ──────────────────────────────────────────────────────

export interface NModeSection {
  /** Unique section identifier (used as nav key and AnimatePresence key) */
  id: string;
  /** Lucide icon component */
  icon: React.FC<{ size?: number; className?: string }>;
  /** Bilingual label */
  label: { en: string; pl: string };
  /** Optional badge count (e.g. number of comments) */
  badge?: number;
  /** The section canvas content (rendered when active) */
  component: React.ReactNode;
}

// ── Property Field (PropertiesStrip) ────────────────────────────────────────

export type PropertyFieldType = 'select' | 'date' | 'text' | 'custom';

export interface PropertyFieldOption {
  value: string;
  label: { en: string; pl: string };
}

export interface NModePropertyField {
  /** Unique field identifier */
  id: string;
  /** Bilingual label */
  label: { en: string; pl: string };
  /** Field type */
  type: PropertyFieldType;
  /** Current value */
  value: string;
  /** Change handler */
  onChange: (value: string) => void;
  /** Options for select fields */
  options?: PropertyFieldOption[];
  /** Placeholder text */
  placeholder?: { en: string; pl: string };
  /** Optional alert border CSS class (e.g. for overdue dates) */
  alertBorderClass?: string;
  /** Whether field is read-only */
  readOnly?: boolean;
  /** Grid column span (default 1). Use 2 for wider fields like initiative name. */
  colSpan?: number;
  /** Custom render function (for type='custom') */
  render?: () => React.ReactNode;
}

// ── Action Button (ActionBar) ───────────────────────────────────────────────

export type ActionVariant = 'success' | 'danger' | 'neutral' | 'ai';

export interface NModeAction {
  /** Unique action identifier */
  id: string;
  /** Bilingual label */
  label: { en: string; pl: string };
  /** Lucide icon */
  icon: React.FC<{ size?: number; className?: string }>;
  /** Visual variant */
  variant: ActionVariant;
  /** Click handler */
  onClick: () => void;
  /** Whether action is disabled */
  disabled?: boolean;
  /** Whether action is loading */
  loading?: boolean;
  /** Optional tooltip */
  title?: { en: string; pl: string };
}

// ── AI Context Button ───────────────────────────────────────────────────────

export interface NModeAIContextAction {
  /** The section id this AI action appears for */
  sectionId: string;
  /** AI action definition */
  action: NModeAction;
}

// ── Header Configuration ────────────────────────────────────────────────────

export interface NModeHeaderConfig {
  /** Current title value */
  title: string;
  /** Title change handler */
  onTitleChange: (value: string) => void;
  /** Whether title is read-only */
  titleReadOnly?: boolean;
  /** Title placeholder */
  titlePlaceholder?: { en: string; pl: string };
  /** Artifact ID (e.g. "BEC-08877-BEC151") */
  artifactId?: string;
  /** Artifact type for permalink/code generation */
  artifactType: import('@/utils/artifactLinks').ArtifactType;
  /** Save handler */
  onSave: () => void;
  /** Whether save is in progress */
  saving?: boolean;
  /** Whether there are unsaved changes */
  isDirty?: boolean;
  /** Chat button handler (omit to hide) */
  onChat?: () => void;
  /** Back/close handler */
  onClose: () => void;
  /** Draft saved label text */
  draftSavedLabel?: string;
  /** Status dot color CSS class (e.g. 'bg-emerald-400') */
  statusDotColor?: string;
}

// ── Shell (top-level) Configuration ─────────────────────────────────────────

export interface NModeShellProps {
  /** Header configuration */
  header: NModeHeaderConfig;
  /** Property fields for the PropertiesStrip */
  properties: NModePropertyField[];
  /** Navigation sections with their canvas content */
  sections: NModeSection[];
  /** Primary action buttons (Approve, Reject, etc.) — shown when visible=true */
  actions?: NModeAction[];
  /** Whether the action bar is visible (e.g. only for pending decisions) */
  actionsVisible?: boolean;
  /** AI context actions — shown in action bar based on active section */
  aiContextActions?: NModeAIContextAction[];
  /**
   * Custom action bar renderer. When provided, replaces the standard
   * NModeActionBar with arbitrary content inside the same styled container.
   */
  renderActionBar?: () => React.ReactNode;
  /** Currently active section id */
  activeSection: string;
  /** Section change handler */
  onSectionChange: (sectionId: string) => void;
  /** Whether to use reduced motion */
  reducedMotion?: boolean;
  /** Custom motion duration (default: 0.22) */
  motionDuration?: number;
  /** Children rendered after the shell (modals, toasts, etc.) */
  children?: React.ReactNode;
}
