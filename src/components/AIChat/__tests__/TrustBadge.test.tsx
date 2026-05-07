/**
 * Chat V9 / TRUST T-TR1 — tests for the AI response trust badge.
 *
 * Coverage:
 *   - Flag gate on/off.
 *   - Source count rendering: zero / few / many / malformed payloads.
 *   - Model label rendering only when present.
 *   - Popover open/close (click + Escape + outside click).
 *   - Telemetry: emits `trust_badge_opened` with a **bucketed** count —
 *     never the raw number, never any text from the citations.
 *   - PII guard: telemetry payload is a closed enum.
 *   - Telemetry failures never break the popover.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TrustBadge } from '../TrustBadge';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (
      _key: string,
      fallback?: string | Record<string, unknown>,
      vars?: Record<string, unknown>
    ) => {
      if (typeof fallback === 'string') {
        // Simple `{{token}}` substitution so tests can assert on rendered
        // counts without pulling in the real i18n pipeline.
        let out = fallback;
        const bag = (vars ?? fallback) as Record<string, unknown>;
        if (typeof bag === 'object' && bag !== null) {
          for (const [k, v] of Object.entries(bag)) {
            out = out.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
          }
        }
        return out;
      }
      return _key;
    },
  }),
}));

const trackFunnelEventMock = vi.fn();
vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: (...args: unknown[]) => trackFunnelEventMock(...args),
}));

const validCitation = (i: number) => ({
  id: `c-${i}`,
  title: `Citation ${i}`,
  type: 'external' as const,
  reference: `ref-${i}`,
});

describe('TrustBadge', () => {
  beforeEach(() => {
    trackFunnelEventMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------
  // Flag gate.
  // -------------------------------------------------------------------
  it('renders nothing when the flag is disabled', () => {
    const { container } = render(<TrustBadge isEnabled={() => false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the badge when the flag is enabled', () => {
    render(<TrustBadge isEnabled={() => true} citations={[validCitation(1)]} />);
    expect(screen.getByTestId('trust-badge-trigger')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------
  // Source label.
  // -------------------------------------------------------------------
  it('renders nothing when citations is empty', () => {
    render(<TrustBadge isEnabled={() => true} citations={[]} />);
    expect(screen.queryByTestId('trust-badge-trigger')).not.toBeInTheDocument();
  });

  it('renders nothing when citations is missing entirely', () => {
    render(<TrustBadge isEnabled={() => true} />);
    expect(screen.queryByTestId('trust-badge-trigger')).not.toBeInTheDocument();
  });

  it('renders the source count when citations contain valid entries', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        citations={[validCitation(1), validCitation(2), validCitation(3)]}
      />
    );
    expect(screen.getByTestId('trust-badge-trigger')).toHaveTextContent('3 sources');
    expect(screen.getByTestId('trust-badge-trigger')).toHaveAttribute('data-source-count', '3');
  });

  it('ignores malformed citation entries without throwing', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        citations={[
          validCitation(1),
          null,
          'not an object',
          { id: 'missing-title' },
          validCitation(2),
        ]}
      />
    );
    expect(screen.getByTestId('trust-badge-trigger')).toHaveAttribute('data-source-count', '3');
  });

  it('does not render for a non-array citations value', () => {
    render(<TrustBadge isEnabled={() => true} citations={{ foo: 'bar' } as unknown} />);
    expect(screen.queryByTestId('trust-badge-trigger')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------
  // Model label.
  // -------------------------------------------------------------------
  it('renders the model label only when a non-empty string is provided', () => {
    const { rerender } = render(
      <TrustBadge isEnabled={() => true} modelUsed="GPT-4o" citations={[validCitation(1)]} />
    );
    expect(screen.getByTestId('trust-badge-model')).toHaveTextContent('GPT-4o');

    rerender(<TrustBadge isEnabled={() => true} modelUsed="   " citations={[validCitation(1)]} />);
    expect(screen.queryByTestId('trust-badge-model')).not.toBeInTheDocument();

    rerender(<TrustBadge isEnabled={() => true} modelUsed={null} citations={[validCitation(1)]} />);
    expect(screen.queryByTestId('trust-badge-model')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------
  // Popover interaction.
  // -------------------------------------------------------------------
  it('opens the popover on click and closes it on a second click', () => {
    render(<TrustBadge isEnabled={() => true} citations={[validCitation(1)]} />);
    const trigger = screen.getByTestId('trust-badge-trigger');

    fireEvent.click(trigger);
    expect(screen.getByTestId('trust-badge-popover')).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByTestId('trust-badge-popover')).not.toBeInTheDocument();
  });

  it('closes the popover on Escape', () => {
    render(<TrustBadge isEnabled={() => true} citations={[validCitation(1)]} />);
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('trust-badge-popover')).not.toBeInTheDocument();
  });

  it('closes the popover on outside click', () => {
    render(
      <div>
        <TrustBadge isEnabled={() => true} citations={[validCitation(1)]} />
        <div data-testid="outside">outside</div>
      </div>
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByTestId('trust-badge-popover')).not.toBeInTheDocument();
  });

  it('renders up to 5 citation titles and a "more" hint when there are additional ones', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        citations={Array.from({ length: 7 }, (_, i) => validCitation(i + 1))}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));

    const list = screen.getByTestId('trust-badge-source-list');
    expect(list.querySelectorAll('li')).toHaveLength(5);
    expect(screen.getByText('… and 2 more in the full list below.')).toBeInTheDocument();
  });

  it('does not render the badge for an empty reply', () => {
    render(<TrustBadge isEnabled={() => true} />);
    expect(screen.queryByTestId('trust-badge-trigger')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------
  // Telemetry — critical PII contract.
  // -------------------------------------------------------------------
  it('emits `trust_badge_opened` with a bucketed count, never the raw number', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        modelUsed="gpt-4o"
        citations={Array.from({ length: 12 }, (_, i) => validCitation(i + 1))}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));

    expect(trackFunnelEventMock).toHaveBeenCalledTimes(1);
    const [eventName, payload] = trackFunnelEventMock.mock.calls[0];
    expect(eventName).toBe('trust_badge_opened');
    expect(payload).toEqual({ sourceCount: 'many', hasModel: true });
    // Explicit regression test: raw counts / titles / model names must
    // never appear in the payload.
    expect(payload).not.toHaveProperty('count');
    expect(payload).not.toHaveProperty('modelUsed');
    expect(payload).not.toHaveProperty('titles');
  });

  it('buckets source counts correctly: few / many', () => {
    const cases: Array<{ n: number; bucket: 'few' | 'many' }> = [
      { n: 1, bucket: 'few' },
      { n: 3, bucket: 'few' },
      { n: 4, bucket: 'many' },
      { n: 25, bucket: 'many' },
    ];
    for (const { n, bucket } of cases) {
      trackFunnelEventMock.mockReset();
      const { unmount } = render(
        <TrustBadge
          isEnabled={() => true}
          citations={Array.from({ length: n }, (_, i) => validCitation(i + 1))}
        />
      );
      fireEvent.click(screen.getByTestId('trust-badge-trigger'));
      expect(trackFunnelEventMock.mock.calls[0][1]).toEqual({
        sourceCount: bucket,
        hasModel: false,
      });
      unmount();
    }
  });

  it('still opens the popover when telemetry throws', () => {
    trackFunnelEventMock.mockImplementationOnce(() => {
      throw new Error('sink exploded');
    });
    render(<TrustBadge isEnabled={() => true} citations={[validCitation(1)]} />);
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    expect(screen.getByTestId('trust-badge-popover')).toBeInTheDocument();
  });

  // -------------------------------------------------------------------
  // T-TR1.2 — humanizer flag + "Answered by" popover line.
  // -------------------------------------------------------------------
  it('humanizes the raw model id when the humanizer flag is ON', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isHumanizeModelEnabled={() => true}
        modelUsed="gpt-4o-2024-08-06"
        citations={[validCitation(1)]}
      />
    );
    expect(screen.getByTestId('trust-badge-model')).toHaveTextContent('GPT-4o');
    expect(screen.getByTestId('trust-badge-model')).not.toHaveTextContent('2024');
  });

  it('falls back to the raw trimmed id when the humanizer flag is OFF', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isHumanizeModelEnabled={() => false}
        modelUsed="  gpt-4o-2024-08-06  "
        citations={[validCitation(1)]}
      />
    );
    expect(screen.getByTestId('trust-badge-model')).toHaveTextContent('gpt-4o-2024-08-06');
  });

  it('masks UUID-like model ids to "Private model" when humanizer is ON', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isHumanizeModelEnabled={() => true}
        modelUsed="e3b0c442-98fc-1c14-9afb-c4e9c4e9c4e9"
        citations={[validCitation(1)]}
      />
    );
    expect(screen.getByTestId('trust-badge-model')).toHaveTextContent('Private model');
  });

  it('renders the "Answered by" line in the popover when humanizer is ON and a model is present', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isHumanizeModelEnabled={() => true}
        modelUsed="claude-3-5-sonnet-20241022"
        citations={[validCitation(1)]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    const answeredBy = screen.getByTestId('trust-badge-answered-by');
    expect(answeredBy).toBeInTheDocument();
    expect(answeredBy).toHaveTextContent('Claude 3.5 Sonnet');
  });

  it('omits the "Answered by" line when humanizer is OFF', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isHumanizeModelEnabled={() => false}
        modelUsed="claude-3-5-sonnet-20241022"
        citations={[validCitation(1)]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    expect(screen.queryByTestId('trust-badge-answered-by')).not.toBeInTheDocument();
  });

  it('omits the "Answered by" line when no model is available even if humanizer is ON', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isHumanizeModelEnabled={() => true}
        citations={[validCitation(1)]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    expect(screen.queryByTestId('trust-badge-answered-by')).not.toBeInTheDocument();
  });

  it('telemetry `hasModel` still reflects the humanized presence (UUID masked → true)', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isHumanizeModelEnabled={() => true}
        modelUsed="e3b0c442-98fc-1c14-9afb-c4e9c4e9c4e9"
        citations={[validCitation(1)]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    expect(trackFunnelEventMock.mock.calls[0][1]).toMatchObject({ hasModel: true });
  });

  // -------------------------------------------------------------------
  // T-TR1.3 — Copy citations button.
  // -------------------------------------------------------------------
  const linkedCitation = (i: number, link?: string) => ({
    id: `c-${i}`,
    title: `Citation ${i}`,
    type: 'external' as const,
    reference: `ref-${i}`,
    ...(link ? { link } : {}),
  });

  it('does not render the Copy button when the copy-citations flag is OFF', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isCopyCitationsEnabled={() => false}
        citations={[linkedCitation(1)]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    expect(screen.queryByTestId('trust-badge-copy-citations')).not.toBeInTheDocument();
  });

  it('does not render the badge when there are no citations (flag ON)', () => {
    render(<TrustBadge isEnabled={() => true} isCopyCitationsEnabled={() => true} />);
    expect(screen.queryByTestId('trust-badge-trigger')).not.toBeInTheDocument();
  });

  it('renders the Copy button when flag is ON and there is at least one citation', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isCopyCitationsEnabled={() => true}
        citations={[linkedCitation(1)]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    const btn = screen.getByTestId('trust-badge-copy-citations');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('data-copy-state', 'idle');
  });

  it('calls writeToClipboard with the Markdown payload including the humanised model label', async () => {
    const writer = vi.fn().mockResolvedValue({ ok: true, via: 'async' } as const);
    render(
      <TrustBadge
        isEnabled={() => true}
        isCopyCitationsEnabled={() => true}
        isHumanizeModelEnabled={() => true}
        modelUsed="gpt-4o-2024-08-06"
        citations={[linkedCitation(1, 'https://example.com/one'), linkedCitation(2)]}
        writeToClipboard={writer}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('trust-badge-copy-citations'));
    });
    expect(writer).toHaveBeenCalledTimes(1);
    const payload = writer.mock.calls[0][0] as string;
    expect(payload).toContain('Sources for this reply (answered by GPT-4o):');
    expect(payload).toContain('1. [Citation 1](https://example.com/one) — ref:ref-1');
    expect(payload).toContain('2. Citation 2 — ref:ref-2');
  });

  it('omits the "answered by" header line from the payload when humanizer is OFF', async () => {
    const writer = vi.fn().mockResolvedValue({ ok: true, via: 'async' } as const);
    render(
      <TrustBadge
        isEnabled={() => true}
        isCopyCitationsEnabled={() => true}
        isHumanizeModelEnabled={() => false}
        modelUsed="gpt-4o-2024-08-06"
        citations={[linkedCitation(1)]}
        writeToClipboard={writer}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('trust-badge-copy-citations'));
    });
    const payload = writer.mock.calls[0][0] as string;
    expect(payload.startsWith('Sources for this reply:')).toBe(true);
    expect(payload).not.toContain('answered by');
  });

  it('transitions to the "copied" state after a successful write', async () => {
    const writer = vi.fn().mockResolvedValue({ ok: true, via: 'async' } as const);
    render(
      <TrustBadge
        isEnabled={() => true}
        isCopyCitationsEnabled={() => true}
        citations={[linkedCitation(1)]}
        writeToClipboard={writer}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('trust-badge-copy-citations'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('trust-badge-copy-citations')).toHaveAttribute(
        'data-copy-state',
        'copied'
      );
    });
  });

  it('transitions to the "failed" state when the writer reports a failure', async () => {
    const writer = vi.fn().mockResolvedValue({ ok: false, reason: 'denied' } as const);
    render(
      <TrustBadge
        isEnabled={() => true}
        isCopyCitationsEnabled={() => true}
        citations={[linkedCitation(1)]}
        writeToClipboard={writer}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('trust-badge-copy-citations'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('trust-badge-copy-citations')).toHaveAttribute(
        'data-copy-state',
        'failed'
      );
    });
  });

  it('transitions to "failed" when the writer throws synchronously', async () => {
    const writer = vi.fn().mockRejectedValue(new Error('boom'));
    render(
      <TrustBadge
        isEnabled={() => true}
        isCopyCitationsEnabled={() => true}
        citations={[linkedCitation(1)]}
        writeToClipboard={writer}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('trust-badge-copy-citations'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('trust-badge-copy-citations')).toHaveAttribute(
        'data-copy-state',
        'failed'
      );
    });
  });

  it('closing the popover resets feedback so reopening shows the idle label again', async () => {
    const writer = vi.fn().mockResolvedValue({ ok: true, via: 'async' } as const);
    render(
      <TrustBadge
        isEnabled={() => true}
        isCopyCitationsEnabled={() => true}
        citations={[linkedCitation(1)]}
        writeToClipboard={writer}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('trust-badge-copy-citations'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('trust-badge-copy-citations')).toHaveAttribute(
        'data-copy-state',
        'copied'
      );
    });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('trust-badge-copy-citations')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    expect(screen.getByTestId('trust-badge-copy-citations')).toHaveAttribute(
      'data-copy-state',
      'idle'
    );
  });

  it('never emits telemetry from the Copy button (stays a pure local affordance)', async () => {
    const writer = vi.fn().mockResolvedValue({ ok: true, via: 'async' } as const);
    render(
      <TrustBadge
        isEnabled={() => true}
        isCopyCitationsEnabled={() => true}
        citations={[linkedCitation(1)]}
        writeToClipboard={writer}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    trackFunnelEventMock.mockClear();
    await act(async () => {
      fireEvent.click(screen.getByTestId('trust-badge-copy-citations'));
    });
    expect(trackFunnelEventMock).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------
  // T-TR2 — "Why this answer?" reasoning disclosure.
  // -------------------------------------------------------------------
  it('T-TR2: does not render the reasoning disclosure when the flag is OFF', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isReasoningEnabled={() => false}
        citations={[validCitation(1), validCitation(2)]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    expect(screen.queryByTestId('trust-badge-reasoning')).not.toBeInTheDocument();
    expect(screen.queryByTestId('trust-badge-reasoning-toggle')).not.toBeInTheDocument();
  });

  it('T-TR2: renders the toggle collapsed when the flag is ON', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isReasoningEnabled={() => true}
        citations={[validCitation(1)]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    const toggle = screen.getByTestId('trust-badge-reasoning-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('trust-badge-reasoning-body')).not.toBeInTheDocument();
  });

  it('T-TR2: clicking the toggle expands the body with the ordered observation ids', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isReasoningEnabled={() => true}
        isHumanizeModelEnabled={() => true}
        modelUsed="gpt-4o"
        citations={[validCitation(1), validCitation(2), validCitation(3), validCitation(4)]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    fireEvent.click(screen.getByTestId('trust-badge-reasoning-toggle'));

    expect(screen.getByTestId('trust-badge-reasoning-body')).toBeInTheDocument();
    // Retrieval bucket at 4 sources is `strong`.
    expect(screen.getByTestId('trust-badge-reasoning-retrieval-strong')).toBeInTheDocument();
    expect(screen.getByTestId('trust-badge-reasoning-model-known')).toBeInTheDocument();
    expect(screen.getByTestId('trust-badge-reasoning-verify')).toBeInTheDocument();
  });

  it('T-TR2: does not render for degraded input without citations', () => {
    render(<TrustBadge isEnabled={() => true} isReasoningEnabled={() => true} citations={undefined} />);
    expect(screen.queryByTestId('trust-badge-trigger')).not.toBeInTheDocument();
  });

  it('T-TR2: a second toggle click collapses the body', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isReasoningEnabled={() => true}
        citations={[validCitation(1)]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    fireEvent.click(screen.getByTestId('trust-badge-reasoning-toggle'));
    expect(screen.getByTestId('trust-badge-reasoning-body')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('trust-badge-reasoning-toggle'));
    expect(screen.queryByTestId('trust-badge-reasoning-body')).not.toBeInTheDocument();
  });

  it('T-TR2: closing the popover resets the disclosure so re-opening starts collapsed', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isReasoningEnabled={() => true}
        citations={[validCitation(1)]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    fireEvent.click(screen.getByTestId('trust-badge-reasoning-toggle'));
    expect(screen.getByTestId('trust-badge-reasoning-body')).toBeInTheDocument();

    // Close popover.
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    // Re-open.
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    expect(screen.queryByTestId('trust-badge-reasoning-body')).not.toBeInTheDocument();
    expect(screen.getByTestId('trust-badge-reasoning-toggle').getAttribute('aria-expanded')).toBe(
      'false'
    );
  });

  it('T-TR2: emits zero telemetry events from the reasoning toggle', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isReasoningEnabled={() => true}
        citations={[validCitation(1)]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    trackFunnelEventMock.mockClear();
    fireEvent.click(screen.getByTestId('trust-badge-reasoning-toggle'));
    fireEvent.click(screen.getByTestId('trust-badge-reasoning-toggle'));
    expect(trackFunnelEventMock).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------
  // T-TR1.4 — Copy reasoning button.
  // -------------------------------------------------------------------
  const openAndExpandReasoning = () => {
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    fireEvent.click(screen.getByTestId('trust-badge-reasoning-toggle'));
  };

  it('T-TR1.4: does not render the copy-reasoning button when its kill-switch is OFF', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isReasoningEnabled={() => true}
        isCopyReasoningEnabled={() => false}
        citations={[validCitation(1)]}
      />
    );
    openAndExpandReasoning();
    expect(screen.queryByTestId('trust-badge-copy-reasoning')).not.toBeInTheDocument();
  });

  it('T-TR1.4: does not render the button when the reasoning disclosure is collapsed', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isReasoningEnabled={() => true}
        isCopyReasoningEnabled={() => true}
        citations={[validCitation(1)]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    // Deliberately do NOT expand the disclosure.
    expect(screen.queryByTestId('trust-badge-copy-reasoning')).not.toBeInTheDocument();
  });

  it('T-TR1.4: renders the button inside the expanded disclosure when both flags are ON', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isReasoningEnabled={() => true}
        isCopyReasoningEnabled={() => true}
        citations={[validCitation(1)]}
      />
    );
    openAndExpandReasoning();
    const btn = screen.getByTestId('trust-badge-copy-reasoning');
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('data-copy-state', 'idle');
    const body = screen.getByTestId('trust-badge-reasoning-body');
    expect(body.contains(btn)).toBe(true);
  });

  it('T-TR1.4: writes a deterministic Markdown payload including the humanised model label', async () => {
    const writer = vi.fn().mockResolvedValue({ ok: true, via: 'async' } as const);
    render(
      <TrustBadge
        isEnabled={() => true}
        isReasoningEnabled={() => true}
        isCopyReasoningEnabled={() => true}
        isHumanizeModelEnabled={() => true}
        modelUsed="gpt-4o-2024-08-06"
        citations={[validCitation(1), validCitation(2), validCitation(3), validCitation(4)]}
        writeToClipboard={writer}
      />
    );
    openAndExpandReasoning();
    await act(async () => {
      fireEvent.click(screen.getByTestId('trust-badge-copy-reasoning'));
    });
    expect(writer).toHaveBeenCalledTimes(1);
    const payload = writer.mock.calls[0][0] as string;
    expect(payload.startsWith('Why this answer? (answered by GPT-4o):')).toBe(true);
    expect(payload).toContain('1. Grounded in retrieved sources');
    expect(payload).toContain('2. Model used — Generated by GPT-4o.');
    expect(payload).toContain('3. Always verify');
  });

  it('T-TR1.4: omits the "answered by" suffix when the humanizer flag is OFF', async () => {
    const writer = vi.fn().mockResolvedValue({ ok: true, via: 'async' } as const);
    render(
      <TrustBadge
        isEnabled={() => true}
        isReasoningEnabled={() => true}
        isCopyReasoningEnabled={() => true}
        isHumanizeModelEnabled={() => false}
        modelUsed="gpt-4o-2024-08-06"
        citations={[validCitation(1)]}
        writeToClipboard={writer}
      />
    );
    openAndExpandReasoning();
    await act(async () => {
      fireEvent.click(screen.getByTestId('trust-badge-copy-reasoning'));
    });
    const payload = writer.mock.calls[0][0] as string;
    expect(payload.startsWith('Why this answer?:')).toBe(true);
    expect(payload).not.toContain('answered by');
  });

  it('T-TR1.4: transitions to "copied" on success', async () => {
    const writer = vi.fn().mockResolvedValue({ ok: true, via: 'async' } as const);
    render(
      <TrustBadge
        isEnabled={() => true}
        isReasoningEnabled={() => true}
        isCopyReasoningEnabled={() => true}
        citations={[validCitation(1)]}
        writeToClipboard={writer}
      />
    );
    openAndExpandReasoning();
    await act(async () => {
      fireEvent.click(screen.getByTestId('trust-badge-copy-reasoning'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('trust-badge-copy-reasoning')).toHaveAttribute(
        'data-copy-state',
        'copied'
      );
    });
  });

  it('T-TR1.4: transitions to "failed" when the writer reports a failure', async () => {
    const writer = vi.fn().mockResolvedValue({ ok: false, reason: 'denied' } as const);
    render(
      <TrustBadge
        isEnabled={() => true}
        isReasoningEnabled={() => true}
        isCopyReasoningEnabled={() => true}
        citations={[validCitation(1)]}
        writeToClipboard={writer}
      />
    );
    openAndExpandReasoning();
    await act(async () => {
      fireEvent.click(screen.getByTestId('trust-badge-copy-reasoning'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('trust-badge-copy-reasoning')).toHaveAttribute(
        'data-copy-state',
        'failed'
      );
    });
  });

  it('T-TR1.4: transitions to "failed" when the writer throws', async () => {
    const writer = vi.fn().mockRejectedValue(new Error('boom'));
    render(
      <TrustBadge
        isEnabled={() => true}
        isReasoningEnabled={() => true}
        isCopyReasoningEnabled={() => true}
        citations={[validCitation(1)]}
        writeToClipboard={writer}
      />
    );
    openAndExpandReasoning();
    await act(async () => {
      fireEvent.click(screen.getByTestId('trust-badge-copy-reasoning'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('trust-badge-copy-reasoning')).toHaveAttribute(
        'data-copy-state',
        'failed'
      );
    });
  });

  it('T-TR1.4: keeps its feedback state independent of the citations copy button', async () => {
    const writer = vi.fn().mockResolvedValue({ ok: true, via: 'async' } as const);
    render(
      <TrustBadge
        isEnabled={() => true}
        isCopyCitationsEnabled={() => true}
        isReasoningEnabled={() => true}
        isCopyReasoningEnabled={() => true}
        citations={[validCitation(1)]}
        writeToClipboard={writer}
      />
    );
    openAndExpandReasoning();
    // Press both buttons back-to-back; their data-copy-state must
    // evolve independently.
    await act(async () => {
      fireEvent.click(screen.getByTestId('trust-badge-copy-reasoning'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('trust-badge-copy-reasoning')).toHaveAttribute(
        'data-copy-state',
        'copied'
      );
    });
    // Citations copy button stays idle — the two states don't share.
    expect(screen.getByTestId('trust-badge-copy-citations')).toHaveAttribute(
      'data-copy-state',
      'idle'
    );
  });

  it('T-TR1.4: closing the popover resets feedback so reopening shows idle again', async () => {
    const writer = vi.fn().mockResolvedValue({ ok: true, via: 'async' } as const);
    render(
      <TrustBadge
        isEnabled={() => true}
        isReasoningEnabled={() => true}
        isCopyReasoningEnabled={() => true}
        citations={[validCitation(1)]}
        writeToClipboard={writer}
      />
    );
    openAndExpandReasoning();
    await act(async () => {
      fireEvent.click(screen.getByTestId('trust-badge-copy-reasoning'));
    });
    await waitFor(() => {
      expect(screen.getByTestId('trust-badge-copy-reasoning')).toHaveAttribute(
        'data-copy-state',
        'copied'
      );
    });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('trust-badge-copy-reasoning')).not.toBeInTheDocument();
    openAndExpandReasoning();
    expect(screen.getByTestId('trust-badge-copy-reasoning')).toHaveAttribute(
      'data-copy-state',
      'idle'
    );
  });

  it('T-TR1.4: never emits telemetry from the copy-reasoning button', async () => {
    const writer = vi.fn().mockResolvedValue({ ok: true, via: 'async' } as const);
    render(
      <TrustBadge
        isEnabled={() => true}
        isReasoningEnabled={() => true}
        isCopyReasoningEnabled={() => true}
        citations={[validCitation(1)]}
        writeToClipboard={writer}
      />
    );
    openAndExpandReasoning();
    trackFunnelEventMock.mockClear();
    await act(async () => {
      fireEvent.click(screen.getByTestId('trust-badge-copy-reasoning'));
    });
    expect(trackFunnelEventMock).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------
  // T-TR3-lite — per-citation clickable link.
  // -------------------------------------------------------------------
  const citationWithLink = (i: number, link?: string) => ({
    id: `c-${i}`,
    title: `Citation ${i}`,
    type: 'external' as const,
    reference: `ref-${i}`,
    ...(link !== undefined ? { link } : {}),
  });

  it('T-TR3-lite: renders citation rows as plain text when the kill-switch is OFF, even if link is safe', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isCitationLinksEnabled={() => false}
        citations={[citationWithLink(1, 'https://example.com/deck')]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    expect(screen.queryByTestId('trust-badge-citation-link-0')).not.toBeInTheDocument();
    expect(screen.getByTestId('trust-badge-citation-plain-0')).toBeInTheDocument();
  });

  it('T-TR3-lite: renders citation rows as plain text when the link is missing', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isCitationLinksEnabled={() => true}
        citations={[citationWithLink(1)]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    expect(screen.queryByTestId('trust-badge-citation-link-0')).not.toBeInTheDocument();
    expect(screen.getByTestId('trust-badge-citation-plain-0')).toBeInTheDocument();
  });

  it('T-TR3-lite: renders citation rows as plain text when the link is javascript:', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isCitationLinksEnabled={() => true}
        citations={[citationWithLink(1, 'javascript:alert(1)')]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    expect(screen.queryByTestId('trust-badge-citation-link-0')).not.toBeInTheDocument();
    expect(screen.getByTestId('trust-badge-citation-plain-0')).toBeInTheDocument();
  });

  it('T-TR3-lite: renders an <a target="_blank" rel="noopener noreferrer"> when link is a safe https URL', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isCitationLinksEnabled={() => true}
        citations={[citationWithLink(1, 'https://example.com/deck')]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    const link = screen.getByTestId('trust-badge-citation-link-0');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('https://example.com/deck');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    // Title remains visible inside the anchor so the row still
    // reads as a sources list, not a URL dump.
    expect(link.textContent).toContain('Citation 1');
  });

  it('T-TR3-lite: aria-label announces "Open source in a new tab" + title', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isCitationLinksEnabled={() => true}
        citations={[citationWithLink(1, 'https://example.com/deck')]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    const link = screen.getByTestId('trust-badge-citation-link-0');
    expect(link.getAttribute('aria-label')).toBe('Open source in a new tab: Citation 1');
  });

  it('T-TR3-lite: mixes linked and unlinked rows correctly in the same popover', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isCitationLinksEnabled={() => true}
        citations={[
          citationWithLink(1, 'https://example.com/one'),
          citationWithLink(2),
          citationWithLink(3, 'data:text/html,x'),
          citationWithLink(4, 'https://example.com/four'),
        ]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    expect(screen.getByTestId('trust-badge-citation-link-0')).toBeInTheDocument();
    expect(screen.getByTestId('trust-badge-citation-plain-1')).toBeInTheDocument();
    expect(screen.getByTestId('trust-badge-citation-plain-2')).toBeInTheDocument();
    expect(screen.getByTestId('trust-badge-citation-link-3')).toBeInTheDocument();
  });

  it('T-TR3-lite: canonicalises the URL through the sanitiser (uppercase host gets lowercased)', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isCitationLinksEnabled={() => true}
        citations={[citationWithLink(1, 'HTTPS://Example.COM/Path')]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    const link = screen.getByTestId('trust-badge-citation-link-0');
    expect(link.getAttribute('href')).toBe('https://example.com/Path');
  });

  it('T-TR3-lite: never fires telemetry from rendering or clicking a citation link', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isCitationLinksEnabled={() => true}
        citations={[citationWithLink(1, 'https://example.com/deck')]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    trackFunnelEventMock.mockClear();
    // Click the link itself — the popover should not emit any
    // telemetry from the anchor. (The native navigation is a
    // no-op in JSDOM, which is fine; the invariant is about
    // funnel events, not navigation.)
    fireEvent.click(screen.getByTestId('trust-badge-citation-link-0'));
    expect(trackFunnelEventMock).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------
  // T-TR3.4 — citation row domain pill.
  //
  // The pill is gated ONLY by `isCitationDomainEnabled` — independently
  // of `isCitationLinksEnabled`. A row with a safe http(s) URL shows
  // the host (stripped of `www.`) after the title. Unsafe / missing
  // URLs render no pill (silent degrade). Tests prove:
  //   - flag OFF removes every pill
  //   - flag ON + safe link → pill is rendered with `data-citation-domain`
  //   - flag ON + missing link → NO pill (silent)
  //   - flag ON + javascript: link → NO pill (silent)
  //   - flag ON + `www.` host → stripped
  //   - pill is orthogonal to the T-TR3-lite link path (works with OFF too)
  //   - aria-label exposes the domain while the visual glyph is hidden
  //   - no telemetry ever fires
  // -------------------------------------------------------------------

  it('T-TR3.4: kill-switch OFF removes every domain pill (even with safe links)', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isCitationLinksEnabled={() => true}
        isCitationDomainEnabled={() => false}
        citations={[citationWithLink(1, 'https://example.com/deck')]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    expect(screen.queryByTestId('trust-badge-citation-domain-0')).not.toBeInTheDocument();
  });

  it('T-TR3.4: kill-switch ON + safe link renders the domain pill with `data-citation-domain`', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isCitationLinksEnabled={() => true}
        isCitationDomainEnabled={() => true}
        citations={[citationWithLink(1, 'https://nytimes.com/article')]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    const pill = screen.getByTestId('trust-badge-citation-domain-0');
    expect(pill).toBeInTheDocument();
    expect(pill.getAttribute('data-citation-domain')).toBe('nytimes.com');
    expect(pill.textContent).toContain('nytimes.com');
  });

  it('T-TR3.4: strips the leading `www.` prefix', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isCitationDomainEnabled={() => true}
        citations={[citationWithLink(1, 'https://www.wikipedia.org/wiki/X')]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    const pill = screen.getByTestId('trust-badge-citation-domain-0');
    expect(pill.getAttribute('data-citation-domain')).toBe('wikipedia.org');
  });

  it('T-TR3.4: silently degrades when the citation has no link', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isCitationDomainEnabled={() => true}
        citations={[citationWithLink(1)]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    expect(screen.queryByTestId('trust-badge-citation-domain-0')).not.toBeInTheDocument();
  });

  it('T-TR3.4: silently degrades for dangerous protocols (javascript:, data:, file:)', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isCitationDomainEnabled={() => true}
        citations={[
          citationWithLink(1, 'javascript:alert(1)'),
          citationWithLink(2, 'data:text/html,<script>1</script>'),
          citationWithLink(3, 'file:///etc/passwd'),
        ]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    expect(screen.queryByTestId('trust-badge-citation-domain-0')).not.toBeInTheDocument();
    expect(screen.queryByTestId('trust-badge-citation-domain-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('trust-badge-citation-domain-2')).not.toBeInTheDocument();
  });

  it('T-TR3.4: pill is orthogonal to T-TR3-lite — it renders even when links are OFF', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isCitationLinksEnabled={() => false}
        isCitationDomainEnabled={() => true}
        citations={[citationWithLink(1, 'https://example.com/foo')]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    // Title renders as plain text (no <a>), but the domain pill is still
    // visible — provenance without interactivity.
    expect(screen.getByTestId('trust-badge-citation-plain-0')).toBeInTheDocument();
    expect(
      screen.getByTestId('trust-badge-citation-domain-0').getAttribute('data-citation-domain')
    ).toBe('example.com');
  });

  it('T-TR3.4: aria-label announces "Source domain: <domain>" for screen readers', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isCitationDomainEnabled={() => true}
        citations={[citationWithLink(1, 'https://nytimes.com/article')]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    const pill = screen.getByTestId('trust-badge-citation-domain-0');
    expect(pill.getAttribute('aria-label')).toMatch(/Source domain:\s*nytimes\.com/i);
  });

  it('T-TR3.4: mixes pills across rows — safe, unsafe, and missing all coexist without cross-talk', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isCitationLinksEnabled={() => true}
        isCitationDomainEnabled={() => true}
        citations={[
          citationWithLink(1, 'https://nytimes.com/article'),
          citationWithLink(2, 'javascript:alert(1)'),
          citationWithLink(3),
          citationWithLink(4, 'https://www.example.com/foo'),
        ]}
      />
    );
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    expect(
      screen.getByTestId('trust-badge-citation-domain-0').getAttribute('data-citation-domain')
    ).toBe('nytimes.com');
    expect(screen.queryByTestId('trust-badge-citation-domain-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('trust-badge-citation-domain-2')).not.toBeInTheDocument();
    expect(
      screen.getByTestId('trust-badge-citation-domain-3').getAttribute('data-citation-domain')
    ).toBe('example.com');
  });

  it('T-TR3.4: never fires telemetry from rendering the domain pill', () => {
    render(
      <TrustBadge
        isEnabled={() => true}
        isCitationDomainEnabled={() => true}
        citations={[citationWithLink(1, 'https://nytimes.com/article')]}
      />
    );
    trackFunnelEventMock.mockClear();
    fireEvent.click(screen.getByTestId('trust-badge-trigger'));
    // Opening the popover legitimately emits `trust_badge_opened`;
    // we only care that the domain pill itself doesn't add any
    // extra event. Filter to the pill-specific event name.
    const domainEvents = trackFunnelEventMock.mock.calls.filter(([name]) =>
      String(name).includes('domain')
    );
    expect(domainEvents).toHaveLength(0);
  });
});
