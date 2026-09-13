import { describe, expect, it } from 'vitest';

import {
  buildFindingGenerationSnapshot,
  canonicalJson,
  createFindingGenerationReceiptPayload,
  FINDING_GENERATION_RECEIPT_ACTION,
  FINDING_GENERATION_RECEIPT_ENTITY_TYPE,
  findingGenerationReceiptId,
  hashCanonicalJson,
  hashFindingGenerationSnapshot,
  hashGenerationContextJson,
  validateFindingGenerationReceipt,
} from '../interviewInsightFindingGenerationReceipt.js';

const IDS = {
  organizationId: 'org-a',
  insightId: 'insight-a',
  findingId: 'finding-a',
  runId: 'run-a',
};

const STARTED_AT = '2026-09-13T01:00:00.000Z';
const COMPLETED_AT = '2026-09-13T01:01:00.000Z';
const FINDING_AT = '2026-09-13T01:02:00.000Z';

function generationContext(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    createdAt: STARTED_AT,
    contextMode: 'selected_interview_material_only',
    generationRun: {
      version: 1,
      runId: IDS.runId,
      status: 'completed',
      startedAt: STARTED_AT,
      completedAt: COMPLETED_AT,
    },
    evidenceEnrichment: { lookupComplete: true, evidenceIds: ['e-1'] },
    ...overrides,
  });
}

function finding(overrides: Record<string, unknown> = {}) {
  return {
    id: IDS.findingId,
    organization_id: IDS.organizationId,
    insight_id: IDS.insightId,
    source_section_type: 'theme',
    source_section_index: 0,
    source_key: 'theme:0',
    finding_statement: 'A factual finding',
    confidence_level: 'high',
    limits_text: 'A stated limit',
    limits_json: JSON.stringify([{ kind: 'coverage', value: 2 }]),
    next_action_text: 'Validate it',
    next_action_json: JSON.stringify({ owner: null, steps: ['one', 'two'] }),
    created_by: 'user-a',
    created_at: FINDING_AT,
    ...overrides,
  };
}

function pointers(overrides: Record<string, unknown> = {}) {
  return [
    {
      id: 'ptr-b',
      organization_id: IDS.organizationId,
      insight_id: IDS.insightId,
      finding_id: IDS.findingId,
      pointer_type: 'question_answer',
      source_ref: 'answer:2',
      source_fingerprint: 'sha256:b',
      captured_excerpt: 'second excerpt',
      captured_at: FINDING_AT,
      pointer_state: 'active',
      removal_reason: null,
      removed_at: null,
      duplicate_observed_count: 0,
      metadata_json: JSON.stringify({ page: 2, labels: ['a', 'b'] }),
      created_by: 'user-a',
      created_at: FINDING_AT,
    },
    {
      id: 'ptr-a',
      organization_id: IDS.organizationId,
      insight_id: IDS.insightId,
      finding_id: IDS.findingId,
      pointer_type: 'question_answer',
      source_ref: 'answer:1',
      source_fingerprint: 'sha256:a',
      captured_excerpt: 'first excerpt',
      captured_at: FINDING_AT,
      pointer_state: 'active',
      removal_reason: null,
      removed_at: null,
      duplicate_observed_count: 0,
      metadata_json: JSON.stringify({ nested: { z: false, a: null }, score: 1 }),
      created_by: 'user-a',
      created_at: FINDING_AT,
      ...overrides,
    },
  ];
}

function validFixture() {
  const contextJson = generationContext();
  const findingRow = finding();
  const pointerRows = pointers();
  const payload = createFindingGenerationReceiptPayload({
    organizationId: IDS.organizationId,
    insightId: IDS.insightId,
    findingId: IDS.findingId,
    generationRunId: IDS.runId,
    generationStartedAt: STARTED_AT,
    generationCompletedAt: COMPLETED_AT,
    generationContextJson: contextJson,
    finding: findingRow,
    pointers: pointerRows,
  });
  return {
    insight: {
      id: IDS.insightId,
      organization_id: IDS.organizationId,
      status: 'completed',
      error_message: null,
      generation_context_json: contextJson,
      updated_at: COMPLETED_AT,
    },
    finding: findingRow,
    pointers: pointerRows,
    receipts: [
      {
        id: findingGenerationReceiptId(IDS.findingId),
        organization_id: IDS.organizationId,
        insight_id: IDS.insightId,
        finding_id: IDS.findingId,
        entity_type: FINDING_GENERATION_RECEIPT_ENTITY_TYPE,
        entity_id: IDS.findingId,
        action: FINDING_GENERATION_RECEIPT_ACTION,
        detail_json: JSON.stringify(payload),
        created_at: FINDING_AT,
      },
    ],
  };
}

