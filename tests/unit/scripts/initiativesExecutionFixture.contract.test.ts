import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const fixtureScript = path.resolve(
  process.cwd(),
  'server/scripts/seed-wave3-initiatives-owner-review.ts'
);

describe('Wave 3 Initiatives to Execution owner fixture', () => {
  const source = fs.readFileSync(fixtureScript, 'utf8');

  it('seeds every canonical Execution surface through ie_aggregate_state', () => {
    for (const aggregateType of [
      'execution_task',
      'execution_decision',
      'operational_allocation',
      'management_signal',
      'intervention_case',
      'report_definition',
      'report_run',
    ]) {
      expect(source).toContain(`'${aggregateType}'`);
    }
    expect(source).toContain('INSERT INTO ie_aggregate_state');
  });

  it('keeps downstream records joined to the canonical initiative and execution case', () => {
    expect(source.match(/initiativeId,/g)?.length ?? 0).toBeGreaterThanOrEqual(7);
    expect(
      source.match(/executionCaseId: IDS\.executionCase/g)?.length ?? 0
    ).toBeGreaterThanOrEqual(6);
    expect(source).toContain('scopeRefs: [`initiative:${initiativeId}`]');
    expect(source).toContain("{ type: 'execution_case', id: IDS.executionCase, version: 1 }");
  });

  it('cold-readbacks the exact owner-review denominator', () => {
    for (const expected of [
      'execution_tasks: 2',
      'execution_decisions: 1',
      'operational_allocations: 2',
      'management_signals: 1',
      'interventions: 1',
      'report_definitions: 1',
      'report_runs: 1',
    ]) {
      expect(source).toContain(expected);
    }
  });

  it('seeds readable actor identities for owner-review surfaces', () => {
    expect(source).toContain("firstName: 'Piotr'");
    expect(source).toContain("lastName: 'Wiśniewski'");
    expect(source).toContain('user.firstName, user.lastName, user.role');
  });
});
