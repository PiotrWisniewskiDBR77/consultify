import { beforeEach, describe, expect, it, vi } from 'vitest';

// Force the AI-first path to yield nothing so the deterministic fallback is tested.
vi.mock('@/services/api', () => ({
  Api: { post: vi.fn(() => Promise.resolve({ data: {} })) },
}));

import { proposeCandidates } from '@/services/initiatives/proposeCandidates';

describe('proposeCandidates — deterministic fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('(a) parses ≥1 candidate from multi-line text', async () => {
    const text = [
      '- Reduce onboarding time for new hires',
      '- Standardize the handoff process between teams',
      'Random non-actionable note about lunch',
    ].join('\n');

    const out = await proposeCandidates({ text });
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out.every((c) => typeof c.title === 'string' && c.title.length > 0)).toBe(true);
    expect(out.every((c) => c.title.length <= 80)).toBe(true);
  });

  it('(b) caps at maxCandidates', async () => {
    const lines = Array.from({ length: 10 }, (_, i) => `- Improve workflow area number ${i}`);
    const out = await proposeCandidates({ text: lines.join('\n') }, { maxCandidates: 3 });
    expect(out.length).toBe(3);
  });

  it('(c) never throws on empty text and still yields a candidate', async () => {
    await expect(proposeCandidates({ text: '' })).resolves.toBeDefined();
    const out = await proposeCandidates({ text: '', label: 'My source' });
    expect(out.length).toBe(1);
    expect(out[0].title).toBe('My source');
  });
});
