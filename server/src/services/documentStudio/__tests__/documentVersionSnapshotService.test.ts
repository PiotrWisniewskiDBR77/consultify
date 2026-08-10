/**
 * Document Studio — Document Version Snapshot service tests
 * (Epic E5, Slice 5.2).
 *
 * Covers the snapshot capture surface independently of the studio
 * orchestrator (the orchestrator integration ships in
 * documentStudioSnapshotIntegration.test.ts).
 *
 *   - createDocumentVersionSnapshot increments versionNumber per
 *     artifact and clones the schema deeply so callers cannot mutate
 *     the captured copy.
 *   - listDocumentVersionSnapshots and getDocumentVersionSnapshot are
 *     tenant-scoped (cross-tenant returns [] / null).
 *   - Origin propagates ('manual' / 'auto_status_change' /
 *     'rollback_revert').
 *   - Audit pump receives one entry per snapshot with the versionId,
 *     versionNumber, origin and statusAtCapture in details.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import type { DocumentAuditEntry, DocumentSchema, DocumentStatus } from '../documentStudioTypes.js';
import {
  __resetDocumentVersionSnapshotsForTests,
  createDocumentVersionSnapshot,
  getDocumentVersionSnapshot,
  getDocumentVersionSnapshotByNumber,
  listDocumentVersionSnapshots,
  registerDocumentVersionSnapshotAuditPump,
} from '../documentVersionSnapshotService.js';

const ORG_A = 'org-A';
const ORG_B = 'org-B';
const USER = 'user-1';

function fakeSchema(overrides: Partial<DocumentSchema> = {}): DocumentSchema {
  return {
    documentId: 'doc-1',
    artifactId: 'artifact-1',
    title: 'Q3 Memo',
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
    documentStatus: 'draft' satisfies DocumentStatus,
    ...overrides,
  };
}

let auditPumpSpy: Mock<(entry: DocumentAuditEntry) => void>;

beforeEach(() => {
  __resetDocumentVersionSnapshotsForTests();
  auditPumpSpy = vi.fn();
  registerDocumentVersionSnapshotAuditPump((entry: DocumentAuditEntry) => {
    auditPumpSpy(entry);
  });
});

afterEach(() => {
  __resetDocumentVersionSnapshotsForTests();
});

describe('createDocumentVersionSnapshot', () => {
  it('starts versionNumber at 1 and increments per artifact', () => {
    const a1 = createDocumentVersionSnapshot({
      organizationId: ORG_A,
      artifactId: 'artifact-1',
      userId: USER,
      schema: fakeSchema({ artifactId: 'artifact-1' }),
      statusAtCapture: 'draft',
    });
    const a2 = createDocumentVersionSnapshot({
      organizationId: ORG_A,
      artifactId: 'artifact-1',
      userId: USER,
      schema: fakeSchema({ artifactId: 'artifact-1', title: 'Q3 Memo v2' }),
      statusAtCapture: 'in_review',
    });
    const b1 = createDocumentVersionSnapshot({
      organizationId: ORG_A,
      artifactId: 'artifact-2',
      userId: USER,
      schema: fakeSchema({ artifactId: 'artifact-2' }),
      statusAtCapture: 'draft',
    });
    expect(a1.versionNumber).toBe(1);
    expect(a2.versionNumber).toBe(2);
    expect(b1.versionNumber).toBe(1);
  });

  it('defaults origin to manual and records the captured lifecycle status', () => {
    const snap = createDocumentVersionSnapshot({
      organizationId: ORG_A,
      artifactId: 'artifact-1',
      userId: USER,
      schema: fakeSchema(),
      statusAtCapture: 'approved',
    });
    expect(snap.origin).toBe('manual');
    expect(snap.statusAtCapture).toBe('approved');
  });

  it('honors explicit origin (auto_status_change, rollback_revert)', () => {
    const auto = createDocumentVersionSnapshot({
      organizationId: ORG_A,
      artifactId: 'a',
      userId: USER,
      schema: fakeSchema(),
      statusAtCapture: 'approved',
      origin: 'auto_status_change',
    });
    const revert = createDocumentVersionSnapshot({
      organizationId: ORG_A,
      artifactId: 'b',
      userId: USER,
      schema: fakeSchema(),
      statusAtCapture: 'draft',
      origin: 'rollback_revert',
    });
    expect(auto.origin).toBe('auto_status_change');
    expect(revert.origin).toBe('rollback_revert');
  });

  it('captures a deep clone of the schema (mutating the source does not change the snapshot)', () => {
    const schema = fakeSchema({ title: 'original title' });
    const snap = createDocumentVersionSnapshot({
      organizationId: ORG_A,
      artifactId: 'artifact-1',
      userId: USER,
      schema,
      statusAtCapture: 'draft',
    });
    schema.title = 'mutated after capture';
    const fetched = getDocumentVersionSnapshot(snap.versionId, ORG_A);
    expect(fetched!.schema.title).toBe('original title');
  });

  it('emits one audit entry per snapshot with versionId / origin / statusAtCapture in details', () => {
    auditPumpSpy.mockClear();
    const snap = createDocumentVersionSnapshot({
      organizationId: ORG_A,
      artifactId: 'artifact-1',
      userId: USER,
      schema: fakeSchema(),
      statusAtCapture: 'in_review',
      label: 'pre-approval',
      reason: 'snapshot before clearing the memo',
    });
    expect(auditPumpSpy).toHaveBeenCalledTimes(1);
    const entry = auditPumpSpy.mock.calls[0]![0] as DocumentAuditEntry;
    expect(entry.action).toBe('document_version_snapshot_created');
    const details = entry.details as Record<string, unknown>;
    expect(details.versionId).toBe(snap.versionId);
    expect(details.versionNumber).toBe(1);
    expect(details.origin).toBe('manual');
    expect(details.statusAtCapture).toBe('in_review');
    expect(details.label).toBe('pre-approval');
  });

  it('rejects calls without organizationId / artifactId / userId / schema', () => {
    expect(() =>
      createDocumentVersionSnapshot({
        organizationId: '',
        artifactId: 'a',
        userId: USER,
        schema: fakeSchema(),
        statusAtCapture: 'draft',
      })
    ).toThrow(/organizationId/);
    expect(() =>
      createDocumentVersionSnapshot({
        organizationId: ORG_A,
        artifactId: '',
        userId: USER,
        schema: fakeSchema(),
        statusAtCapture: 'draft',
      })
    ).toThrow(/artifactId/);
    expect(() =>
      createDocumentVersionSnapshot({
        organizationId: ORG_A,
        artifactId: 'a',
        userId: '',
        schema: fakeSchema(),
        statusAtCapture: 'draft',
      })
    ).toThrow(/userId/);
    expect(() =>
      createDocumentVersionSnapshot({
        organizationId: ORG_A,
        artifactId: 'a',
        userId: USER,
        schema: undefined as unknown as DocumentSchema,
        statusAtCapture: 'draft',
      })
    ).toThrow(/schema/);
  });
});

describe('listDocumentVersionSnapshots / getDocumentVersionSnapshot', () => {
  it('lists snapshots in chronological order (versionNumber asc)', () => {
    for (let i = 0; i < 3; i++) {
      createDocumentVersionSnapshot({
        organizationId: ORG_A,
        artifactId: 'artifact-1',
        userId: USER,
        schema: fakeSchema({ title: `v${i + 1}` }),
        statusAtCapture: 'draft',
      });
    }
    const list = listDocumentVersionSnapshots('artifact-1', ORG_A);
    expect(list).toHaveLength(3);
    expect(list.map((s) => s.versionNumber)).toEqual([1, 2, 3]);
    expect(list.map((s) => s.schema.title)).toEqual(['v1', 'v2', 'v3']);
  });

  it('cross-tenant list returns [] deny-by-default', () => {
    createDocumentVersionSnapshot({
      organizationId: ORG_A,
      artifactId: 'artifact-1',
      userId: USER,
      schema: fakeSchema(),
      statusAtCapture: 'draft',
    });
    expect(listDocumentVersionSnapshots('artifact-1', ORG_A)).toHaveLength(1);
    expect(listDocumentVersionSnapshots('artifact-1', ORG_B)).toHaveLength(0);
  });

  it('cross-tenant getDocumentVersionSnapshot returns null', () => {
    const snap = createDocumentVersionSnapshot({
      organizationId: ORG_A,
      artifactId: 'artifact-1',
      userId: USER,
      schema: fakeSchema(),
      statusAtCapture: 'draft',
    });
    expect(getDocumentVersionSnapshot(snap.versionId, ORG_A)).not.toBeNull();
    expect(getDocumentVersionSnapshot(snap.versionId, ORG_B)).toBeNull();
  });

  it('getDocumentVersionSnapshotByNumber locates by 1-based number', () => {
    createDocumentVersionSnapshot({
      organizationId: ORG_A,
      artifactId: 'artifact-1',
      userId: USER,
      schema: fakeSchema({ title: 'v1' }),
      statusAtCapture: 'draft',
    });
    createDocumentVersionSnapshot({
      organizationId: ORG_A,
      artifactId: 'artifact-1',
      userId: USER,
      schema: fakeSchema({ title: 'v2' }),
      statusAtCapture: 'in_review',
    });
    expect(getDocumentVersionSnapshotByNumber('artifact-1', ORG_A, 1)!.schema.title).toBe('v1');
    expect(getDocumentVersionSnapshotByNumber('artifact-1', ORG_A, 2)!.schema.title).toBe('v2');
    expect(getDocumentVersionSnapshotByNumber('artifact-1', ORG_A, 99)).toBeNull();
  });
});
