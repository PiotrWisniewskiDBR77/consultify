/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { DRD_METHOD_PACK_VERSION } from '@/method-core/methods/drd/compileDrdPack';
import { makeOutput } from '@/method-core/outputs/__tests__/testFixtures';

import { buildPresentationDeck } from '../buildPresentationDeck';
import { PresentationDeck } from '../PresentationDeck';

describe('Day 275 — slajdy kanonicznej macierzy DRD', () => {
  it('umieszcza w decku grid dla każdej osi mającej realny pomiar', () => {
    const output = makeOutput({
      methodology: { methodPackId: 'drd', version: DRD_METHOD_PACK_VERSION },
      current: { '1A': 3, '2A': 2 },
      target: { '1A': 5, '2A': 4 },
      gap: { '1A': 2, '2A': 2 },
      aggregation: {
        byGroup: { 'axis-1': 3, 'axis-2': 2 },
        mappingVersion: 'drd-axis-mean-v1',
        rule: 'mean',
        excluded: {},
      },
    });
    const model = buildPresentationDeck(output);
    expect(model.axisMatrices.map((matrix) => matrix.axisId)).toEqual(['axis-1', 'axis-2']);

    const { container } = render(<PresentationDeck model={model} initialSlide={5} />);
    expect(screen.getByText('Macierz · oś 1')).toBeInTheDocument();
    expect(container.querySelector('div[style*="grid-template-columns"]')).not.toBeNull();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByText('Macierz · oś 2')).toBeInTheDocument();
    expect(container.querySelector('div[style*="grid-template-columns"]')).not.toBeNull();
  });
});
