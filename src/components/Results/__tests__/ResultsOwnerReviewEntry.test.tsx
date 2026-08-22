// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { ResultsOwnerReviewEntry } from '../ResultsOwnerReviewEntry';

describe('ResultsOwnerReviewEntry', () => {
  beforeEach(() => window.localStorage.clear());

  it('redirects explicit owner review away from the split legacy hub', async () => {
    window.localStorage.setItem('ff.wave3_results_owner_review', '1');
    render(
      <MemoryRouter initialEntries={['/results']}>
        <Routes>
          <Route
            path="/results"
            element={<ResultsOwnerReviewEntry fallback={<div>legacy hub</div>} />}
          />
          <Route path="/results/kpi" element={<div>canonical KPI registry</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('canonical KPI registry')).toBeInTheDocument();
    expect(screen.queryByText('legacy hub')).not.toBeInTheDocument();
  });

  it('preserves the normal hub when the profile is not explicitly enabled', () => {
    render(
      <MemoryRouter initialEntries={['/results']}>
        <Routes>
          <Route
            path="/results"
            element={<ResultsOwnerReviewEntry fallback={<div>normal hub</div>} />}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('normal hub')).toBeInTheDocument();
  });
});