describe('interviewInsightFindingGenerationReceipt', () => {
  it('canonicalizes JSON without changing array order or JSON value types', () => {
    const a = { z: [3, { b: true, a: null }], a: '1', n: 1 };
    const b = { n: 1, a: '1', z: [3, { a: null, b: true }] };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(JSON.parse(canonicalJson(a))).toEqual(a);
    expect(hashCanonicalJson(a)).toBe(hashCanonicalJson(b));
    expect(hashCanonicalJson(a)).not.toBe(
      hashCanonicalJson({ ...a, z: [{ b: true, a: null }, 3] })
    );
  });

  it('rejects values and JSON columns that cannot be represented losslessly as JSON', () => {
    expect(() => canonicalJson({ missing: undefined })).toThrow(/JSON-safe/i);
    expect(() => canonicalJson({ invalid: Number.NaN })).toThrow(/finite/i);
    expect(() =>
      buildFindingGenerationSnapshot({
        finding: finding({ limits_json: '{' }),
        pointers: pointers(),
      })
    ).toThrow(/limits_json/i);
    expect(() =>
      buildFindingGenerationSnapshot({
        finding: finding(),
        pointers: pointers({ metadata_json: '{' }),
      })
    ).toThrow(/metadata_json/i);
  });

  it('sorts all pointers stably and hashes every immutable pointer semantic', () => {
    const original = hashFindingGenerationSnapshot({ finding: finding(), pointers: pointers() });
    const reordered = hashFindingGenerationSnapshot({
      finding: finding({
        limits_json: '[{"value":2,"kind":"coverage"}]',
        next_action_json: '{"steps":["one","two"],"owner":null}',
      }),
      pointers: [...pointers()].reverse(),
    });
    expect(original).toBe(reordered);
    expect(
      hashFindingGenerationSnapshot({
        finding: finding(),
        pointers: pointers({ duplicate_observed_count: 1 }),
      })
    ).not.toBe(original);
    expect(
      hashFindingGenerationSnapshot({
        finding: finding(),
        pointers: pointers({ captured_excerpt: 'edited excerpt' }),
      })
    ).not.toBe(original);
    expect(() =>
      hashFindingGenerationSnapshot({
        finding: finding(),
        pointers: [pointers()[0], pointers()[0]],
      })
    ).toThrow(/duplicate pointer id/i);

    const localeSensitivePointers = pointers().map((pointer, index) => ({
      ...pointer,
      id: index === 0 ? 'ptr-ä' : 'ptr-z',
      source_ref: `answer:locale-${index}`,
      source_fingerprint: `sha256:locale-${index}`,
    }));
    const snapshot = buildFindingGenerationSnapshot({
      finding: finding(),
      pointers: localeSensitivePointers,
    }) as any;
    expect(snapshot.pointers.map((pointer: any) => pointer.pointerId)).toEqual(['ptr-z', 'ptr-ä']);
  });

  it('builds a deterministic strict-v1 receipt without raw Finding content', () => {
    const fixture = validFixture();
    const payload = JSON.parse(fixture.receipts[0].detail_json);
    expect(fixture.receipts[0].id).toBe('finding-generation-v1:finding-a');
    expect(Object.keys(payload).sort()).toEqual(
      [
        'findingCreatedAt',
        'findingId',
        'findingSnapshotSha256',
        'generationCompletedAt',
        'generationContextSha256',
        'generationRunId',
        'generationStartedAt',
        'insightId',
        'organizationId',
        'receiptType',
        'version',
      ].sort()
    );
    expect(fixture.receipts[0].detail_json).not.toContain('A factual finding');
    expect(fixture.receipts[0].detail_json).not.toContain('first excerpt');
  });

  it('validates one exact receipt against the current completed generation', () => {
    const fixture = validFixture();
    expect(validateFindingGenerationReceipt(fixture)).toMatchObject({
      valid: true,
      receiptId: findingGenerationReceiptId(IDS.findingId),
      generationRunId: IDS.runId,
    });
  });

  it('rejects missing, duplicate, malformed, or non-v1 receipts', () => {
    const fixture = validFixture();
    expect(validateFindingGenerationReceipt({ ...fixture, receipts: [] })).toEqual({
      valid: false,
      reason: 'receipt_count',
    });
    expect(
      validateFindingGenerationReceipt({
        ...fixture,
        receipts: [fixture.receipts[0], fixture.receipts[0]],
      })
    ).toEqual({ valid: false, reason: 'receipt_count' });
    expect(
      validateFindingGenerationReceipt({
        ...fixture,
        receipts: [{ ...fixture.receipts[0], detail_json: '{' }],
      })
    ).toEqual({ valid: false, reason: 'receipt_malformed' });
    const extra = JSON.parse(fixture.receipts[0].detail_json);
    extra.findingStatement = 'raw content must be rejected';
    expect(
      validateFindingGenerationReceipt({
        ...fixture,
        receipts: [{ ...fixture.receipts[0], detail_json: JSON.stringify(extra) }],
      })
    ).toEqual({ valid: false, reason: 'receipt_malformed' });
    const wrongVersion = JSON.parse(fixture.receipts[0].detail_json);
    wrongVersion.version = 2;
    expect(
      validateFindingGenerationReceipt({
        ...fixture,
        receipts: [{ ...fixture.receipts[0], detail_json: JSON.stringify(wrongVersion) }],
      })
    ).toEqual({ valid: false, reason: 'receipt_malformed' });
  });

  it('rejects foreign receipt, Finding, and pointer identities', () => {
    const fixture = validFixture();
    expect(
      validateFindingGenerationReceipt({
        ...fixture,
        receipts: [{ ...fixture.receipts[0], organization_id: 'org-b' }],
      })
    ).toEqual({ valid: false, reason: 'foreign_identity' });
    expect(
      validateFindingGenerationReceipt({
        ...fixture,
        receipts: [{ ...fixture.receipts[0], action: 'created' }],
      })
    ).toEqual({ valid: false, reason: 'receipt_identity_mismatch' });
    expect(
      validateFindingGenerationReceipt({
        ...fixture,
        finding: finding({ insight_id: 'insight-b' }),
      })
    ).toEqual({ valid: false, reason: 'foreign_identity' });
    expect(
      validateFindingGenerationReceipt({
        ...fixture,
        pointers: pointers({ organization_id: 'org-b' }),
      })
    ).toEqual({ valid: false, reason: 'foreign_identity' });
  });

  it('rejects stale context, wrong run, and non-completed current Insight state', () => {
    const fixture = validFixture();
    expect(
      validateFindingGenerationReceipt({
        ...fixture,
        insight: {
          ...fixture.insight,
          generation_context_json: generationContext({ extra: true }),
        },
      })
    ).toEqual({ valid: false, reason: 'generation_context_mismatch' });
    const wrongRunContext = generationContext({
      generationRun: {
        version: 1,
        runId: 'run-b',
        status: 'completed',
        startedAt: STARTED_AT,
        completedAt: COMPLETED_AT,
      },
    });
    expect(
      validateFindingGenerationReceipt({
        ...fixture,
        insight: { ...fixture.insight, generation_context_json: wrongRunContext },
      })
    ).toEqual({ valid: false, reason: 'generation_run_mismatch' });
    expect(
      validateFindingGenerationReceipt({
        ...fixture,
        insight: { ...fixture.insight, generation_context_json: '{' },
      })
    ).toEqual({ valid: false, reason: 'generation_not_current_completed' });
    for (const insight of [
      { ...fixture.insight, status: 'generating' },
      { ...fixture.insight, status: 'failed', error_message: 'provider failed' },
      { ...fixture.insight, updated_at: '2026-09-13T01:01:01.000Z' },
    ]) {
      expect(validateFindingGenerationReceipt({ ...fixture, insight })).toEqual({
        valid: false,
        reason: 'generation_not_current_completed',
      });
    }
  });

  it('rejects naive, inconsistent, future, and out-of-order timestamps', () => {
    const fixture = validFixture();
    expect(
      validateFindingGenerationReceipt({
        ...fixture,
        receipts: [{ ...fixture.receipts[0], created_at: '2026-09-13 01:02:00' }],
      })
    ).toEqual({ valid: false, reason: 'time_invalid' });
    expect(
      validateFindingGenerationReceipt({
        ...fixture,
        receipts: [{ ...fixture.receipts[0], created_at: '2026-02-30T01:02:00.000Z' }],
      })
    ).toEqual({ valid: false, reason: 'time_invalid' });
    expect(
      validateFindingGenerationReceipt({
        ...fixture,
        receipts: [{ ...fixture.receipts[0], created_at: '2026-09-13T01:02:01.000Z' }],
      })
    ).toEqual({ valid: false, reason: 'time_mismatch' });
    expect(
      validateFindingGenerationReceipt({ ...fixture, handoffCutoff: '2026-09-13T01:01:59.999Z' })
    ).toEqual({ valid: false, reason: 'receipt_after_cutoff' });
    const badContext = generationContext({
      generationRun: {
        version: 1,
        runId: IDS.runId,
        status: 'completed',
        startedAt: '2026-09-13T01:03:00.000Z',
        completedAt: COMPLETED_AT,
      },
      createdAt: '2026-09-13T01:03:00.000Z',
    });
    expect(
      validateFindingGenerationReceipt({
        ...fixture,
        insight: { ...fixture.insight, generation_context_json: badContext },
      })
    ).toEqual({ valid: false, reason: 'time_invalid' });
  });

  it('hashes the exact persisted generation-context bytes', () => {
    const a = '{"a":1,"b":2}';
    const b = '{ "b": 2, "a": 1 }';
    expect(JSON.parse(a)).toEqual(JSON.parse(b));
    expect(hashGenerationContextJson(a)).not.toBe(hashGenerationContextJson(b));
  });
});
