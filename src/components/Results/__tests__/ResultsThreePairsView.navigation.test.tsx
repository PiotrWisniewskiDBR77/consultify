/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { ResultsThreePairsView } from '../ResultsThreePairsView';

describe('ResultsThreePairsView table navigation', () => {
  it('exposes KPI, ROI and OKR as three separate table surfaces', () => {
    render(<ResultsThreePairsView kpis={[]} roi={[]} objectives={[]} isPolish={false} />);

    const kpiTab = screen.getByTestId('results-pair-tab-kpi');
    const roiTab = screen.getByTestId('results-pair-tab-roi');
    const okrTab = screen.getByTestId('results-pair-tab-okr');

    expect(kpiTab).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('KPI — target ↔ actual')).toBeInTheDocument();
    expect(screen.queryByText('ROI — expected ↔ realized')).not.toBeInTheDocument();

    fireEvent.click(roiTab);
    expect(roiTab).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('ROI — expected ↔ realized')).toBeInTheDocument();
    expect(screen.queryByText('KPI — target ↔ actual')).not.toBeInTheDocument();

    fireEvent.click(okrTab);
    expect(okrTab).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('OKR — objective ↔ key results')).toBeInTheDocument();
    expect(screen.queryByText('ROI — expected ↔ realized')).not.toBeInTheDocument();
  });
});
