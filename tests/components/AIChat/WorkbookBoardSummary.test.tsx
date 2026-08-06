import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WorkbookBoardSummary } from '../../../src/components/AIChat/KimiWorkspace/WorkbookBoardSummary';

describe('WorkbookBoardSummary', () => {
  const sheets = [
    { name: 'Executive Summary', columns: ['KPI / decyzja', 'Wartość'], rows: [
      { 'KPI / decyzja': 'Łączny nakład', Wartość: 2_700_000 },
      { 'KPI / decyzja': 'Korzyści risk-adjusted', Wartość: 787_500 },
    ] },
    { name: 'Scenario Model', columns: ['Metryka', 'Downside', 'Base', 'Upside'], rows: [
      { Metryka: 'Korzyści risk-adjusted', Downside: 551_250, Base: 787_500, Upside: 984_375 },
    ] },
  ];

  it('renders board KPI cards and a scenario chart on Executive Summary', () => {
    render(<WorkbookBoardSummary sheets={sheets} activeSheetName="Executive Summary" />);
    expect(screen.getByTestId('workbook-board-summary')).toBeInTheDocument();
    expect(screen.getByText('Łączny nakład')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Risk-adjusted benefits by scenario' })).toBeInTheDocument();
    expect(screen.getByText('Downside')).toBeInTheDocument();
    expect(screen.getByText('Upside')).toBeInTheDocument();
  });

  it('does not crowd non-summary sheets', () => {
    const { container } = render(<WorkbookBoardSummary sheets={sheets} activeSheetName="Monthly Tracking" />);
    expect(container).toBeEmptyDOMElement();
  });
});
