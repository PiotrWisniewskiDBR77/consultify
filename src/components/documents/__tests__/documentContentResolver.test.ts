/**
 * @vitest-environment jsdom
 *
 * DOC-0 (DEC-593) — the ONE content adapter of the read-only document viewer.
 *
 * The rule under test is the chain, not the HTTP plumbing: a document row may be
 * backed by `wave5_artifacts` / `report_builder_reports` (both reached through
 * `GET /api/artifacts/:id/content`) OR by `work_canvas_drafts` (reached only
 * through `GET /api/work-canvas/drafts/:id`), and a row with no body anywhere must
 * report a NAMED error instead of rendering an empty page that looks healthy.
 *
 * `fetch` is stubbed per URL so every branch is a real call through the adapter.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  resolveDocumentContent,
  splitMarkdownIntoSections,
  type DocumentContentResolution,
} from '../documentContentResolver';

const ARTIFACT_URL = '/api/artifacts/art-doc0-1/content';
const CANVAS_URL = '/api/work-canvas/drafts/wc-doc0-1';

interface StubRoute {
  status?: number;
  body?: unknown;
  throws?: boolean;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function envelope(contentMd: string, extra: Record<string, unknown> = {}) {
  return {
    artifactId: 'art-doc0-1',
    origin: { originRuntime: 'native_artifact', originRecordId: 'wc-doc0-1' },
    contentHash: 'hash',
    resolvedAt: '2026-09-17T10:00:00.000Z',
    envelope: {
      envelopeVersion: 'artifact-content/v1',
      canonicalFormat: 'markdown',
      canonicalKind: 'document',
      contentSchemaVersion: '1',
      contentMd,
      artifactType: 'report',
      markdownProjectionStatus: 'synced',
      projection: {
        status: 'synced',
        projectedAt: '2026-09-17T10:00:00.000Z',
        error: null,
        completeness: 'full',
        projectedFromRevision: null,
        projectedFromHash: null,
      },
      provenance: { originRuntime: null, originRecordId: null, originRevision: null },
      ...extra,
    },
  };
}

let routes: Record<string, StubRoute> = {};
const fetchMock = vi.fn();

beforeEach(() => {
  routes = {};
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(typeof input === 'string' ? input : (input as Request).url ?? input);
    const route = routes[url];
    if (!route) return jsonResponse(404, { error: 'not stubbed' });
    if (route.throws) throw new TypeError('Failed to fetch');
    return jsonResponse(route.status ?? 200, route.body ?? {});
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function ready(resolution: DocumentContentResolution) {
  if (resolution.state !== 'ready') throw new Error(`expected ready, got ${resolution.state}`);
  return resolution;
}

describe('resolveDocumentContent — registry chain', () => {
  it('reads the artifact content contract first and names that registry', async () => {
    routes[ARTIFACT_URL] = { status: 200, body: envelope('# Plan\n\nBody line.') };

    const result = ready(
      await resolveDocumentContent({ artifactId: 'art-doc0-1', originRecordId: 'wc-doc0-1' })
    );

    expect(result.registry).toBe('artifact_content');
    expect(result.sections.map((s) => s.label)).toEqual(['Plan']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the work-canvas registry when the artifact contract has no body', async () => {
    // The 9 canvas-origin rows: `wave5ArtifactContentAdapter` reads only
    // `wave5_artifacts`, so the artifacts contract 404s for them.
    routes[ARTIFACT_URL] = {
      status: 404,
      body: { error: { code: 'ARTIFACT_CONTENT_ORIGIN_NOT_FOUND' } },
    };
    routes[CANVAS_URL] = {
      status: 200,
      body: { success: true, data: { draft: { contentMd: '# Canvas plan\n\nText.', title: 'Canvas plan' } } },
    };

    const result = ready(
      await resolveDocumentContent({ artifactId: 'art-doc0-1', originRecordId: 'wc-doc0-1' })
    );

    expect(result.registry).toBe('work_canvas_drafts');
    expect(result.title).toBe('Canvas plan');
    expect(result.contentMd).toContain('Canvas plan');
  });

  it('falls back to the work-canvas registry when the envelope resolves blank', async () => {
    routes[ARTIFACT_URL] = { status: 200, body: envelope('   \n  ') };
    routes[CANVAS_URL] = {
      status: 200,
      body: { data: { draft: { contentMd: 'Real body', title: 'Draft title' } } },
    };

    const result = ready(
      await resolveDocumentContent({ artifactId: 'art-doc0-1', originRecordId: 'wc-doc0-1' })
    );

    expect(result.registry).toBe('work_canvas_drafts');
    expect(result.contentMd).toBe('Real body');
  });

  it('resolves from the canvas registry alone when the caller has no artifact id', async () => {
    routes[CANVAS_URL] = {
      status: 200,
      body: { data: { draft: { contentMd: 'Only canvas', title: 'Only canvas' } } },
    };

    const result = ready(await resolveDocumentContent({ artifactId: '', originRecordId: 'wc-doc0-1' }));

    expect(result.registry).toBe('work_canvas_drafts');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(CANVAS_URL);
  });

  it('reports content_not_found for an orphan row (the 6×404 of DEC-595)', async () => {
    routes[ARTIFACT_URL] = { status: 404, body: { error: { code: 'ARTIFACT_CONTENT_ORIGIN_NOT_FOUND' } } };
    routes[CANVAS_URL] = { status: 404, body: { error: 'Draft not found' } };

    const result = await resolveDocumentContent({
      artifactId: 'art-doc0-1',
      originRecordId: 'wc-doc0-1',
    });

    expect(result).toEqual({
      state: 'error',
      errorCode: 'content_not_found',
      detail: 'ARTIFACT_CONTENT_ORIGIN_NOT_FOUND',
    });
  });

  it('reports load_failed (retryable) for a server fault, not content_not_found', async () => {
    routes[ARTIFACT_URL] = { status: 503, body: { error: 'upstream down' } };

    const result = await resolveDocumentContent({ artifactId: 'art-doc0-1' });

    expect(result.state).toBe('error');
    if (result.state === 'error') expect(result.errorCode).toBe('load_failed');
  });

  it('reports load_failed when the transport itself throws', async () => {
    routes[ARTIFACT_URL] = { throws: true };

    const result = await resolveDocumentContent({ artifactId: 'art-doc0-1' });

    expect(result.state).toBe('error');
    if (result.state === 'error') expect(result.errorCode).toBe('load_failed');
  });

  it('reports empty (not an error) when a registry resolves a body-less document', async () => {
    routes[ARTIFACT_URL] = { status: 200, body: envelope('') };

    const result = await resolveDocumentContent({ artifactId: 'art-doc0-1' });

    expect(result).toEqual({ state: 'empty', registry: 'artifact_content', title: null });
  });

  it('refuses to guess when the caller knows no identifier at all', async () => {
    const result = await resolveDocumentContent({ artifactId: '  ', originRecordId: null });

    expect(result).toEqual({ state: 'error', errorCode: 'missing_identifier', detail: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('carries the projection status and the caller title through to the viewer', async () => {
    routes[ARTIFACT_URL] = {
      status: 200,
      body: envelope('# Stale doc', { projection: { status: 'stale' }, canonicalKind: 'sheet' }),
    };

    const result = ready(
      await resolveDocumentContent({ artifactId: 'art-doc0-1', title: 'Row title' })
    );

    expect(result.projectionStatus).toBe('stale');
    expect(result.canonicalKind).toBe('sheet');
    expect(result.title).toBe('Row title');
  });
});

describe('splitMarkdownIntoSections — the left nav of the viewer', () => {
  it('splits on level 1-2 headings and keeps the preamble', () => {
    const sections = splitMarkdownIntoSections('Intro text\n\n# One\n\nA\n\n## Two\n\nB\n');

    expect(sections.map((s) => s.label)).toEqual([null, 'One', 'Two']);
    expect(sections[0].markdown).toBe('Intro text');
    expect(sections[1].markdown).toBe('A');
    expect(sections[2].markdown).toBe('B');
  });

  it('never splits on a heading level deeper than 2', () => {
    const sections = splitMarkdownIntoSections('# Top\n\n### Deep\n\ntext\n');

    expect(sections).toHaveLength(1);
    expect(sections[0].markdown).toContain('### Deep');
  });

  it('treats a # inside a fenced code block as code, not a heading', () => {
    const sections = splitMarkdownIntoSections('# Real\n\n```bash\n# not a heading\necho hi\n```\n');

    expect(sections.map((s) => s.label)).toEqual(['Real']);
    expect(sections[0].markdown).toContain('# not a heading');
  });

  it('yields exactly one section for a body without headings', () => {
    const sections = splitMarkdownIntoSections('Just a paragraph.\n\nAnother one.');

    expect(sections).toHaveLength(1);
    expect(sections[0].id).toBe('doc-content');
    expect(sections[0].label).toBeNull();
  });

  it('prefixes every id with doc- so a "History" heading cannot collide with a reserved SPEC-N §2.1 id', () => {
    const sections = splitMarkdownIntoSections('# History\n\nx\n\n# Comments\n\ny\n');

    expect(sections.map((s) => s.id)).toEqual(['doc-history', 'doc-comments']);
  });

  it('keeps ids unique when two headings slugify the same', () => {
    const sections = splitMarkdownIntoSections('# Q3 Plan\n\na\n\n# q3-plan!\n\nb\n');

    expect(sections.map((s) => s.id)).toEqual(['doc-q3-plan', 'doc-q3-plan-2']);
  });

  it('drops the empty H2 wrapper a report projection puts around its block title', () => {
    // Real shape of staging row c9a254b7 "Northwind OEE Recovery 2027 — Dynamic
    // SWOT read-out": 25 headings, 8 of them an EMPTY H2 immediately followed by
    // the H1 that titles the block ("## Cover Page" → "# Northwind OEE Recovery
    // 2027 — Dynamic SWOT", "## Executive Summary" → "# Executive Summary").
    const sections = splitMarkdownIntoSections(
      '## Cover Page\n\n# Northwind OEE Recovery 2027\n\nTool Evaluation Report\n\n' +
        '## Executive Summary\n\n# Executive Summary\n\nBasis: 1 tension.\n\n' +
        '## For Information\n\n## Strategic tensions\n\n- Attack opportunity\n'
    );

    expect(sections.map((s) => s.label)).toEqual([
      'Northwind OEE Recovery 2027',
      'Executive Summary',
      'For Information',
      'Strategic tensions',
    ]);
    expect(sections[1].markdown).toContain('Basis: 1 tension.');
    expect(sections[2].markdown).toBe('');
  });
});
