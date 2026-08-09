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

  it('recalculates formula-backed KPI cards and scenario bars from raw sheets', () => {
    const rawSheets = [
      { name: 'Assumptions', columns: [{ key: 'label', header: 'Label' }, { key: 'value', header: 'Value' }], rows: [
        { cells: { label: { value: 'Investment' }, value: { value: 2_400_000 } } },
        { cells: { label: { value: 'Implementation' }, value: { value: 300_000 } } },
        { cells: { label: { value: 'Total' }, value: { formula: 'SUM(B2:B3)' } } },
      ] },
      { name: 'Executive Summary', columns: [{ key: 'metric', header: 'KPI / decyzja' }, { key: 'value', header: 'Wartość' }], rows: [
        { cells: { metric: { value: 'Łączny nakład' }, value: { formula: "'Assumptions'!B4" } } },
      ] },
      { name: 'Scenario Model', columns: [{ key: 'metric', header: 'Metryka' }, { key: 'down', header: 'Downside' }, { key: 'base', header: 'Base' }], rows: [
        { cells: { metric: { value: 'Korzyści risk-adjusted' }, down: { value: 550_000 }, base: { value: 780_000 } } },
      ] },
    ];
    render(<WorkbookBoardSummary sheets={sheets} rawSheets={rawSheets} activeSheetName="Executive Summary" />);
    expect(screen.getByText('2 700 000')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Risk-adjusted benefits by scenario' })).toBeInTheDocument();
  });
});
