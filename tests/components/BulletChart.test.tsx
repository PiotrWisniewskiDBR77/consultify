/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BulletChart } from '../../src/components/Economics/charts/BulletChart';

describe('BulletChart', () => {
  it('renders the chart root with data-testid', () => {
    const { getByTestId } = render(
      <BulletChart baseline={0} target={100} actual={80} />,
    );
    expect(getByTestId('bullet-chart')).toBeInTheDocument();
  });

  it('renders actual, target and baseline elements', () => {
    const { getByTestId } = render(
      <BulletChart baseline={10} target={100} actual={80} />,
    );
    expect(getByTestId('bullet-actual')).toBeInTheDocument();
    expect(getByTestId('bullet-target')).toBeInTheDocument();
    expect(getByTestId('bullet-baseline')).toBeInTheDocument();
    expect(getByTestId('bullet-track')).toBeInTheDocument();
  });

  it('colors actual emerald when actual meets or exceeds target', () => {
    const { getByTestId } = render(
      <BulletChart baseline={0} target={100} actual={100} />,
    );
    expect(getByTestId('bullet-actual').getAttribute('fill')).toBe('#10b981');
  });

  it('colors actual amber when actual is near target', () => {
    const { getByTestId } = render(
      <BulletChart baseline={0} target={100} actual={90} />,
    );
    expect(getByTestId('bullet-actual').getAttribute('fill')).toBe('#f59e0b');
  });

  it('colors actual rose when actual is far below target', () => {
    const { getByTestId } = render(
      <BulletChart baseline={0} target={100} actual={50} />,
    );
    expect(getByTestId('bullet-actual').getAttribute('fill')).toBe('#f43f5e');
  });

  it('renders forecast shadow when forecast provided', () => {
    const { getByTestId } = render(
      <BulletChart baseline={0} target={100} actual={60} forecast={85} />,
    );
    expect(getByTestId('bullet-forecast')).toBeInTheDocument();
  });

  it('omits forecast shadow when forecast not provided', () => {
    const { queryByTestId } = render(
      <BulletChart baseline={0} target={100} actual={60} />,
    );
    expect(queryByTestId('bullet-forecast')).toBeNull();
  });

  it('positions actual bar width proportional to value within max', () => {
    const { getByTestId } = render(
      <BulletChart baseline={0} target={100} actual={50} max={100} />,
    );
    const w = Number(getByTestId('bullet-actual').getAttribute('width'));
    expect(w).toBeGreaterThan(0);
  });

  it('renders label and value when height allows', () => {
    const { container } = render(
      <BulletChart baseline={0} target={1000} actual={800} label="Oszczędności" height={48} />,
    );
    expect(container.textContent).toContain('Oszczędności');
  });

  it('honors custom formatValue in aria-label', () => {
    const { getByTestId } = render(
      <BulletChart
        baseline={0}
        target={100}
        actual={80}
        formatValue={(v) => `${v}zł`}
      />,
    );
    expect(getByTestId('bullet-chart').getAttribute('aria-label')).toContain('zł');
  });
});
