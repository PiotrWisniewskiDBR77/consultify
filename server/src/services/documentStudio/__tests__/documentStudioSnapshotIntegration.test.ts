/**
 * Document Studio — Snapshot orchestrator integration test
 * (Epic E5, Slice 5.2).
 *
 * Covers `createDocumentSnapshot` (the studio-service-level resolver
 * that reads the live schema from wave5 and forwards it to the
 * snapshot service):
 *   - Resolves the live schema and passes it to the snapshot service
 *     with the captured lifecycle status.
 *   - Throws document_not_found when wave5 returns null.
 *   - The snapshot is independent of subsequent edits to the live
 *     schema (deep-clone semantics).
 *   - Audit trail visible via listDocumentAuditEntries on the artifact.
 *
 * Mocks `wave5ArtifactRuntimeService` so the test stays a pure unit
 * (mirrors the documentStudioPreflight pattern already on disk).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const liveSchemaState = {
  title: 'Original',
  documentId: 'doc-snap-1',
  artifactId: 'artifact-snap-1',
  documentType: 'executive_memo',
  language: 'en',
  audience: ['Board'],
  goal: 'decide',
  communicationRegister: 'executive',
  density: 'medium',
  languageStyle: 'consulting_neutral',
  confidentiality: 'internal',
  formattingSchema: {
    fonts: { body: 'Aptos 11', heading: 'Aptos Display' },
    headingStyles: { h1: '16pt bold', h2: '13pt bold', h3: '11pt bold' },
    tableStyles: { default: 'consultify_clean_table' },
    listStyles: { bullet: 'consultify_bullet', numbered: 'consultify_numbered' },
    page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2.3, right: 2.3 } },
    headers: { enabled: true },
    footers: { enabled: true, pageNumbering: true, confidentialityLabel: true },
    toc: true,
    coverPage: true,
    appendixStyle: 'lettered',
    citationStyle: 'inline_marker',
  },
  sections: [],
  sourceRefs: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

vi.mock('../../wave5ArtifactRuntimeService.js', () => ({
  createWave5Artifact: vi.fn(async () => ({ artifact_id: 'artifact-snap-1' })),
  getWave5Artifact: vi.fn(async (artifactId: string) => {
    if (artifactId === 'missing') return null;
    return {
      artifact_id: artifactId,
      content_json: liveSchemaState,
      metadata_json: { documentStudioSchema: liveSchemaState },
    };
  }),
  buildWave5ExportManifest: vi.fn(),
  markWave5ArtifactExported: vi.fn(),
}));

import {
  __resetDocumentLifecycleForTests,
  initializeDocumentLifecycle,
} from '../documentLifecycleService.js';
import {
  createDocumentSnapshot,
  listDocumentAuditEntries,
  listDocumentVersionSnapshots,
  transitionDocumentStatus,
} from '../documentStudioService.js';
import { __resetDocumentVersionSnapshotsForTests } from '../documentVersionSnapshotService.js';

const ORG = 'org-snap';
const USER = 'user-snap';
const ARTIFACT = 'artifact-snap-1';

beforeEach(() => {
  __resetDocumentLifecycleForTests();
  __resetDocumentVersionSnapshotsForTests();
  initializeDocumentLifecycle({
    organizationId: ORG,
    artifactId: ARTIFACT,
    actorId: USER,
  });
  liveSchemaState.title = 'Original';
});

afterEach(() => {
  __resetDocumentLifecycleForTests();
  __resetDocumentVersionSnapshotsForTests();
});

describe('createDocumentSnapshot (studio service integration)', () => {
  it('captures the current live schema and records the lifecycle status', async () => {
    const snap = await createDocumentSnapshot({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
      label: 'baseline',
    });
    expect(snap.versionNumber).toBe(1);
    expect(snap.schema.title).toBe('Original');
    expect(snap.statusAtCapture).toBe('draft');
    expect(snap.label).toBe('baseline');
    expect(snap.origin).toBe('manual');
  });

  it('reflects the lifecycle status at capture time, not the historical state', async () => {
    transitionDocumentStatus({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
      to: 'in_review',
    });
    const snap = await createDocumentSnapshot({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
    });
    expect(snap.statusAtCapture).toBe('in_review');
  });

  it('captures a deep clone — subsequent edits to the live schema do not affect the snapshot', async () => {
    const snap = await createDocumentSnapshot({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
    });
    liveSchemaState.title = 'Mutated after snapshot';
    expect(snap.schema.title).toBe('Original');
    const list = listDocumentVersionSnapshots(ARTIFACT, ORG);
    expect(list[0]!.schema.title).toBe('Original');
  });

  it('throws document_not_found when wave5 returns null', async () => {
    await expect(
      createDocumentSnapshot({
        organizationId: ORG,
        artifactId: 'missing',
        userId: USER,
      })
    ).rejects.toThrowError(/document_not_found/);
  });

  it('lands a document_version_snapshot_created audit entry on the artifact', async () => {
    const captured = await createDocumentSnapshot({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
      reason: 'pre-board snapshot',
    });
    const audit = listDocumentAuditEntries(ARTIFACT, ORG);
    // The studio service's audit store is not test-reset; find the
    // entry that matches the snapshot we just produced via versionId.
    const snapAudit = audit.find(
      (a) =>
        a.action === 'document_version_snapshot_created' &&
        (a.details as { versionId?: string } | undefined)?.versionId === captured.versionId
    );
    expect(snapAudit).toBeDefined();
    expect((snapAudit?.details as { reason?: string } | undefined)?.reason).toBe(
      'pre-board snapshot'
    );
  });

  it('honors explicit origin override (auto_status_change / rollback_revert)', async () => {
    const auto = await createDocumentSnapshot({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
      origin: 'auto_status_change',
    });
    expect(auto.origin).toBe('auto_status_change');
  });
});
