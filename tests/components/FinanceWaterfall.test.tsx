/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  FinanceWaterfall,
  type WaterfallStep,
} from '../../src/components/Economics/charts/FinanceWaterfall';

const BRIDGE: WaterfallStep[] = [
  { label: 'Start', value: 100, kind: 'start' },
  { label: 'Upsell', value: 40, kind: 'increase' },
  { label: 'Churn', value: 25, kind: 'decrease' },
  { label: 'Razem', value: 115, kind: 'total' },
];

describe('FinanceWaterfall', () => {
  it('renderuje root z data-testid', () => {
    render(<FinanceWaterfall steps={BRIDGE} />);
    expect(screen.getByTestId('finance-waterfall')).toBeInTheDocument();
  });

  it('renderuje N słupków dla N kroków', () => {
    render(<FinanceWaterfall steps={BRIDGE} />);
    expect(screen.getAllByTestId('wf-bar')).toHaveLength(BRIDGE.length);
  });

  it('increase i decrease mają różne kolory (emerald vs rose, §1)', () => {
    render(<FinanceWaterfall steps={BRIDGE} />);
    const bars = screen.getAllByTestId('wf-bar');
    const increaseRect = bars
      .find((b) => b.getAttribute('data-kind') === 'increase')!
      .querySelector('rect')!;
    const decreaseRect = bars
      .find((b) => b.getAttribute('data-kind') === 'decrease')!
      .querySelector('rect')!;

    expect(increaseRect.getAttribute('class')).toContain('fill-emerald-500');
    expect(decreaseRect.getAttribute('class')).toContain('fill-rose-500');
    expect(increaseRect.getAttribute('class')).not.toBe(decreaseRect.getAttribute('class'));
  });

  it('start/total używają slate/violet (§1)', () => {
    render(<FinanceWaterfall steps={BRIDGE} />);
    const bars = screen.getAllByTestId('wf-bar');
    const startRect = bars
      .find((b) => b.getAttribute('data-kind') === 'start')!
      .querySelector('rect')!;
    const totalRect = bars
      .find((b) => b.getAttribute('data-kind') === 'total')!
      .querySelector('rect')!;
    expect(startRect.getAttribute('class')).toContain('fill-slate-400');
    expect(totalRect.getAttribute('class')).toContain('fill-violet-500');
  });

  it('skumulowana suma liczy się poprawnie wzdłuż mostka', () => {
    render(<FinanceWaterfall steps={BRIDGE} />);
    const bars = screen.getAllByTestId('wf-bar');
    const cumulativeByLabel = (label: string) =>
      Number(
        bars.find((b) => b.getAttribute('data-label') === label)!.getAttribute('data-cumulative')
      );

    // 100 → +40 = 140 → -25 = 115 → total 115
    expect(cumulativeByLabel('Start')).toBe(100);
    expect(cumulativeByLabel('Upsell')).toBe(140);
    expect(cumulativeByLabel('Churn')).toBe(115);
    expect(cumulativeByLabel('Razem')).toBe(115);
  });

  it('słupek niesie tooltip <title> z wartością i skumulowaną', () => {
    render(<FinanceWaterfall steps={BRIDGE} />);
    const upsell = screen
      .getAllByTestId('wf-bar')
      .find((b) => b.getAttribute('data-label') === 'Upsell')!;
    const title = upsell.querySelector('title')!.textContent ?? '';
    expect(title).toContain('Upsell');
    expect(title).toContain('Skumulowane');
  });

  it('klik słupka wywołuje onSelect(label)', () => {
    const onSelect = vi.fn();
    render(<FinanceWaterfall steps={BRIDGE} onSelect={onSelect} />);
    const churn = screen
      .getAllByTestId('wf-bar')
      .find((b) => b.getAttribute('data-label') === 'Churn')!;
    fireEvent.click(churn);
    expect(onSelect).toHaveBeenCalledWith('Churn');
  });

  it('pusty stan gdy steps puste', () => {
    render(<FinanceWaterfall steps={[]} />);
    const root = screen.getByTestId('finance-waterfall');
    expect(root.getAttribute('data-empty')).toBe('true');
    expect(screen.queryAllByTestId('wf-bar')).toHaveLength(0);
    expect(root.textContent).toMatch(/Brak danych/);
  });

  it('honoruje custom formatValue', () => {
    const fmt = (v: number) => `€${v}`;
    render(<FinanceWaterfall steps={BRIDGE} formatValue={fmt} />);
    // etykieta wartości na słupku increase: +€40
    expect(screen.getByText('+€40')).toBeInTheDocument();
  });
});
