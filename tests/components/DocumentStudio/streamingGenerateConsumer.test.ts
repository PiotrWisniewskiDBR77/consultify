/**
 * C1 — Document Studio streaming consumer (FE).
 *
 * Verifies `generateDocumentStudioArtifactStream` parses an SSE
 * `text/event-stream` body from a mocked `fetch` + `ReadableStream` and drives
 * the progressive-render callbacks in order:
 *
 *   plan → section (0) → section (1) → done
 *
 * Also asserts:
 *   - heartbeat comment frames (`:\n\n`) are ignored;
 *   - a frame split ACROSS two chunks is reassembled (buffering);
 *   - a fatal `error` event rejects with a typed DocumentStreamError;
 *   - a non-200 response rejects (so the View can fall back to sync).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The stream client pulls auth headers from baseClient — stub it so the test
// has no dependency on tokenService / localStorage.
vi.mock('@/services/api/baseClient', () => ({
  getHeaders: () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer test' }),
  fetchWithRetry: vi.fn(),
  handleResponse: vi.fn(),
}));

import {
  DocumentStreamError,
  generateDocumentStudioArtifactStream,
  type DocumentStreamSectionEvent,
} from '@/components/DocumentStudio/api';

/** Build a Response whose body is a ReadableStream emitting the given chunks. */
function sseResponse(chunks: string[], init: ResponseInit = { status: 200 }): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  // jsdom Response doesn't always wire `.body` to a ReadableStream, so build a
  // minimal duck-typed Response the consumer needs (ok, status, body, clone).
  return {
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    body: stream,
    clone() {
      return this;
    },
    async json() {
      return {};
    },
  } as unknown as Response;
}

const frame = (event: string, data: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

const PARAMS = {
  intake: { description: 'x', language: 'en' as const, goal: 'decide' as const },
};

describe('C1 — streaming consumer (FE)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('drives plan → 2×section → done in order and returns the done payload', async () => {
    const outline = { documentType: 'generic_document', title: 'Doc', sections: [] };
    const sec0: DocumentStreamSectionEvent = {
      sectionId: 's0',
      index: 0,
      total: 2,
      title: 'Executive Summary',
      blocks: [{ blockId: 'b0', type: 'paragraph', content: { text: 'a' } }],
    };
    const sec1: DocumentStreamSectionEvent = {
      sectionId: 's1',
      index: 1,
      total: 2,
      title: 'Findings',
      blocks: [{ blockId: 'b1', type: 'paragraph', content: { text: 'b' } }],
    };
    const donePayload = {
      artifactId: 'art-1',
      schema: { title: 'Doc', sections: [] },
      generationWarnings: [],
    };

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          ':\n\n', // heartbeat — ignored
          frame('plan', { outline }),
          frame('section', sec0),
          frame('section', sec1),
          frame('done', donePayload),
        ])
      )
    );

    const order: string[] = [];
    const sections: DocumentStreamSectionEvent[] = [];
    const result = await generateDocumentStudioArtifactStream(PARAMS, {
      onPlan: () => order.push('plan'),
      onSection: (e) => {
        order.push(`section:${e.index}`);
        sections.push(e);
      },
      onWarning: () => order.push('warning'),
    });

    expect(order).toEqual(['plan', 'section:0', 'section:1']);
    expect(sections.map((s) => s.title)).toEqual(['Executive Summary', 'Findings']);
    expect(result.artifactId).toBe('art-1');
    expect(result.generationWarnings).toEqual([]);
  });

  it('reassembles a frame split across two chunks', async () => {
    const outline = { documentType: 'generic_document', title: 'Doc', sections: [] };
    const donePayload = { artifactId: 'art-2', schema: {}, generationWarnings: [] };
    const planFrame = frame('plan', { outline });
    const mid = Math.floor(planFrame.length / 2);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          planFrame.slice(0, mid), // first half of the plan frame
          planFrame.slice(mid), // second half completes it
          frame('done', donePayload),
        ])
      )
    );

    let planned = 0;
    const result = await generateDocumentStudioArtifactStream(PARAMS, {
      onPlan: () => {
        planned += 1;
      },
    });
    expect(planned).toBe(1);
    expect(result.artifactId).toBe('art-2');
  });

  it('forwards warning events to onWarning', async () => {
    const warning = {
      code: 'llm_prose_fallback',
      scope: 'document',
      message: 'stub',
      occurredAt: '2026-01-01T00:00:00.000Z',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([
          frame('warning', warning),
          frame('done', { artifactId: 'a', schema: {}, generationWarnings: [warning] }),
        ])
      )
    );
    const warnings: unknown[] = [];
    await generateDocumentStudioArtifactStream(PARAMS, { onWarning: (w) => warnings.push(w) });
    expect(warnings).toHaveLength(1);
    expect((warnings[0] as { code: string }).code).toBe('llm_prose_fallback');
  });

  it('rejects with DocumentStreamError on a fatal error event', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        sseResponse([frame('error', { code: 'generate_failed', message: 'boom' })])
      )
    );
    await expect(generateDocumentStudioArtifactStream(PARAMS)).rejects.toBeInstanceOf(
      DocumentStreamError
    );
  });

  it('rejects on a non-200 response so the caller can fall back to sync', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => sseResponse([], { status: 500 }))
    );
    await expect(generateDocumentStudioArtifactStream(PARAMS)).rejects.toThrow();
  });
});
