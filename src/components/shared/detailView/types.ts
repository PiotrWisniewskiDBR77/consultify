/**
 * Shared DetailView canon — types
 *
 * Canonical detail-view primitives for the platform's heavy artifacts
 * (Insight, Initiative, and future Task/Decision/Report detail views).
 *
 * Source of the standard: the Initiative document view (the most polished
 * card in the platform — owner invested dozens of hours). These primitives
 * generalize that pattern so every artifact detail view shares one look.
 *
 * See: docs/audit/2026-06-05/_IV_MODULE_MASTER_PLAN.md §7 (card standard)
 */

import type { ReactNode } from 'react';

/** Notion-style (sidebar, sequential) vs ClickUp-style (dense, all-in-one). */
export type DetailViewMode = 'notion' | 'clickup';

/**
 * AI assist granularity — the three levels of AI support (owner principle):
 *  - tool:    whole artifact (toolbar) — regenerate everything, run analysis
 *  - section: a single card/section — regenerate this section, improve
 *  - field:   a single field/column/cell within a card — improve this value
 * See master plan §6.
 */
export type AIAssistLevel = 'tool' | 'section' | 'field';

/** Semantic tone for a metric value / pill. Maps to the SSOT status palette. */
export type MetricTone = 'neutral' | 'info' | 'pending' | 'success' | 'warning' | 'danger';

/** A single metric in the top metric strip. */
export interface MetricItem {
  /** Stable key (used for React keys + persistence). */
  key: string;
  /** Short uppercase label, e.g. "STATUS", "SESSIONS", "NEXT GATE". */
  label: string;
  /** The rendered value. String/number for plain text; ReactNode for pills/custom. */
  value: ReactNode;
  /** Optional semantic tone — renders the value as a colored pill when set. */
  tone?: MetricTone;
  /**
   * Whether this metric is editable. When true, `onEdit` is wired and the cell
   * shows an affordance (dropdown/caret). Editability is owned by the backend
   * capabilities layer (e.g. gate-readiness-check) — the caller decides.
   */
  editable?: boolean;
  /** Invoked when an editable metric is activated. */
  onEdit?: () => void;
  /** Optional hint shown on hover (e.g. why a field is read-only). */
  hint?: string;
  /** Force a wider cell for long values (e.g. owner name + avatar). */
  wide?: boolean;
}
