/**
 * Consultify Execution-module UI/UX Standard — Reference manifests
 * (Epic E11, Slice 11.2).
 *
 * Three frozen, system-owned manifests that model the canonical
 * implementations referenced by the SSOT
 * (DRD/UI_UX_SOURCE_OF_TRUTH.md §"Standard Modułów Wykonawczych"):
 *
 *   - `deck-builder` — the reference module (the standard was
 *     originally extracted from this surface). Status `'reference'`.
 *   - `doc-builder` — Document Studio's consultant-facing UI; its
 *     unit kind is "section" and the primary CTA is `Eksportuj`.
 *     Status `'reference'` (the data plane shipped end-to-end across
 *     E1..E10; the React surface MUST conform to this manifest).
 *   - `excel-builder` — Excel Builder; its unit kind is "sheet" and
 *     the primary CTA is `Eksportuj`. Status `'reference'`.
 *
 * Every manifest declares the full canonical chip set as `present`
 * (run's label is module-local — `Prezentuj` for Deck,
 * `Eksportuj` for Doc / Excel) so each one validates clean against
 * the standard with zero `should` violations.
 *
 * The frontend MAY shadow these manifests for tenant-specific
 * customisation (different unit-kind labels / hidden chips); the
 * validator surfaces hidden chips as `should` violations rather
 * than `must` so tenant overrides do not break release.
 */

import type { ExecutionModuleId, ExecutionModuleManifest } from './executionModuleStandardTypes.js';

const FROZEN_RIGHT_PANEL = Object.freeze({
  collapseTriggerPosition: 'top_left_seam',
  collapseTriggerStyle: 'soft_chevron',
  collapsedWidthPx: 32,
  expandedWidthMinPx: 280,
  expandedWidthMaxPx: 360,
  persistence: 'per_user_per_module',
  parallelPanelsAllowed: false,
}) as ExecutionModuleManifest['rightPanel'];

function buildCanonicalMenu2Chips(ctaLabel: 'Prezentuj' | 'Eksportuj') {
  return Object.freeze([
    Object.freeze({ chipId: 'internal', present: true }),
    Object.freeze({ chipId: 'theme', present: true }),
    Object.freeze({ chipId: 'history', present: true }),
    Object.freeze({ chipId: 'qa', present: true }),
    Object.freeze({ chipId: 'governance', present: true }),
    Object.freeze({ chipId: 'analytics', present: true }),
    Object.freeze({ chipId: 'audit', present: true }),
    Object.freeze({ chipId: 'share', present: true }),
    Object.freeze({ chipId: 'agent', present: true }),
    Object.freeze({ chipId: 'run', present: true, ctaLabel }),
  ]) as ExecutionModuleManifest['menu2Chips'];
}

// =============================================================================
// Doc Builder — section unit, Eksportuj CTA
// =============================================================================

export const DOC_BUILDER_MANIFEST: ExecutionModuleManifest = Object.freeze({
  moduleId: 'doc-builder',
  label: 'Document Studio (Doc Builder)',
  status: 'reference',
  description:
    'Consultant-facing document authoring surface. Unit of work is a document section. ' +
    'Primary CTA is "Eksportuj" (Markdown / DOCX / PDF). Backed by the Document Studio ' +
    'service stack delivered across Epics E1..E10.',
  zones: Object.freeze([
    Object.freeze({ zoneId: 'leftNav', label: 'Sekcje', unitKindLabel: 'Sekcja' }),
    Object.freeze({ zoneId: 'canvas', label: 'Kanwa sekcji', unitKindLabel: 'Sekcja (WYSIWYG)' }),
    Object.freeze({
      zoneId: 'rightPanel',
      label: 'Panel funkcji kontekstowych',
      unitKindLabel: 'Funkcje per sekcja',
    }),
  ]) as ExecutionModuleManifest['zones'],
  menu2Chips: buildCanonicalMenu2Chips('Eksportuj'),
  rightPanel: FROZEN_RIGHT_PANEL,
  agent: Object.freeze({
    exposedAgentIds: Object.freeze(['teresa']),
    teresaSurface: 'drawer',
    contextAwareOn: 'section',
  }) as ExecutionModuleManifest['agent'],
  aiActions: Object.freeze({
    slot: 'commandRowRightContent',
    actionIds: Object.freeze([
      'ai.refine_section',
      'ai.run_qa',
      'ai.suggest_brand_voice',
      'ai.render_audience_variant',
      'ai.request_approval',
      'ai.insert_from_library',
    ]),
    duplicatedInCanvas: false,
  }) as ExecutionModuleManifest['aiActions'],
}) as ExecutionModuleManifest;

