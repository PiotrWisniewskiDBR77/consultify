import { describe, expect, it } from 'vitest';

import {
  evaluateTemplateTestChecks,
  nextTemplateVersion,
} from '../deliverableTemplateWorkflowService.js';

describe('TPL-1b governed template live-test gate', () => {
  const complete = {
    type: 'deck' as const,
    structure: [
      { title: 'Executive summary', source: 'DRD' },
      { title: 'Decision', source: 'Decisions' },
    ],
    sourceBindings: { a: 'DRD', b: 'Decisions' },
    language: 'en',
    exportByteSize: 4096,
  };

  it('passes only when structure, sources, language and a real export package are present', () => {
    expect(Object.values(evaluateTemplateTestChecks(complete))).toEqual([
      true,
      true,
      true,
      true,
      true,
      true,
      true,
    ]);
  });

  it('fails when one structure block has no source', () => {
    const checks = evaluateTemplateTestChecks({ ...complete, sourceBindings: { a: 'DRD' } });
    expect(checks.sources_bound).toBe(false);
  });

  it('fails on unresolved placeholders or a missing export', () => {
    const checks = evaluateTemplateTestChecks({
      ...complete,
      structure: [{ title: '{{missing}}', source: 'DRD' }],
      sourceBindings: { a: 'DRD' },
      exportByteSize: 0,
    });
    expect(checks.no_unresolved_fields).toBe(false);
    expect(checks.export_generated).toBe(false);
  });

  it('creates a minor draft version after an approved version is edited', () => {
    expect(nextTemplateVersion('1.0')).toBe('1.1');
    expect(nextTemplateVersion('2.7')).toBe('2.8');
  });
});
