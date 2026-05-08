/**
 * Execution-module UI/UX Standard — Reference manifest conformance tests
 * (Epic E11, Slice 11.2).
 *
 * Each of the three reference manifests (`doc-builder`,
 * `deck-builder`, `excel-builder`) MUST validate clean against the
 * canonical standard with:
 *
 *   - zero `must` violations,
 *   - zero `should` violations (every canonical Menu 2 chip
 *     present, no pending_migration AI slots).
 *
 * Plus per-module structural assertions:
 *
 *   - moduleId is the documented value;
 *   - run chip carries the module-specific label
 *     (Prezentuj for Deck, Eksportuj for Doc / Excel);
 *   - agent surface is teresa-only;
 *   - registry helpers (`getSystemExecutionModuleManifest`,
 *     `isSystemExecutionModuleId`) round-trip cleanly.
 *
 * Aggregate `validateAllManifests` over the registry must return
 * `ok: true`.
 */

import { describe, expect, it } from 'vitest';

import {
  validateAllManifests,
  validateExecutionModuleManifest,
} from '../executionModuleStandard.js';
import {
  DECK_BUILDER_MANIFEST,
  DOC_BUILDER_MANIFEST,
  EXCEL_BUILDER_MANIFEST,
  getSystemExecutionModuleManifest,
  isSystemExecutionModuleId,
  SYSTEM_EXECUTION_MODULE_MANIFESTS,
} from '../executionModuleStandardManifests.js';

describe('reference manifests — structural identity', () => {
  it('doc-builder uses Eksportuj CTA + section unit + teresa drawer', () => {
    expect(DOC_BUILDER_MANIFEST.moduleId).toBe('doc-builder');
    expect(DOC_BUILDER_MANIFEST.status).toBe('reference');
    const cta = DOC_BUILDER_MANIFEST.menu2Chips.find((c) => c.chipId === 'run');
    expect(cta?.ctaLabel).toBe('Eksportuj');
    expect(DOC_BUILDER_MANIFEST.agent.exposedAgentIds).toEqual(['teresa']);
    expect(DOC_BUILDER_MANIFEST.agent.teresaSurface).toBe('drawer');
    expect(DOC_BUILDER_MANIFEST.agent.contextAwareOn).toBe('section');
  });

  it('deck-builder uses Prezentuj CTA + slide unit + teresa drawer', () => {
    expect(DECK_BUILDER_MANIFEST.moduleId).toBe('deck-builder');
    const cta = DECK_BUILDER_MANIFEST.menu2Chips.find((c) => c.chipId === 'run');
    expect(cta?.ctaLabel).toBe('Prezentuj');
    expect(DECK_BUILDER_MANIFEST.agent.contextAwareOn).toBe('slide');
  });

  it('excel-builder uses Eksportuj CTA + sheet unit + teresa drawer', () => {
    expect(EXCEL_BUILDER_MANIFEST.moduleId).toBe('excel-builder');
    const cta = EXCEL_BUILDER_MANIFEST.menu2Chips.find((c) => c.chipId === 'run');
    expect(cta?.ctaLabel).toBe('Eksportuj');
    expect(EXCEL_BUILDER_MANIFEST.agent.contextAwareOn).toBe('sheet');
  });

  it('every reference manifest declares all 10 canonical chips as present (MELS-aligned)', () => {
    const expected = [
      'internal',
      'theme',
      'history',
      'qa',
      'governance',
      'analytics',
      'audit',
      'share',
      'agent',
      'run',
    ];
    for (const manifest of [DOC_BUILDER_MANIFEST, DECK_BUILDER_MANIFEST, EXCEL_BUILDER_MANIFEST]) {
      const ids = manifest.menu2Chips.map((c) => c.chipId);
      expect(ids).toEqual(expected);
      expect(manifest.menu2Chips.every((c) => c.present)).toBe(true);
    }
  });

  it('every reference manifest declares the canonical right-panel collapse contract', () => {
    for (const manifest of [DOC_BUILDER_MANIFEST, DECK_BUILDER_MANIFEST, EXCEL_BUILDER_MANIFEST]) {
      expect(manifest.rightPanel.collapseTriggerPosition).toBe('top_left_seam');
      expect(manifest.rightPanel.collapseTriggerStyle).toBe('soft_chevron');
      expect(manifest.rightPanel.collapsedWidthPx).toBe(32);
      expect(manifest.rightPanel.expandedWidthMinPx).toBeGreaterThanOrEqual(280);
      expect(manifest.rightPanel.expandedWidthMaxPx).toBeLessThanOrEqual(360);
      expect(manifest.rightPanel.persistence).toBe('per_user_per_module');
      expect(manifest.rightPanel.parallelPanelsAllowed).toBe(false);
    }
  });

  it('AI actions slot is the canonical Menu 3 right slot with no canvas duplication', () => {
    for (const manifest of [DOC_BUILDER_MANIFEST, DECK_BUILDER_MANIFEST, EXCEL_BUILDER_MANIFEST]) {
      expect(manifest.aiActions.slot).toBe('commandRowRightContent');
      expect(manifest.aiActions.duplicatedInCanvas).toBe(false);
      expect(manifest.aiActions.actionIds.length).toBeGreaterThan(0);
      const seen = new Set<string>();
      for (const id of manifest.aiActions.actionIds) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
    }
  });

  it('every reference manifest is frozen (immutable)', () => {
    for (const manifest of [DOC_BUILDER_MANIFEST, DECK_BUILDER_MANIFEST, EXCEL_BUILDER_MANIFEST]) {
      expect(Object.isFrozen(manifest)).toBe(true);
      expect(Object.isFrozen(manifest.menu2Chips)).toBe(true);
      expect(Object.isFrozen(manifest.zones)).toBe(true);
    }
  });
});

