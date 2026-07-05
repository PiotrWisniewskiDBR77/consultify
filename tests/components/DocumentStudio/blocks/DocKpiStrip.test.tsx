/**
 * R3 — DocKpiStrip render tests (both shapes + raw-content narrowing).
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DocKpiStrip } from '../../../../src/components/DocumentStudio/blocks/DocKpiStrip';
import { narrowKpiContent } from '../../../../src/components/DocumentStudio/blocks/docBlockContent';

describe('DocKpiStrip', () => {
  it('renders cards from a pre-narrowed items[] object', () => {
    const content = narrowKpiContent({
      items: [
        { label: 'Revenue', value: '1.2M', delta: '+8%', trend: 'up' },
        { label: 'Churn', value: '3%', delta: '-1%', trend: 'down' },
      ],
    })!;
    render(<DocKpiStrip content={content} />);
    expect(screen.getByText('Revenue')).toBeTruthy();
    expect(screen.getByText('1.2M')).toBeTruthy();
    expect(screen.getByText('+8%')).toBeTruthy();
    expect(screen.getByText('Churn')).toBeTruthy();
  });

  it('accepts RAW columns+rows content and narrows internally', () => {
    render(
      <DocKpiStrip
        content={{
          columns: ['Metric', 'Value', 'Δ'],
          rows: [['NPS', '52', '+3']],
        }}
      />
    );
    expect(screen.getByText('NPS')).toBeTruthy();
    expect(screen.getByText('52')).toBeTruthy();
    expect(screen.getByText('+3')).toBeTruthy();
  });

  it('renders an empty state for garbage content (never throws)', () => {
    render(<DocKpiStrip content={'nonsense'} />);
    expect(screen.getByText(/No KPIs available/i)).toBeTruthy();
  });
});
