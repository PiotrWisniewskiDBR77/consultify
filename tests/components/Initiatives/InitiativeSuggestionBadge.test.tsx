/**
 * @vitest-environment jsdom
 *
 * InitiativeSuggestionBadge — F2 badge kontekstowy „AI sugeruje inicjatywę".
 *
 * Lockujemy zachowanie:
 *   - renderuje się gdy pending-kandydat pasuje do (sourceType, sourceId),
 *   - ukryty gdy brak dopasowania (inny source / pusta lista / błąd fetcha),
 *   - klik z `onCreate` → woła handler z kandydatem i znika,
 *   - klik bez `onCreate` → POST /accept i znika po sukcesie,
 *   - błąd fetcha listy = fail-soft (nic nie renderuje, host nietknięty).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// i18n mock — zwraca fallback (2. argument) jak runtime t(key, fallback).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: string) => fallback ?? _k,
    i18n: { language: 'pl' },
  }),
}));

vi.mock('lucide-react', () => ({
  Sparkles: (p: any) => <span data-testid="suggestion-badge-icon" {...p} />,
  Loader2: (p: any) => <span data-testid="suggestion-badge-spinner" {...p} />,
}));

vi.mock('@/services/api/baseClient', () => ({
  API_URL: '/api',
  getHeaders: () => ({ 'Content-Type': 'application/json' }),
}));

import { InitiativeSuggestionBadge } from '@/components/Initiatives/InitiativeSuggestionBadge';

const candidate = {
  id: 'cand-1',
  sourceType: 'audit',
  sourceId: 'audit-42',
  title: 'Inicjatywa: braki w ICT',
  rationale: 'AI sugeruje inicjatywę na podstawie audytu',
  fitScore: 0.8,
  status: 'pending',
};

function mockFetchOnce(
  candidates: any[],
  opts: { acceptOk?: boolean; receiptPersisted?: boolean } = {}
) {
  const calls: Array<{ url: string; method?: string }> = [];
  const fn = vi.fn((url: string, init?: RequestInit) => {
    calls.push({ url, method: init?.method });
    // accept endpoint
    if (url.includes('/accept')) {
      return Promise.resolve({
        ok: opts.acceptOk !== false,
        status: opts.acceptOk !== false ? 200 : 500,
        json: () =>
          Promise.resolve({
            accepted: opts.receiptPersisted !== false,
            receiptPersisted: opts.receiptPersisted !== false,
            payload: {},
          }),
      } as unknown as Response);
    }
    // list endpoint
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ candidates, total: candidates.length }),
    } as unknown as Response);
  });
  (global as any).fetch = fn;
  return { fn, calls };
}

describe('InitiativeSuggestionBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    delete (global as any).fetch;
  });

  it('renders the badge when a pending candidate matches the source', async () => {
    mockFetchOnce([candidate]);
    render(<InitiativeSuggestionBadge sourceType="audit" sourceId="audit-42" />);
    expect(await screen.findByText('AI suggests an initiative')).toBeInTheDocument();
    expect(screen.getByTestId('suggestion-badge-icon')).toBeInTheDocument();
  });

  it('queries the pending candidates endpoint with status=pending', async () => {
    const { calls } = mockFetchOnce([candidate]);
    render(<InitiativeSuggestionBadge sourceType="audit" sourceId="audit-42" />);
    await screen.findByRole('button');
    expect(calls[0].url).toContain('/api/initiatives/candidates');
    expect(calls[0].url).toContain('status=pending');
  });

  it('stays hidden when no candidate matches this source', async () => {
    mockFetchOnce([{ ...candidate, sourceId: 'OTHER' }]);
    const { container } = render(
      <InitiativeSuggestionBadge sourceType="audit" sourceId="audit-42" />
    );
    // give the effect a tick; nothing should render
    await waitFor(() => {
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
    expect(container.querySelector('button')).toBeNull();
  });

  it('stays hidden when the candidate list is empty', async () => {
    mockFetchOnce([]);
    render(<InitiativeSuggestionBadge sourceType="audit" sourceId="audit-42" />);
    await waitFor(() => {
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  it('matches only when BOTH sourceType and sourceId agree (different type → hidden)', async () => {
    // candidate is for audit/audit-42; host is assessment/audit-42 → must NOT match
    mockFetchOnce([candidate]);
    render(<InitiativeSuggestionBadge sourceType="assessment" sourceId="audit-42" />);
    await waitFor(() => {
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  it('calls onCreate with the matched candidate and hides after click', async () => {
    mockFetchOnce([candidate]);
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(
      <InitiativeSuggestionBadge
        sourceType="audit"
        sourceId="audit-42"
        onCreate={onCreate}
      />
    );
    const btn = await screen.findByRole('button');
    fireEvent.click(btn);
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cand-1', sourceId: 'audit-42' })
    );
    await waitFor(() => {
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  it('falls back to POST /accept when no onCreate is provided', async () => {
    const { calls } = mockFetchOnce([candidate], { acceptOk: true });
    render(<InitiativeSuggestionBadge sourceType="audit" sourceId="audit-42" />);
    const btn = await screen.findByRole('button');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(calls.some((c) => c.url.includes('/accept') && c.method === 'POST')).toBe(
        true
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  it('keeps the badge visible when HTTP succeeds but the durable receipt is missing', async () => {
    const { calls } = mockFetchOnce([candidate], {
      acceptOk: true,
      receiptPersisted: false,
    });
    render(<InitiativeSuggestionBadge sourceType="audit" sourceId="audit-42" />);
    const btn = await screen.findByRole('button');
    fireEvent.click(btn);
    await waitFor(() => {
      expect(calls.some((c) => c.url.includes('/accept') && c.method === 'POST')).toBe(
        true
      );
      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByRole('button')).not.toBeDisabled();
    });
  });

  it('is fail-soft: list fetch error renders nothing', async () => {
    (global as any).fetch = vi.fn(() => Promise.reject(new Error('network')));
    const { container } = render(
      <InitiativeSuggestionBadge sourceType="audit" sourceId="audit-42" />
    );
    await waitFor(() => {
      expect(container.querySelector('button')).toBeNull();
    });
  });
});
