// @vitest-environment jsdom
/**
 * Unit tests — useTemplateSuggestion hook (T4)
 *
 * FT-1: ≥3 testy pokrycia hooka (fetch call, loading state, error handling).
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mockujemy globalny fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('useTemplateSuggestion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // FT-1.1 — suggest wywołuje POST /api/deliverables/templates/suggest z prawidłowymi danymi
  it('suggest calls POST /api/deliverables/templates/suggest', async () => {
    const mockSuggestion = {
      templateId: 'dbr77-doc-audit-report',
      confidence: 'high',
      reasoning: 'Keyword match (score 2): audit, raport',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ suggestion: mockSuggestion }),
    } as Response);

    const { useTemplateSuggestion: mod } = await import(
      '../../../src/components/ReportsAndPresentations/useTemplateSuggestion'
    );
    const { result } = renderHook(() => mod());

    await act(async () => {
      result.current.suggest('raport audytowy', 'doc');
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/deliverables/templates/suggest',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ intent: 'raport audytowy', type: 'doc' }),
      })
    );
    expect(result.current.suggestion).toEqual(mockSuggestion);
  });

  // FT-1.2 — loading=true podczas fetch, false po zakończeniu
  it('sets loading=true during fetch and false after', async () => {
    let resolvePromise!: (value: Response) => void;
    const pendingPromise = new Promise<Response>((resolve) => {
      resolvePromise = resolve;
    });

    mockFetch.mockReturnValueOnce(pendingPromise);

    const { useTemplateSuggestion: mod } = await import(
      '../../../src/components/ReportsAndPresentations/useTemplateSuggestion'
    );
    const { result } = renderHook(() => mod());

    // Uruchamiamy suggest ale NIE czekamy
    act(() => {
      result.current.suggest('board deck', 'deck');
    });

    // Powinien być loading=true
    await waitFor(() => expect(result.current.loading).toBe(true));

    // Rozwiązujemy promise
    await act(async () => {
      resolvePromise({
        ok: true,
        json: async () => ({ suggestion: null }),
      } as Response);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  // FT-1.3 — błąd fetch → suggestion=null, loading=false
  it('on fetch error: suggestion=null, loading=false', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { useTemplateSuggestion: mod } = await import(
      '../../../src/components/ReportsAndPresentations/useTemplateSuggestion'
    );
    const { result } = renderHook(() => mod());

    await act(async () => {
      result.current.suggest('ryzyko', 'table');
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.suggestion).toBeNull();
  });

  // FT-1.4 — HTTP error (ok=false) → suggestion=null
  it('on non-ok response: suggestion=null, loading=false', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Bad request' }),
    } as Response);

    const { useTemplateSuggestion: mod } = await import(
      '../../../src/components/ReportsAndPresentations/useTemplateSuggestion'
    );
    const { result } = renderHook(() => mod());

    await act(async () => {
      result.current.suggest('', 'doc');
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.suggestion).toBeNull();
  });

  // FT-1.5 — reset() czyści stan
  it('reset clears suggestion and loading', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ suggestion: { templateId: 'dbr77-doc-audit-report', confidence: 'high', reasoning: 'test' } }),
    } as Response);

    const { useTemplateSuggestion: mod } = await import(
      '../../../src/components/ReportsAndPresentations/useTemplateSuggestion'
    );
    const { result } = renderHook(() => mod());

    await act(async () => {
      result.current.suggest('audit', 'doc');
    });
    await waitFor(() => expect(result.current.suggestion).not.toBeNull());

    act(() => {
      result.current.reset();
    });

    expect(result.current.suggestion).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
