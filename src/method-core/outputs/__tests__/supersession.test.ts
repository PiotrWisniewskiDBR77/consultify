/**
 * Covers the pure half of canon test 8: marking a Deliverable/Draft
 * superseded changes ONLY the status wrapper, never the content. The
 * DB-level half (new freeze -> UPDATE status of previously-current rows,
 * content columns untouched) is covered in
 * server/src/method-core/outputs/__tests__/supersession.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { markRecordSuperseded, wrapAsCurrent } from '../supersession';
import { buildReportSnapshot } from '../reportSnapshot';
import { makeOutput } from './testFixtures';

describe('Supersession — content untouched, only status changes (test 8, pure half)', () => {
  it('wrapAsCurrent starts a record as current with no supersession pointer', () => {
    const record = wrapAsCurrent({ id: 'x' });
    expect(record.status).toBe('current');
    expect(record.supersededAt).toBeNull();
    expect(record.supersededByOutputId).toBeNull();
  });

  it('markRecordSuperseded returns a NEW wrapper but the SAME content reference (identity, not just equality)', () => {
    const output = makeOutput();
    const report = buildReportSnapshot(output, {
      id: 'report-1',
      executiveSummary: 'Summary.',
      participants: [],
      strengths: [],
      initiativeCandidates: [],
      appendices: [],
      createdAt: '2026-08-13T13:00:00.000Z',
    });

    const current = wrapAsCurrent(report);
    const superseded = markRecordSuperseded(current, 'superseded', 'output-2', '2026-08-14T09:00:00.000Z');

    expect(superseded).not.toBe(current); // new wrapper
    expect(superseded.content).toBe(current.content); // same content reference — never rewritten
    expect(superseded.content).toBe(report); // literally the same frozen object
    expect(superseded.status).toBe('superseded');
    expect(superseded.supersededByOutputId).toBe('output-2');

    // The original wrapper is untouched by producing the superseded one.
    expect(current.status).toBe('current');
    expect(current.supersededAt).toBeNull();
  });

  it('supports the "source updated" reason distinctly from "superseded"', () => {
    const current = wrapAsCurrent({ slideId: 'slide-1' });
    const updated = markRecordSuperseded(current, 'source_updated', 'output-3', '2026-08-14T09:00:00.000Z');
    expect(updated.status).toBe('source_updated');
    expect(updated.content).toBe(current.content);
  });
});
