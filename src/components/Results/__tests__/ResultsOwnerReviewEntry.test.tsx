// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { ResultsOwnerReviewEntry } from '../ResultsOwnerReviewEntry';

describe('ResultsOwnerReviewEntry', () => {
  beforeEach(() => window.localStorage.clear());

  it('always redirects the bare Results route to the canonical KPI registry', async () => {
    render(
      <MemoryRouter initialEntries={['/results']}>
        <Routes>
          <Route path="/results" element={<ResultsOwnerReviewEntry />} />
          <Route path="/results/kpi" element={<div>canonical KPI registry</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('canonical KPI registry')).toBeInTheDocument();
  });

  it('ignores a stale disabled owner-review profile and still forbids the legacy hub', async () => {
    window.localStorage.setItem('ff.wave3_results_owner_review', '0');
    render(
      <MemoryRouter initialEntries={['/results']}>
        <Routes>
          <Route path="/results" element={<ResultsOwnerReviewEntry />} />
          <Route path="/results/kpi" element={<div>canonical KPI registry</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText('canonical KPI registry')).toBeInTheDocument();
  });
});
