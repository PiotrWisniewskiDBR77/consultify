/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PartnerLifecycleCanonPanel } from '../../../src/components/Partner/PartnerLifecycleCanonPanel';

describe('PartnerLifecycleCanonPanel', () => {
  it('renders the canonical lifecycle narrative for public partner entry', () => {
    render(<PartnerLifecycleCanonPanel />);

    expect(screen.getByText('One path from application to active partner')).toBeInTheDocument();
    expect(screen.getByText('Apply and qualify')).toBeInTheDocument();
    expect(screen.getByText('What closure must include')).toBeInTheDocument();
  });

  it('reflects onboarding progress for partner workspace states', () => {
    render(
      <PartnerLifecycleCanonPanel
        status={{
          termsAccepted: true,
          privacyAccepted: true,
          pricingTier: 'professional',
          paymentSetup: true,
          completed: false,
        }}
        compact
      />
    );

    expect(screen.getByText('Lifecycle progress')).toBeInTheDocument();
    expect(screen.getAllByText('Done').length).toBeGreaterThan(0);
    expect(screen.getByText('Grow through academy and progression')).toBeInTheDocument();
  });
});
