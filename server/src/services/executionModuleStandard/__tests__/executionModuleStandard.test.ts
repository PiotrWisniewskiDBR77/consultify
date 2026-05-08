/**
 * Execution-module UI/UX Standard — validator tests (Epic E11, Slice 11.1).
 *
 * Covers the canonical constants and the per-dimension validator
 * branches:
 *
 *   - layout: zone count + zone order;
 *   - menu2: canonical chip ordering, unknown id, duplicate id,
 *     CTA label requirement, hidden chip soft signal;
 *   - rightPanel: every contract field (trigger position / style /
 *     widths / persistence / parallel-panels prohibition);
 *   - agent: empty list, disallowed agent id, missing teresa,
 *     invalid surface;
 *   - aiActions: invalid slot, pending_migration with + without
 *     justification, duplicated-in-canvas, action id validation;
 *   - aggregate validateAllManifests.
 *
 * No I/O — every test exercises the pure functions directly.
 */

import { describe, expect, it } from 'vitest';

import {
  EXECUTION_MODULE_ALLOWED_AGENT_IDS,
  EXECUTION_MODULE_ALLOWED_AI_ACTION_SLOTS,
  EXECUTION_MODULE_MENU2_CHIP_ORDER,
  EXECUTION_MODULE_RIGHT_PANEL_COLLAPSE_CONTRACT,
  EXECUTION_MODULE_ZONE_ORDER,
  EXECUTION_MODULE_ZONES,
  validateAllManifests,
  validateExecutionModuleManifest,
} from '../executionModuleStandard.js';
import type { ExecutionModuleManifest } from '../executionModuleStandardTypes.js';

function makeBaselineManifest(
  overrides: Partial<ExecutionModuleManifest> = {},
): ExecutionModuleManifest {
  const baseline: ExecutionModuleManifest = {
    moduleId: 'doc-builder',
    label: 'Document Studio (Doc Builder)',
    status: 'reference',
    description: 'Reference manifest for the doc-builder.',
    zones: [
      { zoneId: 'leftNav', unitKindLabel: 'Sekcje' },
      { zoneId: 'canvas', unitKindLabel: 'Kanwa sekcji' },
      { zoneId: 'rightPanel', unitKindLabel: 'Panel funkcji' },
    ],
    menu2Chips: [
      { chipId: 'internal', present: true },
      { chipId: 'motyw', present: true },
      { chipId: 'history', present: true },
      { chipId: 'qa', present: true },
      { chipId: 'governance', present: true },
      { chipId: 'analytics', present: true },
      { chipId: 'audit', present: true },
      { chipId: 'udostepnij', present: true },
      { chipId: 'agent', present: true },
      { chipId: 'cta_primary', present: true, ctaLabel: 'Eksportuj' },
    ],
    rightPanel: {
      collapseTriggerPosition: 'top_left_seam',
      collapseTriggerStyle: 'soft_chevron',
      collapsedWidthPx: 32,
      expandedWidthMinPx: 280,
      expandedWidthMaxPx: 360,
      persistence: 'per_user_per_module',
      parallelPanelsAllowed: false,
    },
    agent: {
      exposedAgentIds: ['teresa'],
      teresaSurface: 'drawer',
      contextAwareOn: 'section',
    },
    aiActions: {
      slot: 'commandRowRightContent',
      actionIds: ['ai.refine_section', 'ai.run_qa', 'ai.suggest_brand_voice'],
      duplicatedInCanvas: false,
    },
  };
  return { ...baseline, ...overrides };
}

