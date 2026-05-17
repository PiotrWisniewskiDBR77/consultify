/**
 * Document Studio — Slice E5.6.qa.hard — hard-drift integration tests.
 *
 * Builds on the soft-drift coverage from `documentQaSourceDrift.test.ts`
 * by exercising the registry-aware HARD-drift path:
 *
 *   - When a `DocumentSourceRef` is pinned to a `sourceVersion` and
 *     the per-tenant registry has since recorded a NEWER version,
 *     `runDocumentQa(..., { organizationId })` emits a
 *     `source_drift_hard` finding at `medium` severity (advisory,
 *     non-blocking).
 *   - When pinned matches the latest known version, no finding fires.
 *   - When the registry has no observation for the tuple (e.g. ad-hoc
 *     pin, no source pack ingestion), no hard-drift finding fires —
 *     the soft-drift / unpinned path remains the right surface.
 *   - When `organizationId` is omitted in `runDocumentQa` options,
 *     the hard-drift path is skipped entirely (backward compat for
 *     callers that don't have a tenant context).
 *   - Tenant isolation: an observation in `org-A` does NOT influence
 *     a `runDocumentQa` call against `org-B`.
 *
 * The summary line for `source_drift` is also exercised so the
 * audit / right-panel surface displays a precise "X hard-drift,
 * Y unpinned" breakdown.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { runDocumentQa } from '../documentQaService.js';
import {
  __resetSourceVersionRegistryForTests,
  recordSeenSourceVersion,
} from '../documentSourceVersionRegistryService.js';
import type { DocumentSchema } from '../documentStudioTypes.js';

function makeSchema(overrides: Partial<DocumentSchema> = {}): DocumentSchema {
  return {
    documentId: 'doc-hard-drift-1',
    artifactId: 'artifact-hard-drift-1',
    title: 'Hard-drift Test',
    documentType: 'executive_memo',
    language: 'en',
    audience: ['Board'],
    goal: 'decide',
    communicationRegister: 'executive',
    density: 'standard',
    languageStyle: 'consulting',
    confidentiality: 'internal',
    formattingSchema: {
      fonts: { body: 'Aptos 11', heading: 'Aptos Display' },
      headingStyles: { h1: 'h1', h2: 'h2', h3: 'h3' },
      tableStyles: { default: 'default' },
      listStyles: { bullet: 'bullet', numbered: 'numbered' },
      page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2, right: 2 } },
      headers: { enabled: true },
      footers: { enabled: true, pageNumbering: true, confidentialityLabel: true },
      toc: false,
      coverPage: false,
      appendixStyle: 'none',
      citationStyle: 'inline_marker',
    },
    sections: [],
    sourceRefs: [],
    createdAt: '2026-05-09T00:00:00.000Z',
    updatedAt: '2026-05-09T00:00:00.000Z',
    ...overrides,
  };
}

describe('Slice E5.6.qa.hard — runDocumentQa hard-drift wiring', () => {
  afterEach(() => {
    __resetSourceVersionRegistryForTests();
  });

  it('emits source_drift_hard when pinned ref is older than the latest registry observation', () => {
    // Registry has seen v1 then v2 for (transcript, src-1) under org-A.
    recordSeenSourceVersion({
      organizationId: 'org-A',
      sourceType: 'transcript',
      sourceId: 'src-1',
      sourceVersion: 'v1',
      recordedAt: '2026-01-01T00:00:00.000Z',
    });
    recordSeenSourceVersion({
      organizationId: 'org-A',
      sourceType: 'transcript',
      sourceId: 'src-1',
      sourceVersion: 'v2',
      recordedAt: '2026-02-01T00:00:00.000Z',
    });

    const schema = makeSchema({
      sourceRefs: [
        {
          sourceType: 'transcript',
          sourceId: 'src-1',
          sourceTitle: 'Q1 board interview',
          sourceVersion: 'v1', // stale pin
        },
      ],
    });
    const report = runDocumentQa(schema, { organizationId: 'org-A' });
    const drift = report.categories.find((c) => c.category === 'source_drift');
    if (!drift) throw new Error('expected source_drift category');
    const hardFindings = drift.findings.filter((f) => f.code === 'source_drift_hard');
    expect(hardFindings).toHaveLength(1);
    expect(hardFindings[0].severity).toBe('medium');
    // Summary line carries the breakdown.
    expect(drift.summary).toContain('hard-drift');
    expect(drift.blocking).toBe(false); // advisory only
  });

  it('does not emit source_drift_hard when pinned ref matches the latest registry observation', () => {
    recordSeenSourceVersion({
      organizationId: 'org-A',
      sourceType: 'transcript',
      sourceId: 'src-1',
      sourceVersion: 'v3',
    });
    const schema = makeSchema({
      sourceRefs: [
        {
          sourceType: 'transcript',
          sourceId: 'src-1',
          sourceTitle: 'Aligned interview',
          sourceVersion: 'v3',
        },
      ],
    });
    const report = runDocumentQa(schema, { organizationId: 'org-A' });
    const drift = report.categories.find((c) => c.category === 'source_drift');
    if (!drift) throw new Error('expected source_drift category');
    expect(drift.findings.filter((f) => f.code === 'source_drift_hard')).toHaveLength(0);
    // Pinned + in-sync + no other refs → fully clean category.
    expect(drift.findings).toHaveLength(0);
    expect(drift.score).toBe(100);
  });

  it('does not emit hard-drift when the registry has no observation for the tuple', () => {
    // No recordSeenSourceVersion calls — registry empty.
    const schema = makeSchema({
      sourceRefs: [
        {
          sourceType: 'transcript',
          sourceId: 'unknown-src',
          sourceTitle: 'Ad-hoc reference',
          sourceVersion: 'v1',
        },
      ],
    });
    const report = runDocumentQa(schema, { organizationId: 'org-A' });
    const drift = report.categories.find((c) => c.category === 'source_drift');
    if (!drift) throw new Error('expected source_drift category');
    expect(drift.findings.filter((f) => f.code === 'source_drift_hard')).toHaveLength(0);
  });

  it('skips hard-drift entirely when organizationId is not supplied', () => {
    // Registry has v2 for (transcript, src-1) under org-A.
    recordSeenSourceVersion({
      organizationId: 'org-A',
      sourceType: 'transcript',
      sourceId: 'src-1',
      sourceVersion: 'v2',
    });
    const schema = makeSchema({
      sourceRefs: [
        {
          sourceType: 'transcript',
          sourceId: 'src-1',
          sourceTitle: 'Stale, but no tenant ctx',
          sourceVersion: 'v1',
        },
      ],
    });
    // No organizationId → hard-drift skipped, ref is treated as
    // pinned (no soft drift either).
    const report = runDocumentQa(schema);
    const drift = report.categories.find((c) => c.category === 'source_drift');
    if (!drift) throw new Error('expected source_drift category');
    expect(drift.findings).toHaveLength(0);
  });

  it('keeps hard-drift findings tenant-isolated', () => {
    // org-A has seen v2; org-B has only seen v1.
    recordSeenSourceVersion({
      organizationId: 'org-A',
      sourceType: 'transcript',
      sourceId: 'src-1',
      sourceVersion: 'v2',
      recordedAt: '2026-02-01T00:00:00.000Z',
    });
    recordSeenSourceVersion({
      organizationId: 'org-B',
      sourceType: 'transcript',
      sourceId: 'src-1',
      sourceVersion: 'v1',
      recordedAt: '2026-01-01T00:00:00.000Z',
    });
    const schema = makeSchema({
      sourceRefs: [
        {
          sourceType: 'transcript',
          sourceId: 'src-1',
          sourceTitle: 'Cross-tenant test',
          sourceVersion: 'v1',
        },
      ],
    });

    // org-A view: pinned v1, latest v2 → hard drift.
    const reportA = runDocumentQa(schema, { organizationId: 'org-A' });
    const driftA = reportA.categories.find((c) => c.category === 'source_drift');
    if (!driftA) throw new Error('expected drift cat');
    expect(driftA.findings.filter((f) => f.code === 'source_drift_hard')).toHaveLength(1);

    // org-B view: pinned v1 == latest v1 → no hard drift.
    const reportB = runDocumentQa(schema, { organizationId: 'org-B' });
    const driftB = reportB.categories.find((c) => c.category === 'source_drift');
    if (!driftB) throw new Error('expected drift cat');
    expect(driftB.findings.filter((f) => f.code === 'source_drift_hard')).toHaveLength(0);
  });

  it('combines hard-drift and unpinned counts in the summary line', () => {
    recordSeenSourceVersion({
      organizationId: 'org-A',
      sourceType: 'transcript',
      sourceId: 'src-1',
      sourceVersion: 'v2',
    });
    const schema = makeSchema({
      sourceRefs: [
        {
          sourceType: 'transcript',
          sourceId: 'src-1',
          sourceTitle: 'Stale pin',
          sourceVersion: 'v1', // hard drift
        },
        {
          sourceType: 'transcript',
          sourceId: 'src-2',
          sourceTitle: 'Unpinned',
          // no sourceVersion / sourceSnapshotId → unpinned
        },
      ],
    });
    const report = runDocumentQa(schema, { organizationId: 'org-A' });
    const drift = report.categories.find((c) => c.category === 'source_drift');
    if (!drift) throw new Error('expected drift cat');
    expect(drift.summary).toContain('hard-drift');
    expect(drift.summary).toContain('unpinned');
    expect(drift.findings.filter((f) => f.code === 'source_drift_hard')).toHaveLength(1);
    expect(drift.findings.filter((f) => f.code === 'source_drift_unpinned')).toHaveLength(1);
    expect(drift.blocking).toBe(false);
  });
});
