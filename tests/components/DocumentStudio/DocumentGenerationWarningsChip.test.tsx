/**
 * A4 — component test for the "generated with limitations" chip.
 *
 * Verifies:
 *   - the chip renders the count summary and stays collapsed by default;
 *   - clicking it expands to reveal the per-warning messages;
 *   - it renders nothing when there are no warnings.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock i18n: return an interpolated string for the summary key, and the key
// itself for the per-code labels (so the fallback-to-raw-code path is
// exercised without shipping every code into the mock).
vi.mock('react-i18next', () => ({
  // `initReactI18next` is consumed by the transitively-imported src/i18n.ts
  // bootstrap; a truthy stub keeps that import happy.
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({
    t: (key: string, opts?: { count?: number }) => {
      if (key === 'documentStudio.generationWarnings.summary') {
        return `Generated with limitations (${opts?.count ?? 0})`;
      }
      // Per-code labels: return the key unchanged so the component falls
      // back to the raw code.
      return key;
    },
  }),
}));

import type { DocumentGenerationWarning } from '../../../src/components/DocumentStudio/types';

// Imported after the mocks above are registered.
// eslint-disable-next-line import/first
import { DocumentGenerationWarningsChip } from '../../../src/components/DocumentStudio/DocumentStudioDocumentPanel';

const WARNINGS: DocumentGenerationWarning[] = [
  {
    code: 'llm_prose_fallback',
    scope: 'document',
    message: 'LLM prose generation failed; deterministic placeholders retained.',
    occurredAt: '2026-01-01T00:00:00.000Z',
  },
  {
    code: 'chart_raster_failed',
    scope: 'block',
    blockId: 'blk-9',
    message: 'Chart "Revenue" could not be rasterized; a text placeholder was inserted.',
    occurredAt: '2026-01-01T00:00:01.000Z',
  },
];

describe('DocumentGenerationWarningsChip', () => {
  it('renders the count summary and is collapsed by default', () => {
    render(<DocumentGenerationWarningsChip warnings={WARNINGS} />);
    expect(screen.getByText('Generated with limitations (2)')).toBeInTheDocument();
    // Collapsed: individual messages are not shown.
    expect(
      screen.queryByText(/deterministic placeholders retained/i)
    ).not.toBeInTheDocument();
    const toggle = screen.getByRole('button');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('expands to reveal the per-warning messages on click', () => {
    render(<DocumentGenerationWarningsChip warnings={WARNINGS} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/deterministic placeholders retained/i)).toBeInTheDocument();
    expect(screen.getByText(/could not be rasterized/i)).toBeInTheDocument();
    // Falls back to the raw code label when the code has no translation.
    expect(screen.getByText('llm_prose_fallback')).toBeInTheDocument();
    expect(screen.getByText('chart_raster_failed')).toBeInTheDocument();
  });

  it('renders nothing when there are no warnings', () => {
    const { container } = render(<DocumentGenerationWarningsChip warnings={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