describe('canonical constants', () => {
  it('exposes the three zones in left → canvas → right order', () => {
    expect(EXECUTION_MODULE_ZONE_ORDER).toEqual(['leftNav', 'canvas', 'rightPanel']);
    expect(EXECUTION_MODULE_ZONES.map((z) => z.zoneId)).toEqual([
      'leftNav',
      'canvas',
      'rightPanel',
    ]);
  });

  it('lists the canonical Menu 2 chips in SSOT order', () => {
    expect(EXECUTION_MODULE_MENU2_CHIP_ORDER).toEqual([
      'internal',
      'motyw',
      'history',
      'qa',
      'governance',
      'analytics',
      'audit',
      'udostepnij',
      'agent',
      'cta_primary',
    ]);
  });

  it('encodes the right-panel collapse contract', () => {
    expect(EXECUTION_MODULE_RIGHT_PANEL_COLLAPSE_CONTRACT.collapsedWidthPx).toBe(32);
    expect(EXECUTION_MODULE_RIGHT_PANEL_COLLAPSE_CONTRACT.expandedWidthRangePx.min).toBe(280);
    expect(EXECUTION_MODULE_RIGHT_PANEL_COLLAPSE_CONTRACT.expandedWidthRangePx.max).toBe(360);
    expect(EXECUTION_MODULE_RIGHT_PANEL_COLLAPSE_CONTRACT.persistence).toBe(
      'per_user_per_module',
    );
  });

  it('Teresa is the only allowed agent id', () => {
    expect(EXECUTION_MODULE_ALLOWED_AGENT_IDS).toEqual(['teresa']);
  });

  it('lists the canonical Menu 3 AI action slots', () => {
    expect(EXECUTION_MODULE_ALLOWED_AI_ACTION_SLOTS).toEqual([
      'commandRowRightContent',
      'DynamicTabs.rightContent',
      'localCommandRowRight',
    ]);
  });

  it('canonical zones + chips + agent ids are frozen', () => {
    expect(Object.isFrozen(EXECUTION_MODULE_ZONES)).toBe(true);
    expect(Object.isFrozen(EXECUTION_MODULE_MENU2_CHIP_ORDER)).toBe(true);
    expect(Object.isFrozen(EXECUTION_MODULE_ALLOWED_AGENT_IDS)).toBe(true);
    expect(Object.isFrozen(EXECUTION_MODULE_RIGHT_PANEL_COLLAPSE_CONTRACT)).toBe(true);
  });
});

describe('validateExecutionModuleManifest — happy path', () => {
  it('accepts a fully conformant baseline manifest', () => {
    const result = validateExecutionModuleManifest(makeBaselineManifest());
    expect(result.ok).toBe(true);
    expect(result.mustViolations).toEqual([]);
    expect(result.shouldViolations).toEqual([]);
  });

  it('returns a structural manifest_invalid violation on bad input', () => {
    const result = validateExecutionModuleManifest(null as unknown as ExecutionModuleManifest);
    expect(result.ok).toBe(false);
    expect(result.mustViolations.map((v) => v.ruleId)).toContain('manifest_invalid');
  });
});

describe('layout zones', () => {
  it('flags the wrong zone count', () => {
    const result = validateExecutionModuleManifest(
      makeBaselineManifest({
        zones: [{ zoneId: 'canvas', unitKindLabel: 'X' }],
      }),
    );
    expect(result.mustViolations.map((v) => v.ruleId)).toContain('layout_zone_count');
  });

  it('flags out-of-order zones', () => {
    const result = validateExecutionModuleManifest(
      makeBaselineManifest({
        zones: [
          { zoneId: 'canvas', unitKindLabel: 'X' },
          { zoneId: 'leftNav', unitKindLabel: 'X' },
          { zoneId: 'rightPanel', unitKindLabel: 'X' },
        ],
      }),
    );
    expect(result.mustViolations.map((v) => v.ruleId)).toContain('layout_zone_order');
  });
});