// =============================================================================
// Deck Builder — slide unit, Prezentuj CTA (the reference module)
// =============================================================================

export const DECK_BUILDER_MANIFEST: ExecutionModuleManifest = Object.freeze({
  moduleId: 'deck-builder',
  label: 'Deck Builder',
  status: 'reference',
  description:
    'Reference execution module — the canonical implementation the SSOT was extracted ' +
    'from. Unit of work is a slide. Primary CTA is "Prezentuj".',
  zones: Object.freeze([
    Object.freeze({ zoneId: 'leftNav', label: 'Slajdy', unitKindLabel: 'Slajd' }),
    Object.freeze({ zoneId: 'canvas', label: 'Kanwa slajdu', unitKindLabel: 'Slajd (WYSIWYG)' }),
    Object.freeze({
      zoneId: 'rightPanel',
      label: 'Panel funkcji kontekstowych',
      unitKindLabel: 'Funkcje per slajd',
    }),
  ]) as ExecutionModuleManifest['zones'],
  menu2Chips: buildCanonicalMenu2Chips('Prezentuj'),
  rightPanel: FROZEN_RIGHT_PANEL,
  agent: Object.freeze({
    exposedAgentIds: Object.freeze(['teresa']),
    teresaSurface: 'drawer',
    contextAwareOn: 'slide',
  }) as ExecutionModuleManifest['agent'],
  aiActions: Object.freeze({
    slot: 'commandRowRightContent',
    actionIds: Object.freeze([
      'ai.regenerate_slide',
      'ai.apply_layout',
      'ai.refine_speaker_notes',
      'ai.run_qa',
    ]),
    duplicatedInCanvas: false,
  }) as ExecutionModuleManifest['aiActions'],
}) as ExecutionModuleManifest;

// =============================================================================
// Excel Builder — sheet unit, Eksportuj CTA
// =============================================================================

export const EXCEL_BUILDER_MANIFEST: ExecutionModuleManifest = Object.freeze({
  moduleId: 'excel-builder',
  label: 'Excel Builder',
  status: 'reference',
  description:
    'Reference execution module for spreadsheet authoring. Unit of work is a sheet. ' +
    'Primary CTA is "Eksportuj" (XLSX / CSV).',
  zones: Object.freeze([
    Object.freeze({ zoneId: 'leftNav', label: 'Arkusze', unitKindLabel: 'Arkusz' }),
    Object.freeze({ zoneId: 'canvas', label: 'Kanwa arkusza', unitKindLabel: 'Arkusz (siatka)' }),
    Object.freeze({
      zoneId: 'rightPanel',
      label: 'Panel funkcji kontekstowych',
      unitKindLabel: 'Funkcje per arkusz',
    }),
  ]) as ExecutionModuleManifest['zones'],
  menu2Chips: buildCanonicalMenu2Chips('Eksportuj'),
  rightPanel: FROZEN_RIGHT_PANEL,
  agent: Object.freeze({
    exposedAgentIds: Object.freeze(['teresa']),
    teresaSurface: 'drawer',
    contextAwareOn: 'sheet',
  }) as ExecutionModuleManifest['agent'],
  aiActions: Object.freeze({
    slot: 'commandRowRightContent',
    actionIds: Object.freeze([
      'ai.summarize_sheet',
      'ai.suggest_formula',
      'ai.detect_anomalies',
      'ai.run_qa',
    ]),
    duplicatedInCanvas: false,
  }) as ExecutionModuleManifest['aiActions'],
}) as ExecutionModuleManifest;

// =============================================================================
// Registry
// =============================================================================

export const SYSTEM_EXECUTION_MODULE_MANIFESTS: ReadonlyArray<ExecutionModuleManifest> =
  Object.freeze([
    DOC_BUILDER_MANIFEST,
    DECK_BUILDER_MANIFEST,
    EXCEL_BUILDER_MANIFEST,
  ]) as ReadonlyArray<ExecutionModuleManifest>;

const MANIFEST_INDEX = new Map<ExecutionModuleId, ExecutionModuleManifest>(
  SYSTEM_EXECUTION_MODULE_MANIFESTS.map((m) => [m.moduleId, m])
);

export function getSystemExecutionModuleManifest(
  moduleId: ExecutionModuleId
): ExecutionModuleManifest | null {
  return MANIFEST_INDEX.get(moduleId) ?? null;
}

export function isSystemExecutionModuleId(moduleId: ExecutionModuleId): boolean {
  return MANIFEST_INDEX.has(moduleId);
}
