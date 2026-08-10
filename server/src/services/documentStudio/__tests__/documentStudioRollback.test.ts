/**
 * Document Studio — Rollback orchestrator tests (Epic E5, Slice 5.3).
 *
 * Covers `rollbackDocumentToVersion`:
 *   - Restores the target snapshot's schema as the active schema.
 *   - Captures a `rollback_revert` snapshot of the live state before
 *     overwriting it (so rollback is itself reversible).
 *   - Forces lifecycle to `'draft'` regardless of the prior state
 *     (system bypass) and emits a `document_status_changed` audit row
 *     with `details.system: 'rollback'`.
 *   - Emits a `document_rolled_back` audit row with the target
 *     versionId, the revert snapshot's versionId, and the lifecycle
 *     statuses before / after.
 *   - Errors with stable codes:
 *       'invalid_input'      — missing field
 *       'snapshot_not_found' — versionId unknown OR cross-tenant
 *       'tenant_mismatch'    — snapshot belongs to a different artifact
 *       'document_not_found' — wave5 returns null
 *
 * Mocks `wave5ArtifactRuntimeService` so the test stays a pure unit.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentSchema } from '../documentStudioTypes.js';

// Typed against the contract: the literal widened every enum field to `string`
// and carried two non-members ('medium', 'consulting_neutral').
const liveSchema: DocumentSchema = {
  documentId: 'doc-rb',
  artifactId: 'artifact-rb-1',
  title: 'Live title v3',
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
  createWave5Artifact: vi.fn(async () => ({ artifact_id: 'artifact-rb-1' })),
  getWave5Artifact: vi.fn(async (artifactId: string) => {
    if (artifactId === 'missing') return null;
    return {
      artifact_id: artifactId,
      content_json: liveSchema,
      metadata_json: { documentStudioSchema: liveSchema },
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
  __resetSchemaOverlayForTests,
  createDocumentSnapshot,
  DocumentRollbackError,
  getDocumentArtifact,
  getDocumentLifecycleState,
  listDocumentAuditEntries,
  listDocumentVersionSnapshots,
  rollbackDocumentToVersion,
  transitionDocumentStatus,
} from '../documentStudioService.js';
import { __resetDocumentVersionSnapshotsForTests } from '../documentVersionSnapshotService.js';

const ORG = 'org-rb';
const ORG_OTHER = 'org-rb-other';
const USER = 'user-rb';
const ARTIFACT = 'artifact-rb-1';

beforeEach(async () => {
  await __resetDocumentLifecycleForTests();
  __resetDocumentVersionSnapshotsForTests();
  __resetSchemaOverlayForTests();
  initializeDocumentLifecycle({
    organizationId: ORG,
    artifactId: ARTIFACT,
    actorId: USER,
  });
  liveSchema.title = 'Live title v3';
});

afterEach(async () => {
  await __resetDocumentLifecycleForTests();
  __resetDocumentVersionSnapshotsForTests();
  __resetSchemaOverlayForTests();
});

describe('rollbackDocumentToVersion — happy path', () => {
  it('restores the target snapshot and writes a rollback_revert snapshot first', async () => {
    // Capture v1 explicitly while the title is "Live title v3" but
    // we'll mutate the live schema to v_live before rolling back to v1.
    liveSchema.title = 'v1 cleared';
    const v1 = await createDocumentSnapshot({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
      label: 'cleared draft',
    });
    liveSchema.title = 'v_live_after_v1';

    const result = await rollbackDocumentToVersion({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
      versionId: v1.versionId,
      reason: 'reverting unauthorized edits',
    });

    expect(result.restoredFrom.versionId).toBe(v1.versionId);
    expect(result.schema.title).toBe('v1 cleared');
    expect(result.revertSnapshot.origin).toBe('rollback_revert');
    expect(result.revertSnapshot.schema.title).toBe('v_live_after_v1');

    // The next read sees the rolled-back schema via the overlay.
    const reread = await getDocumentArtifact(ARTIFACT, ORG);
    expect(reread!.title).toBe('v1 cleared');
  });

  it('forces lifecycle to draft regardless of prior state (system bypass)', async () => {
    liveSchema.title = 'snapshot title';
    const snap = await createDocumentSnapshot({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
    });
    transitionDocumentStatus({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
      to: 'in_review',
    });
    transitionDocumentStatus({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
      to: 'approved',
    });
    transitionDocumentStatus({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
      to: 'published',
    });
    // ALLOWED_TRANSITIONS forbids published → draft normally; rollback
    // bypass must allow this so the document re-enters the editor flow.
    const result = await rollbackDocumentToVersion({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
      versionId: snap.versionId,
    });
    expect(result.lifecycle.status).toBe('draft');
    const live = getDocumentLifecycleState(ARTIFACT, ORG);
    expect(live!.status).toBe('draft');
    // The transition history should record the published → draft jump.
    expect(live!.history.at(-1)).toMatchObject({ from: 'published', to: 'draft' });
  });

  it('emits a system-flagged document_status_changed entry and a document_rolled_back entry', async () => {
    const snap = await createDocumentSnapshot({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
    });
    transitionDocumentStatus({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
      to: 'in_review',
    });

    const result = await rollbackDocumentToVersion({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
      versionId: snap.versionId,
      reason: 'critical fix',
    });

    const audit = listDocumentAuditEntries(ARTIFACT, ORG);
    const rollbackEntry = audit.find(
      (a) =>
        a.action === 'document_rolled_back' &&
        (a.details as { restoredFromVersionId?: string } | undefined)?.restoredFromVersionId ===
          snap.versionId
    );
    expect(rollbackEntry).toBeDefined();
    const details = rollbackEntry!.details as Record<string, unknown>;
    expect(details.statusBeforeRollback).toBe('in_review');
    expect(details.statusAfterRollback).toBe('draft');
    expect(details.reason).toBe('critical fix');
    expect(details.revertSnapshotVersionId).toBe(result.revertSnapshot.versionId);

    // Audit store is process-scoped (no per-test reset hook), so pick
    // the LATEST system-flagged status change to dodge cross-test leak.
    const systemStatusEntries = audit.filter(
      (a) =>
        a.action === 'document_status_changed' &&
        (a.details as { system?: string } | undefined)?.system === 'rollback'
    );
    expect(systemStatusEntries.length).toBeGreaterThan(0);
    const latest = systemStatusEntries.at(-1)!;
    expect((latest.details as Record<string, unknown>).from).toBe('in_review');
    expect((latest.details as Record<string, unknown>).to).toBe('draft');
  });

  it('places the rollback_revert snapshot in the listing as the latest version', async () => {
    const v1 = await createDocumentSnapshot({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
      label: 'v1',
    });
    await rollbackDocumentToVersion({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
      versionId: v1.versionId,
    });
    const list = listDocumentVersionSnapshots(ARTIFACT, ORG);
    // v1 manual + revert snapshot taken right before applying the rollback.
    expect(list).toHaveLength(2);
    expect(list[1]!.origin).toBe('rollback_revert');
    expect(list[1]!.versionNumber).toBe(2);
  });
});

describe('rollbackDocumentToVersion — error vocabulary', () => {
  it('invalid_input on missing required fields', async () => {
    await expect(
      rollbackDocumentToVersion({
        organizationId: '',
        artifactId: ARTIFACT,
        userId: USER,
        versionId: 'whatever',
      })
    ).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(
      rollbackDocumentToVersion({
        organizationId: ORG,
        artifactId: '',
        userId: USER,
        versionId: 'whatever',
      })
    ).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(
      rollbackDocumentToVersion({
        organizationId: ORG,
        artifactId: ARTIFACT,
        userId: USER,
        versionId: '',
      })
    ).rejects.toMatchObject({ code: 'invalid_input' });
  });

  it('snapshot_not_found for unknown versionId', async () => {
    await expect(
      rollbackDocumentToVersion({
        organizationId: ORG,
        artifactId: ARTIFACT,
        userId: USER,
        versionId: 'does-not-exist',
      })
    ).rejects.toMatchObject({ code: 'snapshot_not_found' });
  });

  it('snapshot_not_found for cross-tenant versionId (does not leak existence)', async () => {
    const snap = await createDocumentSnapshot({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
    });
    initializeDocumentLifecycle({
      organizationId: ORG_OTHER,
      artifactId: ARTIFACT,
      actorId: USER,
    });
    await expect(
      rollbackDocumentToVersion({
        organizationId: ORG_OTHER,
        artifactId: ARTIFACT,
        userId: USER,
        versionId: snap.versionId,
      })
    ).rejects.toMatchObject({ code: 'snapshot_not_found' });
  });

  it('tenant_mismatch when the snapshot belongs to a different artifact', async () => {
    initializeDocumentLifecycle({
      organizationId: ORG,
      artifactId: 'artifact-rb-2',
      actorId: USER,
    });
    // Capture a snapshot for artifact-rb-1, then try to apply it to
    // artifact-rb-2. The mocked wave5 returns the same liveSchema
    // shape for both artifactIds — that's fine; we want the tenant /
    // artifact mismatch to be caught BEFORE the schema read.
    const snap = await createDocumentSnapshot({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
    });
    await expect(
      rollbackDocumentToVersion({
        organizationId: ORG,
        artifactId: 'artifact-rb-2',
        userId: USER,
        versionId: snap.versionId,
      })
    ).rejects.toMatchObject({ code: 'tenant_mismatch' });
  });

  it('document_not_found when wave5 has no row for the artifact', async () => {
    initializeDocumentLifecycle({
      organizationId: ORG,
      artifactId: 'missing',
      actorId: USER,
    });
    const snap = await createDocumentSnapshot({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
    });
    await expect(
      rollbackDocumentToVersion({
        organizationId: ORG,
        artifactId: 'missing',
        userId: USER,
        versionId: snap.versionId,
      })
    ).rejects.toMatchObject({ code: 'tenant_mismatch' });
    // Same versionId on artifact 'missing' fails the artifact check
    // first; create a snapshot OWNED BY 'missing' to exercise the
    // document_not_found path explicitly.
    liveSchema.title = 'snapshot for missing';
    // Capture using a temporary live schema; the wave5 mock returns
    // null only for artifactId === 'missing', so the snapshot service
    // can still snapshot freely as long as the orchestrator can read
    // the schema. We bypass the orchestrator and use the raw service:
    const { createDocumentVersionSnapshot } = await import('../documentVersionSnapshotService.js');
    const directSnap = createDocumentVersionSnapshot({
      organizationId: ORG,
      artifactId: 'missing',
      userId: USER,
      schema: { ...liveSchema, artifactId: 'missing' },
      statusAtCapture: 'draft',
    });
    await expect(
      rollbackDocumentToVersion({
        organizationId: ORG,
        artifactId: 'missing',
        userId: USER,
        versionId: directSnap.versionId,
      })
    ).rejects.toMatchObject({ code: 'document_not_found' });
  });
});

describe('rollbackDocumentToVersion — rollback is itself reversible', () => {
  it('the revert snapshot can be applied to roll forward again', async () => {
    liveSchema.title = 'v1 cleared';
    const v1 = await createDocumentSnapshot({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
    });
    liveSchema.title = 'v_live (mutations on top of v1)';
    const rolled = await rollbackDocumentToVersion({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
      versionId: v1.versionId,
    });
    expect(rolled.schema.title).toBe('v1 cleared');

    // Now roll forward by applying the revert snapshot.
    const rolledForward = await rollbackDocumentToVersion({
      organizationId: ORG,
      artifactId: ARTIFACT,
      userId: USER,
      versionId: rolled.revertSnapshot.versionId,
    });
    expect(rolledForward.schema.title).toBe('v_live (mutations on top of v1)');
  });
});