describe('Menu 2 chips', () => {
  it('flags an unknown chip id', () => {
    const baseline = makeBaselineManifest();
    const result = validateExecutionModuleManifest({
      ...baseline,
      menu2Chips: [
        ...baseline.menu2Chips,
        { chipId: 'imaginary' as never, present: true },
      ],
    });
    expect(result.mustViolations.map((v) => v.ruleId)).toContain('menu2_unknown_chip');
  });

  it('flags duplicate chip ids', () => {
    const baseline = makeBaselineManifest();
    const result = validateExecutionModuleManifest({
      ...baseline,
      menu2Chips: [
        ...baseline.menu2Chips,
        { chipId: 'agent', present: true },
      ],
    });
    expect(result.mustViolations.map((v) => v.ruleId)).toContain('menu2_chip_duplicate');
  });

  it('flags out-of-canonical-order chips', () => {
    const result = validateExecutionModuleManifest(
      makeBaselineManifest({
        menu2Chips: [
          { chipId: 'agent', present: true },
          { chipId: 'internal', present: true },
        ],
      }),
    );
    expect(result.mustViolations.map((v) => v.ruleId)).toContain('menu2_chip_order');
  });

  it('flags a CTA chip without a label', () => {
    const baseline = makeBaselineManifest();
    const result = validateExecutionModuleManifest({
      ...baseline,
      menu2Chips: baseline.menu2Chips.map((chip) =>
        chip.chipId === 'cta_primary' ? { ...chip, ctaLabel: undefined } : chip,
      ),
    });
    expect(result.mustViolations.map((v) => v.ruleId)).toContain('menu2_cta_label_missing');
  });

  it('emits a soft violation for hidden chips', () => {
    const baseline = makeBaselineManifest();
    const result = validateExecutionModuleManifest({
      ...baseline,
      menu2Chips: baseline.menu2Chips.filter((c) => c.chipId !== 'analytics'),
    });
    expect(result.mustViolations).toEqual([]);
    expect(result.shouldViolations.map((v) => v.ruleId)).toContain('menu2_chip_hidden');
  });
});

describe('right panel', () => {
  it('flags missing rightPanel block', () => {
    const result = validateExecutionModuleManifest(
      makeBaselineManifest({ rightPanel: undefined as never }),
    );
    expect(result.mustViolations.map((v) => v.ruleId)).toContain('right_panel_missing');
  });

  it('flags every contract field independently', () => {
    const baseline = makeBaselineManifest();
    const result = validateExecutionModuleManifest({
      ...baseline,
      rightPanel: {
        collapseTriggerPosition: 'bottom' as never,
        collapseTriggerStyle: 'aggressive' as never,
        collapsedWidthPx: 12,
        expandedWidthMinPx: 100,
        expandedWidthMaxPx: 800,
        persistence: 'session' as never,
        parallelPanelsAllowed: true as never,
      },
    });
    const ruleIds = result.mustViolations.map((v) => v.ruleId);
    expect(ruleIds).toEqual(
      expect.arrayContaining([
        'right_panel_collapse_trigger_position',
        'right_panel_collapse_trigger_style',
        'right_panel_collapsed_width',
        'right_panel_expanded_width_range',
        'right_panel_persistence',
        'right_panel_parallel_disallowed',
      ]),
    );
  });
});

describe('agent constraints', () => {
  it('flags missing agent declaration', () => {
    const result = validateExecutionModuleManifest(
      makeBaselineManifest({ agent: undefined as never }),
    );
    expect(result.mustViolations.map((v) => v.ruleId)).toContain('agent_missing');
  });

  it('flags an empty exposedAgentIds list', () => {
    const result = validateExecutionModuleManifest(
      makeBaselineManifest({
        agent: {
          exposedAgentIds: [],
          teresaSurface: 'drawer',
          contextAwareOn: 'section',
        },
      }),
    );
    expect(result.mustViolations.map((v) => v.ruleId)).toContain('agent_empty');
  });

  it('flags any agent id other than teresa', () => {
    const result = validateExecutionModuleManifest(
      makeBaselineManifest({
        agent: {
          exposedAgentIds: ['teresa', 'claude'],
          teresaSurface: 'drawer',
          contextAwareOn: 'section',
        },
      }),
    );
    expect(result.mustViolations.map((v) => v.ruleId)).toContain('agent_disallowed');
  });

  it('flags a missing teresa even when other agents are absent', () => {
    const baseline = makeBaselineManifest();
    const result = validateExecutionModuleManifest({
      ...baseline,
      agent: {
        ...baseline.agent,
        exposedAgentIds: ['only-teresa-impostor'],
      },
    });
    expect(result.mustViolations.map((v) => v.ruleId)).toContain('agent_disallowed');
    expect(result.mustViolations.map((v) => v.ruleId)).toContain('agent_teresa_required');
  });

  it('flags an invalid teresa surface', () => {
    const result = validateExecutionModuleManifest(
      makeBaselineManifest({
        agent: {
          exposedAgentIds: ['teresa'],
          teresaSurface: 'modal' as never,
          contextAwareOn: 'section',
        },
      }),
    );
    expect(result.mustViolations.map((v) => v.ruleId)).toContain('agent_surface_invalid');
  });
});

