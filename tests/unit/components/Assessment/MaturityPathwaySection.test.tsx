/**
 * MaturityPathwaySection Component Tests
 *
 * Verifies the N→N+1 pathway section:
 *  - renders a card only for dimensions BELOW target
 *  - shows the deterministic recipe (actions + level transition) from
 *    getMaturityPathway()
 *  - hides itself entirely when no dimension is below target
 *  - honours the maxCards cap and biggest-gap-first ordering
 *
 * @module tests/unit/components/assessment/MaturityPathwaySection.test.tsx
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { MaturityPathwaySection } from '@/components/assessment/reports/MaturityPathwaySection';

describe('MaturityPathwaySection', () => {
  it('renders a pathway card for a below-target DRD dimension (canon id D1)', () => {
    render(
      <MaturityPathwaySection
        framework="drd"
        language="pl"
        dimensions={[{ dimensionId: 'D1', currentLevel: 2, targetLevel: 4 }]}
      />
    );
    // Section heading present
    expect(screen.getByText(/Ścieżka dojrzałości/i)).toBeInTheDocument();
    // Dimension name resolved from canon labels (D1 = Procesy cyfrowe).
    // Appears in both the card header and the "current state" line.
    expect(screen.getAllByText(/Procesy cyfrowe/i).length).toBeGreaterThan(0);
    // K3 actions block present
    expect(screen.getByText(/Co zrobić, by przejść wyżej/i)).toBeInTheDocument();
    // Level transition labels (Roman for DRD): from II shown
    expect(screen.getAllByText('II').length).toBeGreaterThan(0);
  });

  it('renders nothing when every dimension already meets or exceeds target', () => {
    const { container } = render(
      <MaturityPathwaySection
        framework="drd"
        language="pl"
        dimensions={[
          { dimensionId: 'D1', currentLevel: 4, targetLevel: 4 },
          { dimensionId: 'D2', currentLevel: 5, targetLevel: 3 },
        ]}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('caps the number of cards to maxCards, largest gap first', () => {
    render(
      <MaturityPathwaySection
        framework="drd"
        language="pl"
        maxCards={1}
        dimensions={[
          { dimensionId: 'D1', currentLevel: 3, targetLevel: 4 }, // gap 1
          { dimensionId: 'D2', currentLevel: 1, targetLevel: 5 }, // gap 4 (biggest)
        ]}
      />
    );
    // Only one card: the biggest-gap dimension (D2 = Produkty cyfrowe)
    expect(screen.getAllByText(/Produkty cyfrowe/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Procesy cyfrowe/i)).not.toBeInTheDocument();
  });

  it('works for SIRI dimensions using structure-native ids', () => {
    render(
      <MaturityPathwaySection
        framework="siri"
        language="pl"
        dimensions={[{ dimensionId: 'operations', currentLevel: 1, targetLevel: 3 }]}
      />
    );
    expect(screen.getByText(/Ścieżka dojrzałości/i)).toBeInTheDocument();
    expect(screen.getByText(/Co zrobić, by przejść wyżej/i)).toBeInTheDocument();
  });
});
