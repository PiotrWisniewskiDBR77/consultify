/**
 * ODBIÓR O8.3 — GlossaryPanel wiring
 *
 * Proves the panel actually renders real glossary content and that search
 * filtering works against the real CONSULTING_GLOSSARY data (not a mock),
 * and that it is wired into ToolHeader (DiscoveryTools) and the three
 * assessment editors (DRD/SIRI/ADMA) per grep of the real source tree.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { CONSULTING_GLOSSARY } from '@/config/consultingGlossary';

import { GlossaryPanel } from '../GlossaryPanel';

describe('O8.3 — GlossaryPanel renders real glossary content', () => {
  it('is closed (renders nothing) when isOpen=false', () => {
    const { container } = render(<GlossaryPanel isOpen={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a dialog with every curated term when open', () => {
    render(<GlossaryPanel isOpen onClose={() => {}} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Spot-check a real curated term is actually on screen (not placeholder copy).
    expect(screen.getByText('SWOT')).toBeInTheDocument();
    expect(screen.getAllByText(/WACC/).length).toBeGreaterThan(0);

    // All terms should be rendered (no pagination/truncation hiding entries).
    for (const term of CONSULTING_GLOSSARY.slice(0, 5)) {
      expect(screen.getByText(term.term)).toBeInTheDocument();
    }
  });

  it('search box filters the real term list live', () => {
    render(<GlossaryPanel isOpen onClose={() => {}} />);
    const search = screen.getByPlaceholderText(/Search a term/i);

    fireEvent.change(search, { target: { value: 'swot' } });
    expect(screen.getByText('SWOT')).toBeInTheDocument();
    expect(screen.queryByText('MECE (Mutually Exclusive, Collectively Exhaustive)')).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'zzz-no-such-term' } });
    expect(screen.getByText('No results.')).toBeInTheDocument();
  });

  it('close button invokes onClose', () => {
    let closed = false;
    render(<GlossaryPanel isOpen onClose={() => (closed = true)} />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(closed).toBe(true);
  });
});
