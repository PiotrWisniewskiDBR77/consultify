import { describe, expect, it } from 'vitest';

import {
  assertWriteAuthorized,
  parseRunnerOptions,
  selectedInitiativeLimit,
} from '../../server/scripts/legacy-task-cutover-runner';

describe('Day204 legacy task cutover runner safety', { retry: 0 }, () => {
  it('defaults to dry-run and exactly one initiative', () => {
    const options = parseRunnerOptions([]);
    expect(options.write).toBe(false);
    expect(selectedInitiativeLimit(options)).toBe(1);
  });

  it('enforces exactly one initiative without --confirm-batch', () => {
    const options = parseRunnerOptions(['--batch-size', '5']);
    expect(options.batchSize).toBe(1);
    expect(selectedInitiativeLimit(options)).toBe(1);
  });

  it('allows confirmed batches up to ten', () => {
    expect(
      selectedInitiativeLimit(parseRunnerOptions(['--confirm-batch', '--batch-size=10']))
    ).toBe(10);
  });

  it('rejects a batch size above the D-13 ceiling', () => {
    expect(() => parseRunnerOptions(['--confirm-batch', '--batch-size=11'])).toThrow(
      'between 1 and 10'
    );
  });

  it('requires the exact write confirmation value', () => {
    const previous = process.env.CONFIRM_LEGACY_TASK_CUTOVER;
    delete process.env.CONFIRM_LEGACY_TASK_CUTOVER;
    expect(() => assertWriteAuthorized(parseRunnerOptions(['--write']))).toThrow(
      'Confirmation required'
    );
    process.env.CONFIRM_LEGACY_TASK_CUTOVER = 'day204-write';
    expect(() => assertWriteAuthorized(parseRunnerOptions(['--write']))).not.toThrow();
    if (previous === undefined) delete process.env.CONFIRM_LEGACY_TASK_CUTOVER;
    else process.env.CONFIRM_LEGACY_TASK_CUTOVER = previous;
  });

  it('rejects initiative-id combined with batch-size', () => {
    expect(() => parseRunnerOptions(['--initiative-id=x', '--batch-size=2'])).toThrow(
      'mutually exclusive'
    );
  });
});
