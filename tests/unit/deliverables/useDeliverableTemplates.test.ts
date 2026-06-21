/**
 * Unit tests — useDeliverableTemplates hook
 *
 * Środowisko jsdom, fetch mockowany globalnie.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Komponent jest .ts (nie .tsx) więc importujemy bezpośrednio
import { useDeliverableTemplates } from '../../../src/components/ReportsAndPresentations/useDeliverableTemplates';

describe('useDeliverableTemplates', () => {
  const SAMPLE_TEMPLATES = [
    { id: 'd1', name: 'Corporate Deck', description: null, isBlank: false, isSystem: true, type: 'deck' },
    { id: 'd2', name: 'Blank', description: null, isBlank: true, isSystem: true, type: 'deck' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // FT-1.1 — fetches templates when type set
  it('fetches templates when type is set', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ templates: SAMPLE_TEMPLATES }),
    }) as any;

    const { result } = renderHook(() => useDeliverableTemplates('deck'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.templates).toEqual(SAMPLE_TEMPLATES);
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      '/api/deliverables/templates?type=deck',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  // FT-1.2 — loading=true while pending
  it('sets loading=true while fetch is pending', async () => {
    let resolveFetch!: (v: any) => void;
    const pending = new Promise<any>((resolve) => { resolveFetch = resolve; });
    global.fetch = vi.fn().mockReturnValue(pending) as any;

    const { result } = renderHook(() => useDeliverableTemplates('doc'));

    expect(result.current.loading).toBe(true);

    // Resolve to avoid dangling promise
    resolveFetch({ ok: true, json: async () => ({ templates: [] }) });
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  // FT-1.3 — error set on network failure
  it('sets error on network failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as any;

    const { result } = renderHook(() => useDeliverableTemplates('table'));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.templates).toEqual([]);
  });

  // FT-1.4 — null type → nie fetches
  it('does not fetch when type is null', () => {
    global.fetch = vi.fn() as any;
    renderHook(() => useDeliverableTemplates(null));
    expect(fetch).not.toHaveBeenCalled();
  });

  // FT-1.5 — mapuje 'report' na 'doc' w URL
  it('maps DeliverableType "report" to API type "doc"', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ templates: [] }),
    }) as any;

    renderHook(() => useDeliverableTemplates('report'));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/deliverables/templates?type=doc',
        expect.anything()
      );
    });
  });
});
