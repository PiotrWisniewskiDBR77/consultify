import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ResultsVNextRegistryShell } from '../../../src/components/ResultsVNext/ResultsVNextRegistryShell';

const baseProps = {
  domain: 'kpi' as const,
  moduleBar: { tabs: [], viewModes: ['table' as const], viewMode: 'table' as const },
  table: { columns: [], data: [], persistKey: 'test.sample-banner' },
};

describe('ResultsVNextRegistryShell sample-data banner', () => {
  it('is absent by default', () => {
    render(<ResultsVNextRegistryShell {...baseProps} />);
    expect(screen.queryByTestId('results-vnext-sample-data-banner')).not.toBeInTheDocument();
  });

  it('renders only when the registry passes the explicit sample-data prop', () => {
    render(<ResultsVNextRegistryShell {...baseProps} sampleData />);
    expect(screen.getByTestId('results-vnext-sample-data-banner')).toHaveTextContent(
      'Sample data — not from the database'
    );
  });
});
