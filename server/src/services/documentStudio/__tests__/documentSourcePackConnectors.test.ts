/**
 * Document Studio — Source Pack Connector tests (Epic E4, Slice 4.2).
 *
 * Covers the connector adapter surface:
 *   - ingestRawTextSource       trivial wrap + body budget truncation
 *   - ingestUrlSource           HTML strip + title extraction + abort/timeout
 *                              + non-200 + scheme guard + body budget
 *   - ingestFileSource          MIME / extension allowlist + body budget
 *   - ingestV8ArtifactSource    artifact loader + missing artifact + content
 *                              priority order (md > content > text)
 *   - ingestIntegrationSource   integration vocabulary guard + reference-only
 */

import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_BODY_BUDGET_CHARS,
  ingestFileSource,
  ingestIntegrationSource,
  ingestRawTextSource,
  ingestUrlSource,
  ingestV8ArtifactSource,
  SourcePackConnectorError,
} from '../documentSourcePackConnectors.js';

describe('Source Pack Connectors — raw text', () => {
  it('wraps a small block of text and stays untruncated', () => {
    const item = ingestRawTextSource({
      title: 'Discovery quote — CFO',
      body: 'CFO: We need consolidation by Q4.',
      language: 'en',
    });
    expect(item.itemType).toBe('text');
    expect(item.bodyTruncated).toBe(false);
    expect(item.body).toBe('CFO: We need consolidation by Q4.');
    expect(item.contentLength).toBe('CFO: We need consolidation by Q4.'.length);
    expect(item.sourceRef.sourceType).toBe('text');
    expect(item.sourceRef.sourceTitle).toBe('Discovery quote — CFO');
  });

  it('truncates the body when above the budget and reports contentLength as raw', () => {
    const long = 'x'.repeat(DEFAULT_BODY_BUDGET_CHARS + 100);
    const item = ingestRawTextSource({
      title: 'Long source',
      body: long,
    });
    expect(item.body!.length).toBe(DEFAULT_BODY_BUDGET_CHARS);
    expect(item.bodyTruncated).toBe(true);
    expect(item.contentLength).toBe(DEFAULT_BODY_BUDGET_CHARS + 100);
  });

  it('rejects empty body and empty title', () => {
    expect(() => ingestRawTextSource({ title: '', body: 'a' })).toThrow(SourcePackConnectorError);
    expect(() => ingestRawTextSource({ title: 'a', body: '' })).toThrow(SourcePackConnectorError);
  });
});

describe('Source Pack Connectors — URL', () => {
  it('extracts title and stripped body from a basic HTML page', async () => {
    const html = `
      <html><head><title>  Sample Page  </title></head>
      <body>
        <script>console.log('drop me')</script>
        <style>.bad{display:none}</style>
        <h1>Hello</h1>
        <p>This is the &amp; key &lt;evidence&gt;.</p>
        <noscript>NoScript</noscript>
      </body></html>
    `;
    const fakeFetch = vi.fn(async () =>
      new Response(html, { status: 200, headers: { 'content-type': 'text/html' } })
    ) as unknown as typeof fetch;
    const item = await ingestUrlSource({
      url: 'https://example.com/sample',
      fetcher: fakeFetch,
    });
    expect(item.itemType).toBe('url');
    expect(item.title).toBe('Sample Page');
    expect(item.body).toContain('Hello');
    expect(item.body).toContain('This is the & key <evidence>.');
    expect(item.body).not.toContain('console.log');
    expect(item.body).not.toContain('display:none');
    expect(item.body).not.toContain('NoScript');
    expect(item.uri).toBe('https://example.com/sample');
    expect(item.sourceRef.sourceId).toBe('https://example.com/sample');
  });

  it('falls back to hostname when no <title> tag is present', async () => {
    const fakeFetch = vi.fn(async () =>
      new Response('<p>Body only</p>', { status: 200 })
    ) as unknown as typeof fetch;
    const item = await ingestUrlSource({
      url: 'https://news.example.org/article',
      fetcher: fakeFetch,
    });
    expect(item.title).toBe('news.example.org');
  });

  it('rejects non-http schemes', async () => {
    await expect(
      ingestUrlSource({ url: 'file:///etc/passwd', fetcher: vi.fn() as unknown as typeof fetch })
    ).rejects.toMatchObject({ code: 'unsupported_scheme' });
  });

  it('throws fetch_failed when the response is not 2xx', async () => {
    const fakeFetch = vi.fn(async () =>
      new Response('Not Found', { status: 404 })
    ) as unknown as typeof fetch;
    await expect(
      ingestUrlSource({ url: 'https://example.com/missing', fetcher: fakeFetch })
    ).rejects.toMatchObject({ code: 'fetch_failed' });
  });

  it('throws extraction_failed when body strip yields no text', async () => {
    const fakeFetch = vi.fn(async () =>
      new Response('<script>only()</script>', { status: 200 })
    ) as unknown as typeof fetch;
    await expect(
      ingestUrlSource({ url: 'https://example.com/empty', fetcher: fakeFetch })
    ).rejects.toMatchObject({ code: 'extraction_failed' });
  });

  it('throws fetch_timeout when the abort controller fires', async () => {
    const slow: typeof fetch = (input, init) =>
      new Promise((_, reject) => {
        const signal = (init as { signal?: AbortSignal } | undefined)?.signal;
        if (signal) {
          signal.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }
        // never resolves on its own
        void input;
      });
    await expect(
      ingestUrlSource({
        url: 'https://example.com/slow',
        fetcher: slow,
        timeoutMs: 5,
      })
    ).rejects.toMatchObject({ code: 'fetch_timeout' });
  });
});

