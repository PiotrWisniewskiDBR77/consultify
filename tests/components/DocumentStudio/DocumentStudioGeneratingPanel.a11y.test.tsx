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
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

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
});
