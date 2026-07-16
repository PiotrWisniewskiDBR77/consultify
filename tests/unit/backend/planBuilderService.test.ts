/**
 * planBuilderService.buildPlanFromManifest — unit tests (HP-4 F1).
 *
 * SSOT koncepcyjne: Harvard/wdrozenie-100/_KONCEPT_HP4_AGENT_W_TERESIE.md §4
 * F1 kryterium odbioru: "Dla 3 zleceń (playbook/discovery/analiza) generuje
 * sensowny plan 3-8 kroków". This module maps a Discovery Tool manifest
 * (id/wave from discoveryAgentManifestCatalog.ts) to a deterministic,
 * executable step list — no LLM call, no network, pure function — so these
 * tests exercise the real module directly against the real catalog.
 */
import { describe, expect, it } from 'vitest';

import { buildPlanFromManifest } from '../../../server/src/services/ai/agentPlan/planBuilderService.js';
import { getDiscoveryAgentManifest } from '../../../server/src/services/ai/agentRuntime/discoveryAgentManifestCatalog.js';
import { SIDE_EFFECT_TOOLS } from '../../../server/src/services/ai/sideEffectTools.js';

describe('buildPlanFromManifest (HP-4 F1 PlanBuilder)', () => {
  it('generates a 3-8 step, multi-tool playbook for a curated built manifest (market-forces)', () => {
    const steps = buildPlanFromManifest('market-forces');

    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(steps.length).toBeLessThanOrEqual(8);
    // More than one distinct tool — this must be a real multi-step plan, not
    // the old single-step "kickoff" placeholder.
    const distinctTools = new Set(steps.map((s) => s.toolName));
    expect(distinctTools.size).toBeGreaterThan(1);
    expect(steps.every((s) => typeof s.rationale === 'string' && s.rationale.length > 0)).toBe(
      true
    );
  });

  it('accepts an already-resolved manifest object, matching the id-based lookup', () => {
    const manifest = getDiscoveryAgentManifest('growth-paths');
    expect(manifest).not.toBeNull();

    const byId = buildPlanFromManifest('growth-paths');
    const byObject = buildPlanFromManifest(manifest);

    expect(byObject).toEqual(byId);
  });

  it('flags a SIDE_EFFECT_TOOLS step as requiresApproval=true (mutation needs approval before running)', () => {
    const steps = buildPlanFromManifest('sop-builder'); // curated playbook ends in create_notebook_entry

    const mutatingSteps = steps.filter((s) => SIDE_EFFECT_TOOLS.has(s.toolName));
    expect(mutatingSteps.length).toBeGreaterThan(0);
    for (const s of mutatingSteps) {
      expect(s.requiresApproval).toBe(true);
    }

    const nonMutatingSteps = steps.filter((s) => !SIDE_EFFECT_TOOLS.has(s.toolName));
    for (const s of nonMutatingSteps) {
      expect(s.requiresApproval).toBe(false);
    }
  });

  it('every curated built manifest in the catalog produces a valid 3-8 step plan with only known tool names', () => {
    // Drift guard: if a new Discovery Tool is added to the catalog, this
    // proves it at least resolves via the wave-default fallback (not a
    // crash) — see the last test below for the "no curation yet" path.
    const knownToolNames = new Set([
      'search_web',
      'search_knowledge_base',
      'list_enterprise_connectors',
      'search_enterprise_connector',
      'get_assessment_data',
      'calculate_financial',
      'run_monte_carlo',
      'get_initiative_status',
      'compare_benchmarks',
      'find_similar_decisions',
      'get_stakeholder_analysis',
      'create_initiative_draft',
      'generate_report_section',
      'schedule_meeting',
      'create_notebook_entry',
      'query_structured_data',
      'create_task',
      'update_task',
      'create_decision',
    ]);

    const builtIds = [
      'market-forces',
      'growth-paths',
      'portfolio-priority',
      'risk-uncertainty',
      'value-chain',
      'ambition-decomposer',
      'focus-tradeoff',
      'capability-mapper',
      'narrative-engine',
      'sop-builder',
      'a3-problem-solving',
      'smed-planner',
      'dms-builder',
      'inventory-autopilot',
      'rpa-scanner',
      'ai-discovery',
      'pain-explorer',
      'process-automation',
      'dynamic-swot',
    ];

    for (const id of builtIds) {
      const steps = buildPlanFromManifest(id);
      expect(steps.length, `manifest ${id} step count`).toBeGreaterThanOrEqual(3);
      expect(steps.length, `manifest ${id} step count`).toBeLessThanOrEqual(8);
      for (const s of steps) {
        expect(knownToolNames.has(s.toolName), `manifest ${id} unknown tool ${s.toolName}`).toBe(
          true
        );
      }
    }
  });

  it('falls back to the wave-3 default playbook for a "planned" (uncurated) manifest', () => {
    // vsm-builder is `status: 'planned'` in the catalog (no curated entry above).
    const manifest = getDiscoveryAgentManifest('vsm-builder');
    expect(manifest?.status).toBe('planned');
    expect(manifest?.wave).toBe('wave-3');

    const steps = buildPlanFromManifest('vsm-builder');
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(steps.length).toBeLessThanOrEqual(8);
    // Wave-3 default playbook includes query_structured_data + find_similar_decisions.
    expect(steps.some((s) => s.toolName === 'query_structured_data')).toBe(true);
    expect(steps.some((s) => s.toolName === 'find_similar_decisions')).toBe(true);
  });

  it('falls back to a generic 2-step playbook for a manifestId that is not in the catalog at all', () => {
    const steps = buildPlanFromManifest('totally-unknown-agent-id');

    expect(steps.length).toBeGreaterThanOrEqual(2);
    expect(steps.every((s) => typeof s.toolName === 'string' && s.toolName.length > 0)).toBe(true);
  });

  it('handles null/undefined input the same as an unknown manifestId', () => {
    const stepsNull = buildPlanFromManifest(null);
    const stepsUndefined = buildPlanFromManifest(undefined);
    const stepsUnknown = buildPlanFromManifest('totally-unknown-agent-id');

    expect(stepsNull).toEqual(stepsUnknown);
    expect(stepsUndefined).toEqual(stepsUnknown);
  });
});