describe('Source Pack Connectors — file', () => {
  it('accepts text/markdown by mime', () => {
    const item = ingestFileSource({
      filename: 'discovery-notes.md',
      mimeType: 'text/markdown',
      body: '# Discovery notes\n\n- finding 1\n- finding 2',
    });
    expect(item.itemType).toBe('file');
    expect(item.uri).toBe('file://discovery-notes.md');
    expect(item.contentLength).toBe('# Discovery notes\n\n- finding 1\n- finding 2'.length);
  });

  it('accepts allowed extensions when mime is unknown', () => {
    const item = ingestFileSource({
      filename: 'transcript.txt',
      mimeType: 'application/octet-stream',
      body: 'CFO: hello',
    });
    expect(item.itemType).toBe('file');
  });

  it('rejects unsupported binary types in MVP', () => {
    let caught: unknown;
    try {
      ingestFileSource({
        filename: 'deck.pptx',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        body: 'binary garbage',
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(SourcePackConnectorError);
    expect((caught as SourcePackConnectorError).code).toBe('extraction_failed');
  });

  it('truncates above the budget', () => {
    const long = 'a'.repeat(DEFAULT_BODY_BUDGET_CHARS + 50);
    const item = ingestFileSource({
      filename: 'big.txt',
      mimeType: 'text/plain',
      body: long,
    });
    expect(item.body!.length).toBe(DEFAULT_BODY_BUDGET_CHARS);
    expect(item.bodyTruncated).toBe(true);
    expect(item.contentLength).toBe(DEFAULT_BODY_BUDGET_CHARS + 50);
  });
});

describe('Source Pack Connectors — V8 artifact', () => {
  it('uses content_md when available and falls back to content', async () => {
    const loader = vi.fn(async () => ({
      artifactId: 'art-1',
      title: 'Interview transcript',
      content_md: '# Discovery transcript\n\nQ: ...',
      content: 'fallback raw',
    })) as unknown as typeof import('../../wave5ArtifactRuntimeService.js').getWave5Artifact;
    const item = await ingestV8ArtifactSource({
      artifactId: 'art-1',
      organizationId: 'org-A',
      loader,
    });
    expect(item.itemType).toBe('v8_artifact');
    expect(item.body).toContain('Discovery transcript');
    expect(item.title).toBe('Interview transcript');
    expect(item.uri).toBe('wave5://artifact/art-1');
    expect(item.sourceRef.sourceType).toBe('v8_artifact');
    expect(item.sourceRef.sourceId).toBe('art-1');
  });

  it('falls back to content when content_md is missing and content is set', async () => {
    const loader = vi.fn(async () => ({
      artifactId: 'art-2',
      title: 'Memo',
      content: 'plain memo body',
    })) as unknown as typeof import('../../wave5ArtifactRuntimeService.js').getWave5Artifact;
    const item = await ingestV8ArtifactSource({
      artifactId: 'art-2',
      organizationId: 'org-A',
      loader,
    });
    expect(item.body).toBe('plain memo body');
  });

  it('throws artifact_not_found when the loader returns null', async () => {
    const loader = vi.fn(async () => null) as unknown as typeof import('../../wave5ArtifactRuntimeService.js').getWave5Artifact;
    await expect(
      ingestV8ArtifactSource({
        artifactId: 'missing',
        organizationId: 'org-A',
        loader,
      })
    ).rejects.toMatchObject({ code: 'artifact_not_found' });
  });

  it('throws extraction_failed when the artifact has no readable content', async () => {
    const loader = vi.fn(async () => ({
      artifactId: 'art-3',
      title: 'Empty',
      content: '',
      content_md: '',
      content_text: '',
    })) as unknown as typeof import('../../wave5ArtifactRuntimeService.js').getWave5Artifact;
    await expect(
      ingestV8ArtifactSource({
        artifactId: 'art-3',
        organizationId: 'org-A',
        loader,
      })
    ).rejects.toMatchObject({ code: 'extraction_failed' });
  });
});

describe('Source Pack Connectors — integration', () => {
  it('records a reference-only item for a Notion page', () => {
    const item = ingestIntegrationSource({
      integration: 'notion',
      externalId: 'notion-page-abc',
      title: 'Discovery board',
      preview: 'short preview text',
    });
    expect(item.itemType).toBe('integration');
    expect(item.body).toBe('short preview text');
    expect(item.contentLength).toBe('short preview text'.length);
    expect(item.uri).toBe('notion://notion-page-abc');
    expect(item.sourceRef.sourceType).toBe('notion');
  });

  it('rejects unknown integration types', () => {
    let caught: unknown;
    try {
      ingestIntegrationSource({
        integration: 'salesforce' as never,
        externalId: 'x',
        title: 'y',
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(SourcePackConnectorError);
    expect((caught as SourcePackConnectorError).code).toBe('integration_not_configured');
  });
});
