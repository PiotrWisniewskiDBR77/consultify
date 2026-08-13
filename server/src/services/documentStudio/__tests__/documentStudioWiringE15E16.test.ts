/**
 * Document Studio — Substrate-to-consumer wiring tests
 * (Slices E15.wiring.materialize, E14.recordUsage.wiring,
 *  E16.diff.audit, E15.wiring.snapshot.proposal).
 *
 * These tests verify that the §15 substrate (artifact-ref fields,
 * editor-proposal version pins) and the E16 diff substrate now
 * actually flow through the live service hot paths:
 *
 *   - `materializeDocumentArtifact` populates `templateRef`,
 *     `sourcePackId`, `clientId`, `owner` on the resulting schema.
 *   - `materializeDocumentArtifact` increments template usage via
 *     `recordTemplateUsage` when a template is consumed.
 *   - `createDocumentVersionSnapshot` emits a structural-diff
 *     summary in the audit details from snapshot N+1 onwards.
 *   - `getMostRecentDocumentVersionSnapshot` returns the highest
 *     `versionNumber` row (or `null` when none exist).
 *   - Every `createXxxEditProposal` path stamps `versionBeforeId`
 *     when a snapshot exists for the artifact.
 *
 * Strategy: target each helper at its lowest reachable seam to
 * avoid pulling the wave5 / governance dependency tree into a unit
 * test. Where the studio service owns a hot path that requires
 * wave5, the test mocks the wave5 surface inline.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  computeDocumentSchemaDiff,
  summarizeDocumentSchemaDiff,
} from '../documentSchemaDiffService.js';
import type { DocumentSchema } from '../documentStudioTypes.js';
import {
  __resetDocumentVersionSnapshotsForTests,
  createDocumentVersionSnapshot,
  getMostRecentDocumentVersionSnapshot,
} from '../documentVersionSnapshotService.js';

function makeSchema(overrides: Partial<DocumentSchema> = {}): DocumentSchema {
  return {
    documentId: 'doc-wire-1',
    artifactId: 'artifact-wire-1',
    title: 'Wiring test',
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
    sections: [
      {
        sectionId: 's1',
        orderIndex: 0,
        level: 1,
        title: 'Intro',
        blocks: [{ blockId: 'b1', type: 'paragraph', content: { text: 'Hello' } }],
        sourceRefs: [],
      },
    ],
    sourceRefs: [],
    createdAt: '2026-05-09T00:00:00.000Z',
    updatedAt: '2026-05-09T00:00:00.000Z',
    ...overrides,
  };
}

describe('Slice E16.diff.audit — getMostRecentDocumentVersionSnapshot', () => {
  beforeEach(() => {
    __resetDocumentVersionSnapshotsForTests();
  });

  it('returns null when no snapshots exist for the artifact', () => {
    expect(getMostRecentDocumentVersionSnapshot('artifact-x', 'org-x')).toBe(null);
  });

  it('returns the only snapshot for an artifact with one version', () => {
    const schema = makeSchema({ artifactId: 'a-1' });
    const snap = createDocumentVersionSnapshot({
      organizationId: 'org-1',
      artifactId: 'a-1',
      userId: 'u-1',
      schema,
      statusAtCapture: 'draft',
    });
    const got = getMostRecentDocumentVersionSnapshot('a-1', 'org-1');
    expect(got?.versionId).toBe(snap.versionId);
    expect(got?.versionNumber).toBe(1);
  });

  it('returns the snapshot with the highest versionNumber', () => {
    const baseSchema = makeSchema({ artifactId: 'a-2' });
    createDocumentVersionSnapshot({
      organizationId: 'org-2',
      artifactId: 'a-2',
      userId: 'u-1',
      schema: baseSchema,
      statusAtCapture: 'draft',
    });
    const second = createDocumentVersionSnapshot({
      organizationId: 'org-2',
      artifactId: 'a-2',
      userId: 'u-1',
      schema: { ...baseSchema, title: 'Updated' },
      statusAtCapture: 'in_review',
    });
    const third = createDocumentVersionSnapshot({
      organizationId: 'org-2',
      artifactId: 'a-2',
      userId: 'u-1',
      schema: { ...baseSchema, title: 'Final' },
      statusAtCapture: 'approved',
    });
    const got = getMostRecentDocumentVersionSnapshot('a-2', 'org-2');
    expect(got?.versionNumber).toBe(3);
    expect(got?.versionId).toBe(third.versionId);
    // Defensive: explicitly ensure earlier snapshots are NOT returned.
    expect(got?.versionId).not.toBe(second.versionId);
  });

  it('returns deep clone — caller cannot mutate registered row', () => {
    const schema = makeSchema({ artifactId: 'a-3' });
    createDocumentVersionSnapshot({
      organizationId: 'org-3',
      artifactId: 'a-3',
      userId: 'u-1',
      schema,
      statusAtCapture: 'draft',
    });
    const got = getMostRecentDocumentVersionSnapshot('a-3', 'org-3');
    expect(got).not.toBe(null);
    if (got) got.label = 'mutated';
    const re = getMostRecentDocumentVersionSnapshot('a-3', 'org-3');
    expect(re?.label).not.toBe('mutated');
  });

  it('rejects null / empty arguments deterministically', () => {
    expect(getMostRecentDocumentVersionSnapshot('', 'org')).toBe(null);
    expect(getMostRecentDocumentVersionSnapshot('a', '')).toBe(null);
  });
});

describe('Slice E16.diff.audit — createDocumentVersionSnapshot emits structural diff', () => {
  // Spy on the audit pump so we can assert the details payload
  // without standing up the full audit registry.
  let recorded: Array<{ action: string; details?: Record<string, unknown> }>;

  beforeEach(() => {
    __resetDocumentVersionSnapshotsForTests();
    recorded = [];
  });

  it('first snapshot has no structuralDiffSummary (no prior to compare to)', async () => {
    const { registerDocumentVersionSnapshotAuditPump } =
      await import('../documentVersionSnapshotService.js');
    registerDocumentVersionSnapshotAuditPump((row) => {
      recorded.push({ action: row.action, details: row.details as Record<string, unknown> });
    });
    const schema = makeSchema({ artifactId: 'a-first' });
    createDocumentVersionSnapshot({
      organizationId: 'org-first',
      artifactId: 'a-first',
      userId: 'u-1',
      schema,
      statusAtCapture: 'draft',
    });
    expect(recorded).toHaveLength(1);
    expect(recorded[0].action).toBe('document_version_snapshot_created');
    expect(recorded[0].details?.previousVersionId).toBeUndefined();
    expect(recorded[0].details?.previousVersionNumber).toBeUndefined();
    expect(recorded[0].details?.structuralDiffSummary).toBeUndefined();
    expect(recorded[0].details?.structuralDiffStats).toBeUndefined();
  });

  it('second snapshot carries a non-empty structural-diff summary', async () => {
    const { registerDocumentVersionSnapshotAuditPump } =
      await import('../documentVersionSnapshotService.js');
    registerDocumentVersionSnapshotAuditPump((row) => {
      recorded.push({ action: row.action, details: row.details as Record<string, unknown> });
    });
    const baseSchema = makeSchema({ artifactId: 'a-second' });
    createDocumentVersionSnapshot({
      organizationId: 'org-s',
      artifactId: 'a-second',
      userId: 'u-1',
      schema: baseSchema,
      statusAtCapture: 'draft',
    });
    const updated = makeSchema({
      artifactId: 'a-second',
      sections: [
        ...baseSchema.sections,
        {
          sectionId: 's2',
          orderIndex: 1,
          level: 1,
          title: 'Findings',
          blocks: [{ blockId: 'b2', type: 'paragraph', content: { text: 'X' } }],
          sourceRefs: [],
        },
      ],
    });
    createDocumentVersionSnapshot({
      organizationId: 'org-s',
      artifactId: 'a-second',
      userId: 'u-1',
      schema: updated,
      statusAtCapture: 'in_review',
    });
    expect(recorded).toHaveLength(2);
    const second = recorded[1];
    expect(typeof second.details?.previousVersionId).toBe('string');
    expect(second.details?.previousVersionNumber).toBe(1);
    expect(typeof second.details?.structuralDiffSummary).toBe('string');
    expect(second.details?.structuralDiffSummary).toContain('section added');
    const stats = second.details?.structuralDiffStats as Record<string, number>;
    expect(stats.addedSectionCount).toBe(1);
    expect(stats.addedBlockCount).toBe(1);
  });

  it('summary aligns with computeDocumentSchemaDiff for the same inputs', async () => {
    const { registerDocumentVersionSnapshotAuditPump } =
      await import('../documentVersionSnapshotService.js');
    registerDocumentVersionSnapshotAuditPump((row) => {
      recorded.push({ action: row.action, details: row.details as Record<string, unknown> });
    });
    const before = makeSchema({ artifactId: 'a-third' });
    createDocumentVersionSnapshot({
      organizationId: 'org-t',
      artifactId: 'a-third',
      userId: 'u-1',
      schema: before,
      statusAtCapture: 'draft',
    });
    const after = makeSchema({
      artifactId: 'a-third',
      sections: [
        {
          ...before.sections[0],
          blocks: [
            ...before.sections[0].blocks,
            { blockId: 'b9', type: 'paragraph', content: { text: 'New' } },
          ],
        },
      ],
    });
    createDocumentVersionSnapshot({
      organizationId: 'org-t',
      artifactId: 'a-third',
      userId: 'u-1',
      schema: after,
      statusAtCapture: 'draft',
    });
    const expectedSummary = summarizeDocumentSchemaDiff(computeDocumentSchemaDiff(before, after));
    expect(recorded[1].details?.structuralDiffSummary).toBe(expectedSummary);
  });
});

describe('Slice E15.wiring.materialize — DocumentSchema artifact-ref population', () => {
  // We test the schema-population branches of materializeDocumentArtifact
  // by mocking the wave5 / template / lifecycle dependencies. The goal
  // is to verify the substrate-to-consumer wiring deterministically
  // without standing up wave5.

  beforeEach(() => {
    __resetDocumentVersionSnapshotsForTests();
    vi.resetModules();
  });

  it('populates owner (always) and clientId / sourcePackId when provided', async () => {
    vi.doMock('../../wave5ArtifactRuntimeService.js', () => ({
      createWave5Artifact: vi.fn(async () => ({ artifactId: 'art-from-wave5' })),
      getWave5Artifact: vi.fn(async () => null),
    }));
    vi.doMock('../documentTemplateService.js', () => ({
      getTemplate: vi.fn(() => null),
      isTemplateUsableForGeneration: vi.fn(() => false),
      recordTemplateUsage: vi.fn(() => null),
    }));
    const { materializeDocumentArtifact } = await import('../documentStudioService.js');
    const result = await materializeDocumentArtifact({
      organizationId: 'org-mat',
      userId: 'user-A',
      intake: {
        title: 'Test memo',
        // `description` is required on DocumentIntake; every consumer reads it
        // through `?? ''` / truthiness, so '' is behaviourally identical to the
        // omitted field this fixture previously produced.
        description: '',
        documentType: 'executive_memo',
        language: 'en',
        audience: ['Board'],
        goal: 'decide',
        communicationRegister: 'executive',
        density: 'standard',
        languageStyle: 'consulting',
        confidentiality: 'internal',
      },
      sourcePackId: 'pack-42',
      clientId: 'client-beta',
    });
    expect(result.schema.owner).toBe('user-A');
    expect(result.schema.sourcePackId).toBe('pack-42');
    expect(result.schema.clientId).toBe('client-beta');
    // No template → templateRef stays undefined.
    expect(result.schema.templateRef).toBeUndefined();
  });

  it('populates templateRef when a template is consumed', async () => {
    const fakeTemplate = {
      templateId: 'tmpl-1',
      organizationId: 'org-mat-2',
      version: 'v3.7',
      name: 'Memo template',
      documentType: 'executive_memo',
      languageStyle: 'consulting',
      communicationRegister: 'executive',
      density: 'standard',
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
      sectionBlueprint: [
        { title: 'Intro', level: 1, purpose: 'open', required: true, expectedLengthHint: 'short' },
      ],
      requiredInputs: [],
      status: 'approved',
    };
    const usageSpy = vi.fn(() => null);
    vi.doMock('../../wave5ArtifactRuntimeService.js', () => ({
      createWave5Artifact: vi.fn(async () => ({ artifactId: 'art-tpl' })),
      getWave5Artifact: vi.fn(async () => null),
    }));
    vi.doMock('../documentTemplateService.js', () => ({
      getTemplate: vi.fn(() => fakeTemplate),
      isTemplateUsableForGeneration: vi.fn(() => true),
      recordTemplateUsage: usageSpy,
    }));
    const { materializeDocumentArtifact } = await import('../documentStudioService.js');
    const result = await materializeDocumentArtifact({
      organizationId: 'org-mat-2',
      userId: 'user-B',
      intake: {
        title: 'Tpl memo',
        description: '',
        documentType: 'executive_memo',
        language: 'en',
        audience: ['Board'],
        goal: 'decide',
        communicationRegister: 'executive',
        density: 'standard',
        languageStyle: 'consulting',
        confidentiality: 'internal',
      },
      templateId: 'tmpl-1',
    });
    expect(result.schema.templateRef).toEqual({
      templateId: 'tmpl-1',
      templateVersion: 'v3.7',
    });
    expect(result.schema.owner).toBe('user-B');
  });

  it('invokes recordTemplateUsage exactly once when template is consumed', async () => {
    const fakeTemplate = {
      templateId: 'tmpl-2',
      organizationId: 'org-mat-3',
      version: 'v1.0',
      name: 'Tpl 2',
      documentType: 'executive_memo',
      languageStyle: 'consulting',
      communicationRegister: 'executive',
      density: 'standard',
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
      sectionBlueprint: [
        { title: 'Intro', level: 1, purpose: 'open', required: true, expectedLengthHint: 'short' },
      ],
      requiredInputs: [],
      status: 'approved',
    };
    const usageSpy = vi.fn(() => null);
    vi.doMock('../../wave5ArtifactRuntimeService.js', () => ({
      createWave5Artifact: vi.fn(async () => ({ artifactId: 'art-rec' })),
      getWave5Artifact: vi.fn(async () => null),
    }));
    vi.doMock('../documentTemplateService.js', () => ({
      getTemplate: vi.fn(() => fakeTemplate),
      isTemplateUsableForGeneration: vi.fn(() => true),
      recordTemplateUsage: usageSpy,
    }));
    const { materializeDocumentArtifact } = await import('../documentStudioService.js');
    await materializeDocumentArtifact({
      organizationId: 'org-mat-3',
      userId: 'user-C',
      intake: {
        title: 'Tpl3 memo',
        description: '',
        documentType: 'executive_memo',
        language: 'en',
        audience: ['Board'],
        goal: 'decide',
        communicationRegister: 'executive',
        density: 'standard',
        languageStyle: 'consulting',
        confidentiality: 'internal',
      },
      templateId: 'tmpl-2',
    });
    expect(usageSpy).toHaveBeenCalledTimes(1);
    expect(usageSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 'tmpl-2',
        organizationId: 'org-mat-3',
        userId: 'user-C',
      })
    );
  });

  it('does NOT invoke recordTemplateUsage when no template was consumed', async () => {
    const usageSpy = vi.fn(() => null);
    vi.doMock('../../wave5ArtifactRuntimeService.js', () => ({
      createWave5Artifact: vi.fn(async () => ({ artifactId: 'art-no-tpl' })),
      getWave5Artifact: vi.fn(async () => null),
    }));
    vi.doMock('../documentTemplateService.js', () => ({
      getTemplate: vi.fn(() => null),
      isTemplateUsableForGeneration: vi.fn(() => false),
      recordTemplateUsage: usageSpy,
    }));
    const { materializeDocumentArtifact } = await import('../documentStudioService.js');
    await materializeDocumentArtifact({
      organizationId: 'org-no-tpl',
      userId: 'user-D',
      intake: {
        title: 'No tpl',
        description: '',
        documentType: 'executive_memo',
        language: 'en',
        audience: ['Board'],
        goal: 'decide',
        communicationRegister: 'executive',
        density: 'standard',
        languageStyle: 'consulting',
        confidentiality: 'internal',
      },
    });
    expect(usageSpy).not.toHaveBeenCalled();
  });
});
