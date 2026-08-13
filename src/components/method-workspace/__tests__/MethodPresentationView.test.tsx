/**
 * @vitest-environment jsdom
 *
 * MethodPresentationView — renders a deck of PresentationSourceBlocks as
 * slides. MPQ criteria covered:
 *  1. slide headline = block.keyMessage (a conclusion), title is the eyebrow.
 *  6. evidence count / freshness / confidentiality are three separate footer elements.
 *  draft provenance gets the SAME indigo/violet accent as an unaccepted
 *  Teresa proposal (visual-language reuse, not a second convention).
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it } from 'vitest';

import type { PresentationSourceBlock } from '@/method-core/outputs';

import { MethodPresentationView } from '../MethodPresentationView';

function makeBlock(overrides: Partial<PresentationSourceBlock> = {}): PresentationSourceBlock {
  return {
    sourceOutputId: 'output-1',
    sourceVersion: 1,
    blockType: 'matrix',
    blockId: 'block-1',
    dataSnapshot: { 'axis-1': 2, 'axis-2': 4, 'axis-3': null },
    title: 'Governance danych',
    keyMessage: 'Procesy zatrzymują się na poziomie 2 przez brak właściciela danych.',
    evidenceRefs: ['ev-1', 'ev-2'],
    visualIntent: 'comparison',
    preferredLayouts: ['matrix'],
    density: 'standard',
    themeTokens: {},
    confidentiality: 'client_deliverable',
    freshness: '2026-08-13T10:00:00.000Z',
    provenance: { generatedBy: 'human', generatedAt: '2026-08-13T10:00:00.000Z', isDraft: false },
    ...overrides,
  };
}

describe('MethodPresentationView', () => {
  it('uses keyMessage as the large headline (a conclusion) and title as the small eyebrow (criterion 1)', () => {
    render(<MethodPresentationView blocks={[makeBlock()]} methodName="DRD" />);
    expect(screen.getByTestId('slide-key-message')).toHaveTextContent(
      'Procesy zatrzymują się na poziomie 2 przez brak właściciela danych.'
    );
    expect(screen.getByText('Governance danych')).toBeInTheDocument();
  });

  it('renders evidence count, confidentiality and freshness as three separate footer elements (criterion 6)', () => {
    render(<MethodPresentationView blocks={[makeBlock()]} methodName="DRD" />);
    expect(screen.getByTestId('slide-evidence-count')).toHaveTextContent('2 dowodów');
    expect(screen.getByTestId('slide-confidentiality')).toHaveTextContent('Materiał dla klienta');
    expect(screen.getByTestId('slide-freshness')).toBeInTheDocument();
  });

  it('tags a draft block with the violet ribbon — same accent as an unaccepted Teresa proposal, not a new color', () => {
    render(<MethodPresentationView blocks={[makeBlock({ provenance: { generatedBy: 'teresa', generatedAt: '2026-08-13T10:00:00.000Z', isDraft: true } })]} methodName="DRD" />);
    const ribbon = screen.getByTestId('slide-draft-ribbon');
    expect(ribbon).toHaveTextContent('Wersja robocza');
    const slide = screen.getByTestId('presentation-slide');
    expect(slide.className).toMatch(/violet/);
  });

  it('an approved block never shows the draft ribbon', () => {
    render(<MethodPresentationView blocks={[makeBlock()]} methodName="DRD" />);
    expect(screen.queryByTestId('slide-draft-ribbon')).not.toBeInTheDocument();
  });

  it('navigates between slides with next/prev, updating position', async () => {
    const user = userEvent.setup();
    render(
      <MethodPresentationView
        blocks={[makeBlock({ blockId: 'a', keyMessage: 'Pierwszy wniosek.' }), makeBlock({ blockId: 'b', keyMessage: 'Drugi wniosek.' })]}
        methodName="DRD"
      />
    );
    expect(screen.getByTestId('slide-position')).toHaveTextContent('1 / 2');
    expect(screen.getByTestId('slide-key-message')).toHaveTextContent('Pierwszy wniosek.');
    await user.click(screen.getByTestId('slide-next'));
    expect(screen.getByTestId('slide-position')).toHaveTextContent('2 / 2');
    expect(screen.getByTestId('slide-key-message')).toHaveTextContent('Drugi wniosek.');
  });

  it('unscored values on the slide bar chart render as "Nieocenione", never a numeric zero (criterion 4)', () => {
    render(<MethodPresentationView blocks={[makeBlock()]} methodName="DRD" />);
    expect(screen.getByTestId('slide-bars')).toHaveTextContent('Nieocenione');
  });
});