describe('AI actions placement', () => {
  it('flags missing aiActions block', () => {
    const result = validateExecutionModuleManifest(
      makeBaselineManifest({ aiActions: undefined as never }),
    );
    expect(result.mustViolations.map((v) => v.ruleId)).toContain('ai_actions_missing');
  });

  it('flags an invalid slot', () => {
    const result = validateExecutionModuleManifest(
      makeBaselineManifest({
        aiActions: {
          slot: 'metadata_strip' as never,
          actionIds: [],
          duplicatedInCanvas: false,
        },
      }),
    );
    expect(result.mustViolations.map((v) => v.ruleId)).toContain('ai_actions_slot_invalid');
  });

  it('rejects pending_migration without justification', () => {
    const result = validateExecutionModuleManifest(
      makeBaselineManifest({
        aiActions: {
          slot: 'pending_migration',
          actionIds: [],
          duplicatedInCanvas: false,
        },
      }),
    );
    expect(result.mustViolations.map((v) => v.ruleId)).toContain(
      'ai_actions_slot_pending_unjustified',
    );
  });

  it('accepts pending_migration with justification but emits soft signal', () => {
    const result = validateExecutionModuleManifest(
      makeBaselineManifest({
        aiActions: {
          slot: 'pending_migration',
          slotJustification: 'legacy module under remediation; tracking ticket UI-7711',
          actionIds: ['ai.x'],
          duplicatedInCanvas: false,
        },
      }),
    );
    expect(result.ok).toBe(true);
    expect(result.shouldViolations.map((v) => v.ruleId)).toContain(
      'ai_actions_slot_pending_migration',
    );
  });

  it('flags AI actions duplicated inside canvas', () => {
    const result = validateExecutionModuleManifest(
      makeBaselineManifest({
        aiActions: {
          slot: 'commandRowRightContent',
          actionIds: ['ai.x'],
          duplicatedInCanvas: true,
        },
      }),
    );
    expect(result.mustViolations.map((v) => v.ruleId)).toContain(
      'ai_actions_duplicated_in_canvas',
    );
  });

  it('flags duplicate + invalid action ids', () => {
    const result = validateExecutionModuleManifest(
      makeBaselineManifest({
        aiActions: {
          slot: 'commandRowRightContent',
          actionIds: ['ai.x', 'ai.x', '', '   '],
          duplicatedInCanvas: false,
        },
      }),
    );
    const ruleIds = result.mustViolations.map((v) => v.ruleId);
    expect(ruleIds).toContain('ai_actions_invalid_id');
    expect(ruleIds).toContain('ai_actions_duplicate_id');
  });
});

describe('validateAllManifests', () => {
  it('aggregates per-manifest results and returns ok=false if any fails', () => {
    const ok = makeBaselineManifest();
    const broken = makeBaselineManifest({
      moduleId: 'broken',
      agent: {
        exposedAgentIds: ['claude'],
        teresaSurface: 'drawer',
        contextAwareOn: 'section',
      },
    });
    const aggregate = validateAllManifests([ok, broken]);
    expect(aggregate.ok).toBe(false);
    expect(aggregate.results).toHaveLength(2);
    expect(aggregate.results[0]!.ok).toBe(true);
    expect(aggregate.results[1]!.ok).toBe(false);
  });

  it('returns ok=true for an empty list', () => {
    expect(validateAllManifests([])).toEqual({ ok: true, results: [] });
  });
});
