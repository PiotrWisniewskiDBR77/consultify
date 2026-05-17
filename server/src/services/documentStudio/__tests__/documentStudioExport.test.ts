/**
 * Document Studio export tests (MVP-1 finalization).
 *
 * Covers the binary export path:
 *   - DOCX export returns a base64 payload that decodes into a real .docx
 *     ZIP container (PK\x03\x04 magic, "[Content_Types].xml" entry).
 *   - PDF export returns a base64 payload that decodes into a real PDF stream
 *     (%PDF- magic).
 *   - The export pipeline marks the wave5 artifact as `exported` after a
 *     successful render and surfaces the manifest's byteLength.
 *
 * The wave5 runtime is mocked so the test does not require a database fixture
 * and stays consistent with `documentStudioGovernance.test.ts`.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentSchema } from '../documentStudioTypes.js';

const baseSchema: DocumentSchema = {
  documentId: 'doc-1',
  artifactId: 'artifact-export-1',
  title: 'Export Test Document',
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
    page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2.3, right: 2.3 } },
    headers: { enabled: true },
    footers: { enabled: true, pageNumbering: true, confidentialityLabel: true },
    toc: false,
    coverPage: true,
    appendixStyle: 'lettered',
    citationStyle: 'inline_marker',
  },
  sections: [
    {
      sectionId: 'sec-summary',
      orderIndex: 0,
      level: 1,
      title: 'Executive Summary',
      blocks: [
        {
          blockId: 'blk-1',
          type: 'paragraph',
          content: { text: 'High-level recommendation in two sentences.' } as unknown,
        },
        {
          blockId: 'blk-2',
          type: 'callout',
          content: { variant: 'key_message', text: 'Decision required next week.' } as unknown,
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
          blockId: 'blk-3',
          type: 'bullet_list',
          content: { style: 'bullet', items: ['Finding A', 'Finding B', 'Finding C'] } as unknown,
        },
      ],
      sourceRefs: [],
    },
  ],
  sourceRefs: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

vi.mock('../../wave5ArtifactRuntimeService.js', () => ({
  createWave5Artifact: vi.fn(),
  getWave5Artifact: vi.fn(async (artifactId: string, organizationId: string) => {
    if (artifactId !== 'artifact-export-1' || organizationId !== 'org-1') return null;
    return {
      artifact_id: artifactId,
      organization_id: organizationId,
      title: 'Export Test Document',
      content: '# Export Test Document',
      content_json: baseSchema,
      metadata_json: { documentStudioSchema: baseSchema },
    };
  }),
  buildWave5ExportManifest: vi.fn(async () => ({
    artifactId: 'artifact-export-1',
    formats: ['markdown', 'pdf_print'],
  })),
  markWave5ArtifactExported: vi.fn(async () => ({
    artifact_id: 'artifact-export-1',
    status: 'exported',
  })),
}));

import { markWave5ArtifactExported } from '../../wave5ArtifactRuntimeService.js';
import { exportDocumentArtifact } from '../documentStudioService.js';

const markExported = vi.mocked(markWave5ArtifactExported);

function decodeBase64(payload: string): Buffer {
  return Buffer.from(payload, 'base64');
}

describe('Document Studio export pipeline', () => {
  beforeEach(() => {
    markExported.mockClear();
  });

  it('returns a real DOCX (ZIP container with [Content_Types].xml)', async () => {
    const result = await exportDocumentArtifact('artifact-export-1', 'org-1', 'docx');
    expect(result.format).toBe('docx');
    expect(result.filename.endsWith('.docx')).toBe(true);
    expect(typeof result.contentBase64).toBe('string');
    expect(result.contentText).toBeUndefined();
    const buffer = decodeBase64(String(result.contentBase64));
    // ZIP local file header magic: PK\x03\x04
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
    expect(buffer[2]).toBe(0x03);
    expect(buffer[3]).toBe(0x04);
    // Every Office Open XML package contains [Content_Types].xml as part name.
    expect(buffer.includes(Buffer.from('[Content_Types].xml'))).toBe(true);
    expect(typeof result.manifest.byteLength).toBe('number');
    expect(result.manifest.renderedFromSchema).toBe(true);
    expect(markExported).toHaveBeenCalledTimes(1);
    expect(markExported).toHaveBeenCalledWith('artifact-export-1', 'org-1');
    // Manifest must NOT carry the legacy pending-rendering tag anymore.
    expect((result.manifest as Record<string, unknown>).pendingRendering).toBeUndefined();
  });

  it('returns a real PDF (starts with %PDF- magic and ends with %%EOF)', async () => {
    const result = await exportDocumentArtifact('artifact-export-1', 'org-1', 'pdf');
    expect(result.format).toBe('pdf');
    expect(result.filename.endsWith('.pdf')).toBe(true);
    expect(typeof result.contentBase64).toBe('string');
    expect(result.contentText).toBeUndefined();
    const buffer = decodeBase64(String(result.contentBase64));
    expect(buffer.slice(0, 5).toString('utf8')).toBe('%PDF-');
    expect(buffer.slice(-6).toString('utf8').includes('EOF')).toBe(true);
    expect(typeof result.manifest.byteLength).toBe('number');
    expect(result.manifest.renderedFromSchema).toBe(true);
    expect(markExported).toHaveBeenCalledTimes(1);
    expect((result.manifest as Record<string, unknown>).pendingRendering).toBeUndefined();
  });

  it('keeps markdown export as plain text (no binary path) and does NOT mark exported', async () => {
    const result = await exportDocumentArtifact('artifact-export-1', 'org-1', 'markdown');
    expect(result.format).toBe('markdown');
    expect(typeof result.contentText).toBe('string');
    expect(result.contentBase64).toBeUndefined();
    expect(markExported).not.toHaveBeenCalled();
  });

  it('reads schema from camelCase wave5 artifact shape', async () => {
    vi.mocked(markWave5ArtifactExported).mockClear();
    const dynamicWave5 = await import('../../wave5ArtifactRuntimeService.js');
    vi.mocked(dynamicWave5.getWave5Artifact).mockImplementation(async (artifactId: string) => {
      if (artifactId === 'artifact-export-camel-1') {
        return {
          artifactId: 'artifact-export-camel-1',
          organizationId: 'org-1',
          title: 'Camel Case Artifact',
          content: '# Camel Case Artifact',
          contentJson: baseSchema,
          provenance: { metadata: { documentStudioSchema: baseSchema } },
        };
      }
      return {
        artifact_id: 'artifact-export-1',
        organization_id: 'org-1',
        title: 'Export Test Document',
        content: '# Export Test Document',
        content_json: baseSchema,
        metadata_json: { documentStudioSchema: baseSchema },
      };
    });
    vi.mocked(dynamicWave5.buildWave5ExportManifest).mockImplementationOnce(async () => ({
      artifactId: 'artifact-export-camel-1',
      formats: ['markdown', 'pdf_print'],
    }));

    const result = await exportDocumentArtifact('artifact-export-camel-1', 'org-1', 'docx');
    expect(result.format).toBe('docx');
    expect(typeof result.contentBase64).toBe('string');
    expect(result.manifest.renderedFromSchema).toBe(true);
  });
});
