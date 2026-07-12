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
 *   │ (242px)  │                               │
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
  /**
   * Adaptive sidebar (#22): when explicitly `false`, the section is treated as
   * empty and hidden from the nav unless `alwaysShow` is set or the user flips
   * "Show all sections". Leave undefined to always show (back-compat default).
   */
  hasData?: boolean;
  /** Always render in the nav even when `hasData === false` (e.g. Summary). */
  alwaysShow?: boolean;
  /**
   * Optional group label for the sidebar (#22b). When any section sets a group,
   * the (non-reorderable) nav renders grouped headers instead of a flat list —
   * e.g. INSIGHT / BETWEEN THE LINES / EVIDENCE / DELIVERABLES / AUDIT.
   */
  group?: string;
  /**
   * Standard-C (ClickUp board) column span, 1–3 (default 1). Heavy sections
   * whose content has internal columns or wide tables (e.g. an executive
   * summary or a multi-column readout) should set 2 or 3 so they breathe in the
   * dense 3-column grid. Ignored by N-mode. */
  cSpan?: 1 | 2 | 3;
  /**
   * Standard-C (ClickUp board) ONLY: when true, this section is hidden from the
   * dense board (e.g. an empty count-bearing section that would otherwise render
   * a full empty-state panel and leave a gap). The N-mode left-nav/canvas ignore
   * this flag, so the section stays reachable there — keeping N-mode behaviour
   * unchanged. Distinct from `hasData`, which affects BOTH modes. */
  cHidden?: boolean;
  /**
   * Mark Complete — AI signal only. When true the section header in
   * NModeSectionWrapper shows a success tint, and the nav item shows a ✓ badge.
   * Fields remain fully editable (this is a read/review signal, not a lock).
   * Value is persisted in `section_completions JSONB` on the artifact row.
   */
  completed?: boolean;
  /**
   * Evidence requirement level for this section (canon §B4 "Wymóg dowodu").
   * Drives the amber "Brak dowodów" badge in NModeSectionWrapper when the
   * requirement is not met. Client-side metadata only — not persisted to DB.
   *
   *   NONE         — no evidence requirement (default)
   *   EACH_ITEM    — every item in the section must have ≥1 citation
   *   STRONG_ITEMS — items with severity=high must have ≥2 citations from distinct sessions
   */
  quoteRequirementLevel?: 'NONE' | 'EACH_ITEM' | 'STRONG_ITEMS';
  /**
   * Per-section export contract (canon "Eksport" field). Declares which export
   * destinations this section feeds and how it renders into each. Consumed by
   * the Smart Export pipeline; when omitted, a section is treated as
   * markdown-exportable only (back-compat default).
   *
   *   markdown — included in the .md / clipboard export
   *   slide    — rendered as a presentation slide (cSpan drives the layout)
   *   pdf      — included in the print/PDF export
   *   renderer — optional id of a custom slide/pdf renderer for this section
   */
  eksport?: {
    markdown?: boolean;
    slide?: boolean;
    pdf?: boolean;
    renderer?: string;
  };
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

// ── Header Primary CTA (M1 §Menu 1 artefaktu — jeden primary) ──────────────
// SSOT: Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md §299 — "M1 …
// PRIMARY: zależny (Idea: „Konwertuj na inicjatywę"; Tool: „Generuj
// inicjatywy"; Report-gen: „Generuj")". Optional + backward-compatible: omit
// to keep the header exactly as before (Task/Decision/etc. unaffected).

export interface NModeHeaderPrimaryAction {
  /** Bilingual label */
  label: { en: string; pl: string };
  /** Lucide icon (optional) */
  icon?: React.FC<{ size?: number; className?: string }>;
  /** Click handler */
  onClick: () => void;
  /** Whether the action is disabled */
  disabled?: boolean;
  /** Optional tooltip override */
  title?: { en: string; pl: string };
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
  /** Explicit persistence state. This is separate from lifecycle/governance status. */
  saveState?: 'saved' | 'saving' | 'dirty' | 'error';
  /** Optional label shown for the latest successful persistence read-back. */
  lastSavedLabel?: string;
  /** Whether there are unsaved changes */
  isDirty?: boolean;
  /** Chat button handler (omit to hide) */
  onChat?: () => void;
  /**
   * #27/#37: render the AI (onChat) button in the header top-right, next to
   * Save/mode-switcher. Opt-in and scoped per consumer — back-compat default
   * is `false` so existing headers that already pass `onChat` (Notification,
   * Initiative, Insight) keep their current look unchanged. Task/Decision set
   * this explicitly (klasa S has no M3 slot, so the header is the cheap home
   * for the single AI action instead of the right-panel Actions section).
   */
  showChatButton?: boolean;
  /** Back/close handler */
  onClose: () => void;
  /** Deprecated: lifecycle/governance label. Do not use for persistence state. */
  draftSavedLabel?: string;
  /** Status dot color CSS class (e.g. 'bg-emerald-400') */
  statusDotColor?: string;
  /**
   * SPEC-A M1 primary CTA — ONE action rendered at the right edge of the
   * header (e.g. Insight: "Convert to initiative"). Omit to keep the header
   * unchanged (back-compat default for Task/Decision/other consumers).
   */
  primaryAction?: NModeHeaderPrimaryAction;
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
   * Tool-level AI actions — whole-artifact AI, always visible in the action bar
   * regardless of active section (vs. aiContextActions which are section-scoped).
   * Part of the 3-level AI model: tool / section / field.
   */
  toolAIActions?: NModeAction[];
  /**
   * Custom action bar renderer. When provided, replaces the standard
   * NModeActionBar with arbitrary content inside the same styled container.
   */
  renderActionBar?: () => React.ReactNode;
  /** Currently active section id */
  activeSection: string;
  /** Section change handler */
  onSectionChange: (sectionId: string) => void;
  /**
   * Optional reorder handler. When provided, the left-nav becomes drag-reorderable
   * (within each group when sections are grouped). Receives the full new section-id
   * order. Omit to keep the nav static. Ignored in C-mode (the dense board has its
   * own fixed group order).
   */
  onSectionReorder?: (sectionIds: string[]) => void;
  /** Whether to use reduced motion */
  reducedMotion?: boolean;
  /** Custom motion duration (default: 0.22) */
  motionDuration?: number;
  /** Children rendered after the shell (modals, toasts, etc.) */
  children?: React.ReactNode;
}
