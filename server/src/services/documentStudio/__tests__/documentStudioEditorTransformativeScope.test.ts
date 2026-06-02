/**
 * Document Studio — Editor transformative scope tests (Slice E3.6).
 *
 * Verifies the 6th editor scope:
 *   - empty instruction is rejected;
 *   - artifact with zero sections rejects with `document_has_no_sections`;
 *   - the proposal targets every section (mirrors `global` reach);
 *   - audit trail records `scope: 'transformative'` AND
 *     `authority: 'user_explicit_rebuild'` so reviewers can filter for
 *     elevated-authority edits.
 *
 * The refiner-side guardrails (relaxed structural prompt header, no
 * source-preservation guard, retained 4× growth + 4000 char absolute
 * caps) are covered separately in
 * `documentEditorRefinerScopes.test.ts`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentSchema } from '../documentStudioTypes.js';

const transformativeSchema: DocumentSchema = {
  documentId: 'doc-trans-1',
  artifactId: 'artifact-trans-1',
  title: 'Transformative Scope Test Document',
  documentType: 'business_case',
  language: 'en',
  audience: ['Board'],
  goal: 'decide',
  communicationRegister: 'executive',
  density: 'detailed',
  languageStyle: 'consulting',
  confidentiality: 'client_confidential',
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
      sectionId: 'sec-exec',
      orderIndex: 0,
      level: 1,
      title: 'Executive Summary',
      blocks: [
        {
          blockId: 'blk-exec',
          type: 'paragraph',
          content: { text: 'Original executive summary.' } as unknown,
        },
      ],
      sourceRefs: [],
    },
    {
      sectionId: 'sec-findings',
      orderIndex: 1,
      level: 1,
      title: 'Findings',
      blocks: [
        {
          blockId: 'blk-f1',
          type: 'paragraph',
          content: { text: 'Finding alpha.' } as unknown,
        },
      ],
      sourceRefs: [],
    },
  ],
  sourceRefs: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const emptyArtifactSchema: DocumentSchema = {
  ...transformativeSchema,
  artifactId: 'artifact-trans-empty',
  documentId: 'doc-trans-empty',
  sections: [],
};

vi.mock('../../wave5ArtifactRuntimeService.js', () => ({
  createWave5Artifact: vi.fn(),
  getWave5Artifact: vi.fn(),
  buildWave5ExportManifest: vi.fn(),
  markWave5ArtifactExported: vi.fn(),
}));

import { getWave5Artifact } from '../../wave5ArtifactRuntimeService.js';
import {
  createTransformativeEditProposal,
  listDocumentAuditEntries,
} from '../documentStudioService.js';
const mockedGet = vi.mocked(getWave5Artifact);

describe('Document Studio editor — transformative scope (Slice E3.6)', () => {
  beforeEach(() => {
    vi.useRealTimers();
    mockedGet.mockReset();
    mockedGet.mockImplementation(async (artifactId: string, organizationId: string) => {
      if (artifactId === 'artifact-trans-1' && organizationId === 'org-A') {
        return {
          artifact_id: artifactId,
          organization_id: organizationId,
          title: 'Transformative Scope Test Document',
          content: 'markdown',
          content_json: transformativeSchema,
          metadata_json: { documentStudioSchema: transformativeSchema },
        } as unknown as Awaited<ReturnType<typeof getWave5Artifact>>;
      }
      if (artifactId === 'artifact-trans-empty' && organizationId === 'org-A') {
        return {
          artifact_id: artifactId,
          organization_id: organizationId,
          title: 'Empty Document',
          content: 'markdown',
          content_json: emptyArtifactSchema,
          metadata_json: { documentStudioSchema: emptyArtifactSchema },
        } as unknown as Awaited<ReturnType<typeof getWave5Artifact>>;
      }
      return null;
    });
  });

  it('rejects empty transformative instructions', async () => {
    await expect(
      createTransformativeEditProposal({
        artifactId: 'artifact-trans-1',
        organizationId: 'org-A',
        userId: 'user-1',
        instruction: '   ',
      })
    ).rejects.toThrow();
  });

  it('rejects when the artifact does not exist (404)', async () => {
    await expect(
      createTransformativeEditProposal({
        artifactId: 'artifact-does-not-exist',
        organizationId: 'org-A',
        userId: 'user-1',
        instruction: 'Rebuild from scratch.',
      })
    ).rejects.toThrow('artifact_not_found');
  });

  it('rejects when the document has zero sections', async () => {
    await expect(
      createTransformativeEditProposal({
        artifactId: 'artifact-trans-empty',
        organizationId: 'org-A',
        userId: 'user-1',
        instruction: 'Rebuild from scratch.',
      })
    ).rejects.toThrow('document_has_no_sections');
  });

  it('targets every section (transformative reach mirrors global reach)', async () => {
    const proposal = await createTransformativeEditProposal({
      artifactId: 'artifact-trans-1',
      organizationId: 'org-A',
      userId: 'user-1',
      instruction: 'Rebuild as a forward-looking executive narrative.',
    });
    expect(proposal.scope).toBe('transformative');
    expect(proposal.affectedSectionIds.sort()).toEqual(['sec-exec', 'sec-findings'].sort());
  });

  it('records scope=transformative AND authority=user_explicit_rebuild in the audit trail', async () => {
    const proposal = await createTransformativeEditProposal({
      artifactId: 'artifact-trans-1',
      organizationId: 'org-A',
      userId: 'user-1',
      instruction: 'Rebuild from scratch with a tighter narrative arc.',
    });
    const audit = listDocumentAuditEntries('artifact-trans-1', 'org-A');
    const created = audit.find(
      (entry) => entry.action === 'proposal_created' && entry.proposalId === proposal.proposalId
    );
    expect(created?.details).toMatchObject({
      scope: 'transformative',
      affectedSectionCount: 2,
      authority: 'user_explicit_rebuild',
    });
  });
});