describe('reference manifests — validator conformance', () => {
  it.each([DOC_BUILDER_MANIFEST, DECK_BUILDER_MANIFEST, EXCEL_BUILDER_MANIFEST])(
    'manifest %#: zero must + zero should violations',
    (manifest) => {
      const result = validateExecutionModuleManifest(manifest);
      expect(result.ok).toBe(true);
      expect(result.mustViolations).toEqual([]);
      expect(result.shouldViolations).toEqual([]);
    }
  );

  it('aggregate validateAllManifests over the registry returns ok=true', () => {
    const aggregate = validateAllManifests(SYSTEM_EXECUTION_MODULE_MANIFESTS);
    expect(aggregate.ok).toBe(true);
    expect(aggregate.results).toHaveLength(3);
    for (const r of aggregate.results) {
      expect(r.ok).toBe(true);
    }
  });
});

describe('registry helpers', () => {
  it('SYSTEM_EXECUTION_MODULE_MANIFESTS contains exactly the three reference modules', () => {
    expect(SYSTEM_EXECUTION_MODULE_MANIFESTS.map((m) => m.moduleId)).toEqual([
      'doc-builder',
      'deck-builder',
      'excel-builder',
    ]);
    expect(Object.isFrozen(SYSTEM_EXECUTION_MODULE_MANIFESTS)).toBe(true);
  });

  it('getSystemExecutionModuleManifest returns each reference module by id', () => {
    expect(getSystemExecutionModuleManifest('doc-builder')).toBe(DOC_BUILDER_MANIFEST);
    expect(getSystemExecutionModuleManifest('deck-builder')).toBe(DECK_BUILDER_MANIFEST);
    expect(getSystemExecutionModuleManifest('excel-builder')).toBe(EXCEL_BUILDER_MANIFEST);
  });

  it('getSystemExecutionModuleManifest returns null for unknown ids', () => {
    expect(getSystemExecutionModuleManifest('whiteboard-builder')).toBeNull();
  });

  it('isSystemExecutionModuleId is a thin id check', () => {
    expect(isSystemExecutionModuleId('doc-builder')).toBe(true);
    expect(isSystemExecutionModuleId('whiteboard-builder')).toBe(false);
  });
});
