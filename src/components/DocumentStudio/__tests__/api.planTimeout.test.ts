/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { planDocumentStudioOutline } from '../api';
import type { DocumentIntake, DocumentOutline } from '../types';

const intake = {
  description: 'Przygotuj plan dokumentu zarządczego.',
  language: 'pl',
} as DocumentIntake;

const outline = {
  documentType: 'executive_summary',
  title: 'Plan dokumentu',
  sections: [],
} as unknown as DocumentOutline;

describe('planDocumentStudioOutline timeout contract', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not abandon a valid LLM plan response arriving just after 20 seconds', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((resolve, reject) => {
          const responseTimer = window.setTimeout(
            () =>
              resolve({
                ok: true,
                status: 200,
                json: async () => ({ outline, llmRefined: true }),
              } as Response),
            20_080
          );
          init?.signal?.addEventListener('abort', () => {
            window.clearTimeout(responseTimer);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = planDocumentStudioOutline(intake, { useLlm: true });
    const assertion = expect(resultPromise).resolves.toEqual(outline);
    await vi.advanceTimersByTimeAsync(20_080);
    await assertion;

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/document-studio/plan',
      expect.objectContaining({ method: 'POST', signal: expect.any(AbortSignal) })
    );
  });
});
