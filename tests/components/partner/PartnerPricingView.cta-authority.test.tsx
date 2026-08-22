/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { ROUTES } from '../../../src/routes/routeConfig';
import { PartnerPricingView } from '../../../src/views/partner/PartnerPricingView';

describe('PartnerPricingView CTA authority', () => {
  it('retires the draft pricing surface into the canonical program overview', async () => {
    render(
      <MemoryRouter initialEntries={[ROUTES.PARTNER.PRICING]}>
        <Routes>
          <Route path={ROUTES.PARTNER.PRICING} element={<PartnerPricingView />} />
          <Route path={ROUTES.BECOME_PARTNER} element={<div>Canonical Partner Program</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('Canonical Partner Program')).toBeInTheDocument();
    expect(screen.queryByText(/commission/i)).toBeNull();
  });
});
