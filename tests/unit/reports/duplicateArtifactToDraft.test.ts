/**
 * D2 "Duplikuj / Użyj jako szablonu" (KROK 10) — unit tests for the pure helpers
 * that copy a document/sheet artifact into a new Work Canvas draft + /chat link.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildDuplicateChatUrl,
  buildDuplicateDraftBody,
  duplicateArtifactToCanvasDraft,
  duplicateTitleSuffix,
  mapArtifactKindToDraftKind,
} from '@/components/ReportsAndPresentations/duplicateArtifactToDraft';

describe('mapArtifactKindToDraftKind', () => {
  it('maps document → document and sheet → table', () => {
    expect(mapArtifactKindToDraftKind('document')).toBe('document');
    expect(mapArtifactKindToDraftKind('sheet')).toBe('table');
  });
});

describe('duplicateTitleSuffix', () => {
  it('localizes the copy suffix', () => {
    expect(duplicateTitleSuffix(true)).toBe('(kopia)');
    expect(duplicateTitleSuffix(false)).toBe('(copy)');
  });
});

describe('buildDuplicateDraftBody', () => {
  it('builds a document draft body with outputs-duplicate provenance', () => {
    const body = buildDuplicateDraftBody({
      input: {
        kind: 'document',
        originRecordId: 'draft-src-1',
        artifactId: 'art-99',
        title: 'Raport zarządu',
      },
      contentMd: '# Raport zarządu\n\nTreść',
      isPolish: true,
    });
    expect(body.kind).toBe('document');
    expect(body.title).toBe('Raport zarządu (kopia)');
    expect(body.contentMd).toBe('# Raport zarządu\n\nTreść');
    expect(body.content).toBe(body.contentMd);
    expect(body.provenance).toEqual({
      source: 'outputs-duplicate',
      sourceType: 'document',
      // original artifact id is preserved as the remix source (original untouched)
      duplicatedFrom: 'art-99',
      sourceOriginRecordId: 'draft-src-1',
      sourceTitle: 'Raport zarządu',
    });
  });

  it('maps sheet kind to a table draft and (copy) suffix in English', () => {
    const body = buildDuplicateDraftBody({
      input: { kind: 'sheet', originRecordId: 'draft-src-2', title: 'KPI Sheet' },
      contentMd: '| A | B |\n|---|---|\n| 1 | 2 |',
      isPolish: false,
    });
    expect(body.kind).toBe('table');
    expect(body.title).toBe('KPI Sheet (copy)');
    // no artifactId → duplicatedFrom falls back to originRecordId
    expect((body.provenance as any).duplicatedFrom).toBe('draft-src-2');
    expect((body.provenance as any).sourceType).toBe('sheet');
  });
});

describe('duplicateArtifactToCanvasDraft', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches source content, POSTs a copy, and returns the /chat deep-link', async () => {
    const fetchMock = vi
      .fn()
      // 1) GET source draft content
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: { draft: { contentMd: '# Source\n\nbody', title: 'Source Doc' } },
        }),
      })
      // 2) POST new duplicate draft
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 'draft-new-7' } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await duplicateArtifactToCanvasDraft(
      { kind: 'document', originRecordId: 'draft-src-1', artifactId: 'art-99', title: 'Source Doc' },
      { isPolish: false }
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);

    // GET hits the source draft
    const [getUrl] = fetchMock.mock.calls[0];
    expect(getUrl).toBe('/api/work-canvas/drafts/draft-src-1');

    // POST creates the duplicate with the copied content + provenance
    const [postUrl, postInit] = fetchMock.mock.calls[1];
    expect(postUrl).toBe('/api/work-canvas/drafts');
    expect(postInit.method).toBe('POST');
    const postBody = JSON.parse(postInit.body);
    expect(postBody.kind).toBe('document');
    expect(postBody.title).toBe('Source Doc (copy)');
    expect(postBody.contentMd).toBe('# Source\n\nbody');
    expect(postBody.provenance.source).toBe('outputs-duplicate');
    expect(postBody.provenance.duplicatedFrom).toBe('art-99');

    expect(result.draftId).toBe('draft-new-7');
    expect(result.chatUrl).toBe('/chat?workPanel=1&canvasDraftId=draft-new-7');
    expect(result.chatUrl).toBe(buildDuplicateChatUrl('draft-new-7'));
  });

  it('throws when the source artifact has no content', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { draft: { contentMd: '   ', title: 'Empty' } } }),
      })
    );
    await expect(
      duplicateArtifactToCanvasDraft(
        { kind: 'document', originRecordId: 'draft-empty', title: 'Empty' },
        { isPolish: false }
      )
    ).rejects.toThrow(/no content/i);
  });

  it('surfaces the API error when the source draft is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Canvas draft not found' }),
      })
    );
    await expect(
      duplicateArtifactToCanvasDraft(
        { kind: 'sheet', originRecordId: 'missing', title: 'X' },
        { isPolish: true }
      )
    ).rejects.toThrow('Canvas draft not found');
  });
});
