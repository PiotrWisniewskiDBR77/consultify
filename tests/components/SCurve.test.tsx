/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SCurve } from '../../src/components/Economics/charts/SCurve';

const plan = [
  { t: 'M1', cum: 100 },
  { t: 'M2', cum: 250 },
  { t: 'M3', cum: 450 },
  { t: 'M4', cum: 700 },
];

describe('SCurve', () => {
  it('renders the chart root with data-testid', () => {
    const { getByTestId } = render(<SCurve plan={plan} />);
    expect(getByTestId('s-curve')).toBeInTheDocument();
  });

  it('renders the plan path (dashed slate baseline)', () => {
    const { getByTestId } = render(<SCurve plan={plan} />);
    const planPath = getByTestId('sc-plan');
    expect(planPath).toBeInTheDocument();
    expect(planPath.getAttribute('d')).toMatch(/^M/);
    // plan jest przerywany
    expect(planPath.getAttribute('stroke-dasharray')).toBeTruthy();
  });

  it('renders the actual path when actual data is supplied', () => {
    const actual = [
      { t: 'M1', cum: 110 },
      { t: 'M2', cum: 260 },
      { t: 'M3', cum: 470 },
      { t: 'M4', cum: 720 },
    ];
    const { getByTestId } = render(<SCurve plan={plan} actual={actual} />);
    const actualPath = getByTestId('sc-actual');
    expect(actualPath).toBeInTheDocument();
    expect(actualPath.getAttribute('d')).toMatch(/^M/);
  });

  it('renders the gap shading between plan and actual', () => {
    const actual = [
      { t: 'M1', cum: 90 },
      { t: 'M2', cum: 200 },
      { t: 'M3', cum: 380 },
    ];
    const { getByTestId } = render(<SCurve plan={plan} actual={actual} />);
    expect(getByTestId('sc-gap')).toBeInTheDocument();
  });

  it('does not render actual path when no actual provided', () => {
    const { queryByTestId } = render(<SCurve plan={plan} />);
    expect(queryByTestId('sc-actual')).toBeNull();
  });

  it('colors actual emerald when at/above plan (on-track)', () => {
    const actual = [
      { t: 'M1', cum: 120 },
      { t: 'M2', cum: 300 },
      { t: 'M3', cum: 500 },
      { t: 'M4', cum: 800 },
    ];
    const { getByTestId } = render(<SCurve plan={plan} actual={actual} />);
    expect(getByTestId('sc-actual').getAttribute('stroke')).toBe('#10b981');
  });

  it('colors actual rose when far below plan (missed)', () => {
    const actual = [
      { t: 'M1', cum: 40 },
      { t: 'M2', cum: 80 },
      { t: 'M3', cum: 120 },
      { t: 'M4', cum: 200 },
    ];
    const { getByTestId } = render(<SCurve plan={plan} actual={actual} />);
    expect(getByTestId('sc-actual').getAttribute('stroke')).toBe('#f43f5e');
  });

  it('renders the "today" marker with actual data', () => {
    const actual = [{ t: 'M1', cum: 110 }];
    const { getByTestId } = render(<SCurve plan={plan} actual={actual} />);
    expect(getByTestId('sc-today')).toBeInTheDocument();
  });

  it('renders an empty-state when plan is empty', () => {
    const { getByTestId } = render(<SCurve plan={[]} />);
    const root = getByTestId('s-curve');
    expect(root.textContent).toMatch(/Brak danych/i);
  });

  it('honors custom formatValue', () => {
    const { container } = render(
      <SCurve plan={plan} formatValue={(v) => `€${v}`} />,
    );
    expect(container.textContent).toContain('€');
  });
});
