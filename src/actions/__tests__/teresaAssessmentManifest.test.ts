/**
 * Assessment tool manifest — before this file (and the code it tests)
 * existed, `grep -c assessment src/actions/teresaActionManifest.ts` was 0:
 * Teresa's tool manifest only ever knew the Idea Workspace canvas. These
 * tests cover the sibling manifest added for Assessment (Method Kernel)
 * capabilities, and double as negative tests 6-10's manifest-layer proof:
 * a forbidden effect never resolves to a tool, because no such tool was
 * ever generated (the manifest is built FROM `TERESA_CAPABILITIES`, which
 * is disjoint from `TERESA_FORBIDDEN_EFFECTS`).
 */
import { describe, expect, it } from 'vitest';

import { TERESA_CAPABILITIES, TERESA_FORBIDDEN_EFFECTS, type TeresaForbiddenEffect } from '@/method-core/contracts';

import {
  ASSESSMENT_TOOL_PREFIX,
  assessmentToolName,
  buildTeresaAssessmentToolManifest,
  resolveTeresaAssessmentCapability,
} from '../teresaActionManifest';

describe('buildTeresaAssessmentToolManifest', () => {
  it('generates exactly one tool per TERESA_CAPABILITIES entry (23), each prefixed and resolvable', () => {
    const manifest = buildTeresaAssessmentToolManifest();
    expect(manifest).toHaveLength(23);
    for (const tool of manifest) {
      expect(tool.type).toBe('function');
      expect(tool.function.name.startsWith(ASSESSMENT_TOOL_PREFIX)).toBe(true);
      expect(tool.function.description.length).toBeGreaterThan(0);
      expect(tool.function.parameters.type).toBe('object');
      expect(resolveTeresaAssessmentCapability(tool.function.name)).toBeDefined();
    }
  });

  it('every tool name round-trips through assessmentToolName/resolveTeresaAssessmentCapability', () => {
    for (const id of TERESA_CAPABILITIES) {
      const name = assessmentToolName(id);
      expect(resolveTeresaAssessmentCapability(name)).toBe(id);
    }
  });

  it('a proposal-producing capability tells the model it will preview, not silently write', () => {
    const manifest = buildTeresaAssessmentToolManifest();
    const draftScore = manifest.find((t) => t.function.name === assessmentToolName('draft_score_proposal'));
    expect(draftScore?.function.description).toMatch(/podgląd/i);
    const explain = manifest.find((t) => t.function.name === assessmentToolName('explain_method_unit'));
    expect(explain?.function.description).toMatch(/informacyjna/i);
  });
});

describe('resolveTeresaAssessmentCapability — negative tests 6-10 (manifest layer)', () => {
  const NAMED_FORBIDDEN: readonly TeresaForbiddenEffect[] = [
    'approve_score',
    'freeze_session',
    'approve_target',
    'publish_output',
    'register_initiative',
  ];

  it.each(NAMED_FORBIDDEN)('"assessment_%s" does not resolve to any capability — the tool was never generated', (effect) => {
    expect(TERESA_FORBIDDEN_EFFECTS).toContain(effect);
    const wouldBeToolName = `${ASSESSMENT_TOOL_PREFIX}${effect}`;
    expect(resolveTeresaAssessmentCapability(wouldBeToolName)).toBeUndefined();
    // Also not present anywhere in the actual generated manifest — not
    // filtered out at call time, simply never produced.
    const manifest = buildTeresaAssessmentToolManifest();
    expect(manifest.some((t) => t.function.name === wouldBeToolName)).toBe(false);
  });

  it('a tool name outside the assessment_ prefix is never mistaken for one (no accidental resolution)', () => {
    expect(resolveTeresaAssessmentCapability('idea_element_add')).toBeUndefined();
    expect(resolveTeresaAssessmentCapability('approve_score')).toBeUndefined();
  });
});
