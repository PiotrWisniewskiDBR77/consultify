import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ResultsVNextRegistryShell } from '../../../src/components/ResultsVNext/ResultsVNextRegistryShell';
import { ROUTES } from '../../../src/routes/routeConfig';

const baseProps = {
  domain: 'kpi' as const,
  moduleBar: { tabs: [], viewModes: ['table' as const], viewMode: 'table' as const },
  table: { columns: [], data: [], persistKey: 'test.management-report-entry' },
};

const ORIGINAL_LOCATION = window.location;

function setQuery(search: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...ORIGINAL_LOCATION, search },
  });
}

describe('ResultsVNextRegistryShell — E.1 management-report entry point', () => {
  afterEach(() => {
    window.localStorage.clear();
    setQuery('');
    Object.defineProperty(window, 'location', { configurable: true, value: ORIGINAL_LOCATION });
  });

  it('is absent by default (flag OFF)', () => {
    render(<ResultsVNextRegistryShell {...baseProps} />);
    expect(screen.queryByTestId('results-vnext-management-report-entry')).not.toBeInTheDocument();
  });

  it('renders a real anchor to ROUTES.REPORTS.MANAGEMENT when the flag is explicitly ON', () => {
    setQuery('?ff_resultsVNextManagementReportEntry=1');
    render(<ResultsVNextRegistryShell {...baseProps} />);
    const link = screen.getByTestId('results-vnext-management-report-entry');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', ROUTES.REPORTS.MANAGEMENT);
  });

  it('renders identically across domains (ROI/OKR pass the same shell, no per-domain wiring needed)', () => {
    setQuery('?ff_resultsVNextManagementReportEntry=1');
    render(<ResultsVNextRegistryShell {...baseProps} domain="roi" />);
    expect(screen.getByTestId('results-vnext-management-report-entry')).toBeInTheDocument();
  });
});
