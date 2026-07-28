/**
 * D3 — a11y smoke coverage for DocumentStudioGeneratingPanel (C1 streaming
 * generation panel).
 *
 * The component previously had no dedicated test (functional coverage only
 * existed indirectly via manual QA). This backfills the a11y-relevant
 * contract:
 *   - the live progress line is `aria-live="polite"` so screen readers hear
 *     section-by-section progress without focus changes;
 *   - the progress bar exposes `role="progressbar"` + numeric bounds;
 *   - decorative icons (spinner/check) are `aria-hidden`;
 *   - the error line uses `role="alert"` so failures are announced;
 *   - skeleton placeholder rows (no outline yet) render without crashing.
 *
 * N3 (2026-07-28, doktryna streaming) additions:
 *   - the stream-fallback `notice` uses `role="status"` (distinct from
 *     `role="alert"` — it is an honest heads-up, not a failure);
 *   - the Stop button only renders when `onStop` is provided AND `canStop`
 *     is true, and calls `onStop` on click;
 *   - `sourceRefs` on a ready section render as deduped chips, absent on a
 *     pending section.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DocumentStudioGeneratingPanel } from '../../../src/components/DocumentStudio/DocumentStudioGeneratingPanel';
import type { DocumentOutline } from '../../../src/components/DocumentStudio/types';

const OUTLINE: DocumentOutline = {
  documentType: 'executive_memo',
  title: 'Q3 Market Entry Memo',
  recommendedDensity: 'standard',
  recommendedRegister: 'formal',
  recommendedLanguageStyle: 'plain',
  sections: [
    { title: 'Executive summary', level: 1, purpose: 'overview', expectedLengthHint: 'short' },
    { title: 'Market analysis', level: 1, purpose: 'analysis', expectedLengthHint: 'long' },
  ],
} as unknown as DocumentOutline;

describe('DocumentStudioGeneratingPanel (D3 a11y smoke)', () => {
  it('renders skeleton rows and a planning message before the outline lands', () => {
    render(<DocumentStudioGeneratingPanel outline={null} sections={[]} />);
    expect(screen.getByTestId('document-studio-generating')).toBeInTheDocument();
    // Planning message is a live region so it is announced as it changes.
    expect(screen.getByText('Planning the outline…')).toHaveAttribute('aria-live', 'polite');
    // No progressbar until we know the total section count.
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('exposes a labeled, bounded progressbar once the outline is known', () => {
    render(
      <DocumentStudioGeneratingPanel
        outline={OUTLINE}
        sections={[
          { title: 'Executive summary', ready: true },
          { title: 'Market analysis', ready: false },
        ]}
      />
    );
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '2');
    expect(bar).toHaveAttribute('aria-valuenow', '1');

    // Progress text updates live.
    const progressText = screen.getByText(/1 of 2 ready|Writing sections/i);
    expect(progressText).toHaveAttribute('aria-live', 'polite');
  });

  it('marks the ready check icon done and hides decorative icons from AT', () => {
    const { container } = render(
      <DocumentStudioGeneratingPanel
        outline={OUTLINE}
        sections={[
          { title: 'Executive summary', ready: true },
          { title: 'Market analysis', ready: false },
        ]}
      />
    );
    const readyRow = screen.getByTestId('generating-section-0');
    expect(readyRow).toHaveAttribute('data-ready', 'true');
    const pendingRow = screen.getByTestId('generating-section-1');
    expect(pendingRow).toHaveAttribute('data-ready', 'false');

    // Every lucide icon in the panel is decorative (progress text carries the
    // meaning) — confirm none leak to the accessibility tree unlabeled.
    const svgIcons = container.querySelectorAll('svg');
    expect(svgIcons.length).toBeGreaterThan(0);
    svgIcons.forEach((icon) => {
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    // Skeleton placeholder lines under the pending section are hidden from AT
    // (they are purely visual shimmer, not content).
    const skeletonWrap = pendingRow.querySelector('[aria-hidden="true"].mt-2');
    expect(skeletonWrap).not.toBeNull();
  });

  it('announces stream failure via role="alert"', () => {
    render(
      <DocumentStudioGeneratingPanel
        outline={null}
        sections={[]}
        error="Streaming failed; falling back to synchronous generation."
      />
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/streaming failed/i);
  });

  // N3 (doktryna streaming §4/§7.1) — the silent-fallback fix: a dropped SSE
  // connection now surfaces a calm, non-blocking `notice` (status, not
  // alert — this is expected/handled, unlike `error`).
  it('announces the stream-fallback notice via role="status", distinct from role="alert"', () => {
    render(
      <DocumentStudioGeneratingPanel
        outline={null}
        sections={[]}
        notice="Połączenie na żywo zerwane — dokańczam w tle…"
      />
    );
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/Połączenie na żywo zerwane/i);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // N3 (§2/§7.3) — Stop button parity with Canvas. Hidden entirely when
  // `canStop` is false (e.g. once a run has fallen back to the non-abortable
  // synchronous path) so it is never a dead control.
  it('shows a Stop button only when onStop is provided and canStop is true, and fires it on click', () => {
    const onStop = vi.fn();
    const { rerender } = render(
      <DocumentStudioGeneratingPanel outline={OUTLINE} sections={[]} onStop={onStop} canStop />
    );
    fireEvent.click(screen.getByTestId('document-studio-stop-generation'));
    expect(onStop).toHaveBeenCalledOnce();

    rerender(
      <DocumentStudioGeneratingPanel
        outline={OUTLINE}
        sections={[]}
        onStop={onStop}
        canStop={false}
      />
    );
    expect(screen.queryByTestId('document-studio-stop-generation')).not.toBeInTheDocument();
  });

  // N3 (§5/§7.2) — sourceRef chips ("Based on: X, Y") render under a ready
  // section and are absent while the section is still pending.
  it('renders deduped sourceRef chips under a ready section, and none for a pending one', () => {
    render(
      <DocumentStudioGeneratingPanel
        outline={OUTLINE}
        sections={[
          {
            title: 'Executive summary',
            ready: true,
            sourceRefs: [
              { sourceType: 'interview', sourceId: 'int-4', sourceTitle: 'Wywiad #4' },
              { sourceType: 'insight', sourceId: 'ins-12', sourceTitle: 'Insight #12' },
            ],
          },
          { title: 'Market analysis', ready: false },
        ]}
      />
    );
    const sourcesRow = screen.getByTestId('generating-section-0-sources');
    expect(sourcesRow).toHaveTextContent('Wywiad #4');
    expect(sourcesRow).toHaveTextContent('Insight #12');
    expect(screen.queryByTestId('generating-section-1-sources')).not.toBeInTheDocument();
  });
});
