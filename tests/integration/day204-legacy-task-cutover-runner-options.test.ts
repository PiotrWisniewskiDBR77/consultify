import { describe, expect, it } from 'vitest';

import {
  assertWriteAuthorized,
  parseRunnerOptions,
  selectedInitiativeLimit,
} from '../../server/scripts/legacy-task-cutover-runner';

const ORG = '--organization-id=day204-opts-org';

describe('Day204 legacy task cutover runner safety', { retry: 0 }, () => {
  it('FIX-204-1: refuses to start without an organization scope (fail-closed)', () => {
    expect(() => parseRunnerOptions([])).toThrow('--organization-id is required');
    expect(() => parseRunnerOptions(['--write', '--max-tasks=1'])).toThrow(
      '--organization-id is required'
    );
  });

  it('defaults to dry-run, exactly one initiative, and max-tasks=1 once scoped', () => {
    const options = parseRunnerOptions([ORG]);
    expect(options.write).toBe(false);
    expect(options.organizationId).toBe('day204-opts-org');
    expect(selectedInitiativeLimit(options)).toBe(1);
    expect(options.maxTasks).toBe(1);
  });

  it('FIX-204-2: accepts an explicit --max-tasks independent of --batch-size', () => {
    const options = parseRunnerOptions([ORG, '--max-tasks=7']);
    expect(options.maxTasks).toBe(7);
  });

  it('FIX-204-2: rejects a non-positive --max-tasks', () => {
    expect(() => parseRunnerOptions([ORG, '--max-tasks=0'])).toThrow(
      '--max-tasks must be a positive integer'
    );
    expect(() => parseRunnerOptions([ORG, '--max-tasks=-3'])).toThrow(
      '--max-tasks must be a positive integer'
    );
  });

  it('enforces exactly one initiative without --confirm-batch', () => {
    const options = parseRunnerOptions([ORG, '--batch-size', '5']);
    expect(options.batchSize).toBe(1);
    expect(selectedInitiativeLimit(options)).toBe(1);
  });

  it('allows confirmed batches up to ten', () => {
    expect(
      selectedInitiativeLimit(parseRunnerOptions([ORG, '--confirm-batch', '--batch-size=10']))
    ).toBe(10);
  });

  it('rejects a batch size above the D-13 ceiling', () => {
    expect(() => parseRunnerOptions([ORG, '--confirm-batch', '--batch-size=11'])).toThrow(
      'between 1 and 10'
    );
  });

  it('requires the exact write confirmation value', () => {
    const previous = process.env.CONFIRM_LEGACY_TASK_CUTOVER;
    delete process.env.CONFIRM_LEGACY_TASK_CUTOVER;
    expect(() => assertWriteAuthorized(parseRunnerOptions([ORG, '--write']))).toThrow(
      'Confirmation required'
    );
    process.env.CONFIRM_LEGACY_TASK_CUTOVER = 'day204-write';
    expect(() => assertWriteAuthorized(parseRunnerOptions([ORG, '--write']))).not.toThrow();
    if (previous === undefined) delete process.env.CONFIRM_LEGACY_TASK_CUTOVER;
    else process.env.CONFIRM_LEGACY_TASK_CUTOVER = previous;
  });

  it('rejects initiative-id combined with batch-size', () => {
    expect(() => parseRunnerOptions([ORG, '--initiative-id=x', '--batch-size=2'])).toThrow(
      'mutually exclusive'
    );
  });
});
