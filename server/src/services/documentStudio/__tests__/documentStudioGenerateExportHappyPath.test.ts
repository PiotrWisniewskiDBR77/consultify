/**
 * Document Studio — generate -> export happy path (Module 10 hardening).
 *
 * Exercises the full pipeline end-to-end through the real service:
 *   1. `materializeDocumentArtifact` plans an outline from intake, builds
 *      the schema, and persists a wave5 artifact (deterministic Mode 1).
 *   2. `getDocumentArtifact` reads the persisted schema back.
 *   3. `exportDocumentArtifact` renders a real PDF and DOCX from that
 *      schema and marks the artifact exported.
 *
 * The wave5 runtime is mocked with a STATEFUL in-memory store so the
 * artifact created in step 1 is the one read + exported in steps 2-3 —
 * i.e. this validates the real create -> read -> render handoff, not a
 * fixed fixture.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

interface StoredArtifact {
  artifact_id: string;
  organization_id: string;
  title: string;
  content: string;
  content_json: unknown;
  metadata_json: unknown;
  status?: string;
}

const store = new Map<string, StoredArtifact>();
let seq = 0;

vi.mock('../../wave5ArtifactRuntimeService.js', () => ({
  createWave5Artifact: vi.fn(
    async (params: {
      organizationId: string;
      title: string;
      content: string;
      contentJson: unknown;
      metadata: unknown;
    }) => {
      seq += 1;
      const artifactId = `art-happy-${seq}`;
      const row: StoredArtifact = {
        artifact_id: artifactId,
        organization_id: params.organizationId,
        title: params.title,
        content: params.content,
        content_json: params.contentJson,
        metadata_json: params.metadata,
        status: 'draft',
      };
      store.set(`${params.organizationId}::${artifactId}`, row);
      return { artifactId, artifact_id: artifactId };
    }
  ),
  getWave5Artifact: vi.fn(async (artifactId: string, organizationId: string) => {
    return store.get(`${organizationId}::${artifactId}`) ?? null;
  }),
  buildWave5ExportManifest: vi.fn(async (artifactId: string) => ({
    artifactId,
    formats: ['markdown', 'pdf_print', 'docx'],
  })),
  markWave5ArtifactExported: vi.fn(async (artifactId: string, organizationId: string) => {
    const row = store.get(`${organizationId}::${artifactId}`);
    if (row) row.status = 'exported';
    return { artifact_id: artifactId, status: 'exported' };
  }),
}));

import { markWave5ArtifactExported } from '../../wave5ArtifactRuntimeService.js';
import {
  exportDocumentArtifact,
  getDocumentArtifact,
  materializeDocumentArtifact,
} from '../documentStudioService.js';

const markExported = vi.mocked(markWave5ArtifactExported);

describe('Document Studio generate -> export happy path', () => {
  beforeEach(() => {
    store.clear();
    seq = 0;
    markExported.mockClear();
  });

  it('materializes a deterministic artifact and exports it to PDF + DOCX', async () => {
    const run = await materializeDocumentArtifact({
      organizationId: 'org-1',
      userId: 'user-1',
      intake: {
        description:
          'Recommend whether to consolidate the three regional data centers into one cloud region.',
        language: 'en',
        goal: 'decide',
        audience: ['Board'],
      },
      // useLlm omitted -> deterministic content path (no LLM dependency).
    });

    expect(run.artifactId).toBeTruthy();
    expect(run.schema.sections.length).toBeGreaterThan(0);
    expect(run.schema.documentStatus).toBe('draft');

    // Read-back through the real service path. The artifact is resolved by
    // the canonical wave5 id; the schema body is the one persisted at
    // materialization time.
    const schema = await getDocumentArtifact(run.artifactId, 'org-1');
    expect(schema).not.toBeNull();
    expect(schema?.title).toBe(run.schema.title);
    expect(schema?.documentType).toBe(run.schema.documentType);

    // Export to PDF — real %PDF- stream.
    const pdf = await exportDocumentArtifact(run.artifactId, 'org-1', 'pdf');
    expect(pdf.format).toBe('pdf');
    const pdfBuffer = Buffer.from(String(pdf.contentBase64), 'base64');
    expect(pdfBuffer.slice(0, 5).toString('utf8')).toBe('%PDF-');
    expect(pdf.manifest.renderedFromSchema).toBe(true);

    // Export to DOCX — real ZIP container.
    const docx = await exportDocumentArtifact(run.artifactId, 'org-1', 'docx');
    expect(docx.format).toBe('docx');
    const docxBuffer = Buffer.from(String(docx.contentBase64), 'base64');
    expect(docxBuffer[0]).toBe(0x50); // P
    expect(docxBuffer[1]).toBe(0x4b); // K
    expect(docxBuffer.includes(Buffer.from('[Content_Types].xml'))).toBe(true);

    // Both binary exports marked the artifact exported.
    expect(markExported).toHaveBeenCalledTimes(2);
    expect(store.get(`org-1::${run.artifactId}`)?.status).toBe('exported');
  });

  it('isolates tenants — a cross-tenant read returns null', async () => {
    const run = await materializeDocumentArtifact({
      organizationId: 'org-1',
      userId: 'user-1',
      intake: { description: 'Tenant isolation check.', language: 'en', goal: 'inform' },
    });
    const crossTenant = await getDocumentArtifact(run.artifactId, 'org-2');
    expect(crossTenant).toBeNull();
  });
});
