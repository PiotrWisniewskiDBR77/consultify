import { describe, expect, it, vi } from 'vitest';

import { readExecutionBankInitiativeEvidence } from '../executionBankEvidenceReadService.js';

const initiativeId = 'native-forecast-root';
const organizationId = 'native-org-root';
const asOf = '2028-01-31T12:00:00.000Z';
const receipt = (overrides: Record<string, unknown> = {}) => ({
  id: 'canonical-command-7',
  initiative_id: initiativeId,
  aggregate_version: 7,
  response_json: {
    initiativeId,
    after: { forecastStartDate: '2028-02-01', forecastEndDate: '2028-04-30' },
    changedFields: ['forecastEndDate'],
  },
  observed_at: '2028-01-20T12:34:56.123Z',
  system: 'ie_command_receipts',
  ...overrides,
});

async function read(
  receipts: Array<Record<string, unknown>>,
  payload: Record<string, unknown> = {
    forecastStartDate: '2028-02-01',
    forecastEndDate: '2028-04-30',
  }
) {
  const query = vi.fn(async (sql: string, params: unknown[] = []) => {
    expect(params).toContain(organizationId);
    expect(params).toContain(initiativeId);
    if (sql.includes('FROM ie_aggregate_state'))
      return [{ initiative_id: initiativeId, aggregate_version: 7, payload_json: payload }];
    if (sql.includes('FROM ie_command_receipts')) return receipts;
    return [];
  });
  const results = await readExecutionBankInitiativeEvidence(
    { organizationId, initiativeIds: [initiativeId], asOf },
    { queryAll: query as any }
  );
  expect(
    results[initiativeId],
    'native-only Initiative must have an evidence projection'
  ).toBeDefined();
  return results[initiativeId];
}

describe('native forecast independent receipt authority', () => {
  it('uses direct response.after and durable receipt identity/time without inventing progress', async () => {
    const result = await read([receipt()]);
    expect(result.forecastEndEvidence).toMatchObject({
      value: '2028-04-30',
      completeness: 'KNOWN',
      observedAt: '2028-01-20T12:34:56.123Z',
      asOf,
      source: { system: 'ie_command_receipts', recordId: 'canonical-command-7' },
    });
    expect(result.progressEvidence).toMatchObject({ value: null, completeness: 'UNKNOWN' });
    expect(result.forecastStartEvidence.completeness).toBe('UNKNOWN');
  });

  it('does not reuse an older matching receipt when the latest changed value is malformed', async () => {
    const result = await read([
      receipt({ id: 'older', aggregate_version: 6 }),
      receipt({
        id: 'newer-malformed',
        observed_at: '2028-01-21T12:00:00.000Z',
        response_json: {
          after: { forecastEndDate: { corrupt: true } },
          changedFields: ['forecastEndDate'],
        },
      }),
    ]);
    expect(result.forecastEndEvidence.completeness).toBe('UNKNOWN');
    expect(result.forecastEndEvidence.source.recordId).not.toBe('older');
  });

  it('does not certify an older value when a receipt version is ahead of the canonical aggregate', async () => {
    const result = await read([
      receipt({ id: 'older' }),
      receipt({
        id: 'impossible-version',
        aggregate_version: 8,
        observed_at: '2028-01-21T12:00:00.000Z',
      }),
    ]);
    expect(result.forecastEndEvidence).toMatchObject({
      completeness: 'UNKNOWN',
      reason: 'SOURCE_CONFLICT',
    });
  });

  it('uses aggregate version ordering when transaction timestamps are inverted', async () => {
    const result = await read([
      receipt({ id: 'causal-latest', aggregate_version: 7 }),
      receipt({
        id: 'older-version-later-clock',
        aggregate_version: 6,
        observed_at: '2028-01-21T12:00:00.000Z',
        response_json: {
          after: { forecastEndDate: '2028-05-31' },
          changedFields: ['forecastEndDate'],
        },
      }),
    ]);
    expect(result.forecastEndEvidence).toMatchObject({
      value: '2028-04-30',
      completeness: 'KNOWN',
      source: { recordId: 'causal-latest' },
    });
  });

  it('detects an ahead-of-state receipt even when its database clock precedes an older version', async () => {
    const result = await read([
      receipt({ id: 'current-clock-latest', observed_at: '2028-01-21T12:00:00.000Z' }),
      receipt({ id: 'ahead-clock-earlier', aggregate_version: 8 }),
    ]);
    expect(result.forecastEndEvidence).toMatchObject({
      completeness: 'UNKNOWN',
      reason: 'SOURCE_CONFLICT',
    });
  });

  it('does not treat an unchanged field in a merged snapshot as newly observed', async () => {
    const result = await read([
      receipt({
        response_json: {
          after: { forecastStartDate: '2028-02-01', forecastEndDate: '2028-04-30' },
          changedFields: ['forecastStartDate'],
        },
      }),
    ]);
    expect(result.forecastEndEvidence.completeness).toBe('UNKNOWN');
    expect(result.forecastEndEvidence.observedAt).toBeNull();
  });

  it('retains explicit clear provenance and distinguishes it from an absent field', async () => {
    const clearedReceipt = receipt({
      response_json: { after: { forecastEndDate: null }, changedFields: ['forecastEndDate'] },
    });
    const cleared = await read([clearedReceipt], { forecastEndDate: null });
    expect(cleared.forecastEndEvidence).toMatchObject({
      value: null,
      completeness: 'UNKNOWN',
      reason: 'VALUE_CLEARED',
      observedAt: '2028-01-20T12:34:56.123Z',
      source: { recordId: 'canonical-command-7' },
    });
    const missing = await read([], {});
    expect(missing.forecastEndEvidence).toMatchObject({
      value: null,
      completeness: 'UNKNOWN',
      reason: 'VALUE_MISSING',
      observedAt: null,
      source: { recordId: null },
    });
  });

  it('does not present the current value as known at an asOf before its latest receipt', async () => {
    const result = await read([
      receipt({ id: 'older', aggregate_version: 6 }),
      receipt({ id: 'future', observed_at: '2028-02-01T12:00:00.000Z' }),
    ]);
    expect(result.forecastEndEvidence.completeness).toBe('UNKNOWN');
    expect(result.forecastEndEvidence.source.recordId).not.toBe('older');
  });
});
