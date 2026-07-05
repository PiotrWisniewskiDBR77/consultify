import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Sparkline } from '../../../src/components/Benefits/Sparkline';

describe('Sparkline (L2)', () => {
  it('renders "No data" placeholder for empty series', () => {
    render(<Sparkline data={[]} width={120} height={40} className="x" />);
    const el = screen.getByText('No data');
    expect(el).toBeInTheDocument();
    expect(el).toHaveStyle({ width: '120px', height: '40px' });
    expect(el.className).toContain('x');
  });

  it('renders an svg for non-empty series', () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('viewBox')).toBe('0 0 100 32');
  });

  it('draws main line path and end dot', () => {
    const { container } = render(<Sparkline data={[10, 20, 15]} />);
    const paths = Array.from(container.querySelectorAll('path'));
    expect(paths.length).toBeGreaterThanOrEqual(2);
    const main = paths[1];
    expect(main.getAttribute('d')).toMatch(/^M\s/);

    const dot = container.querySelector('circle');
    expect(dot).toBeTruthy();
    expect(dot?.getAttribute('r')).toBe('3');
  });

  it('renders target line when targetValue is provided and showTarget=true', () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} targetValue={2} showTarget />);
    const line = container.querySelector('line');
    expect(line).toBeTruthy();
    expect(line?.getAttribute('stroke-dasharray')).toBe('3,3');
  });

  it('does not render target line when showTarget=false', () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} targetValue={2} showTarget={false} />);
    expect(container.querySelector('line')).toBeFalsy();
  });

  it('uses green classes when isOnTarget=true', () => {
    const { container } = render(<Sparkline data={[1, 2]} isOnTarget />);
    const paths = Array.from(container.querySelectorAll('path'));
    expect(paths[0].className.baseVal).toContain('fill-green-500/10');
    expect(paths[1].className.baseVal).toContain('stroke-green-500');
    expect(container.querySelector('circle')?.className.baseVal).toContain('fill-green-500');
  });

  it('uses red classes when isOnTarget=false', () => {
    const { container } = render(<Sparkline data={[1, 2]} isOnTarget={false} />);
    const paths = Array.from(container.querySelectorAll('path'));
    expect(paths[0].className.baseVal).toContain('fill-danger-500/10');
    expect(paths[1].className.baseVal).toContain('stroke-danger-500');
    expect(container.querySelector('circle')?.className.baseVal).toContain('fill-danger-500');
  });

  it('handles single-point data without NaN coordinates', () => {
    const { container } = render(<Sparkline data={[5]} width={80} height={20} />);
    const main = container.querySelectorAll('path')[1];
    expect(main.getAttribute('d')).toMatch(/^M\s[0-9.]+\s[0-9.]+$/);
    const dot = container.querySelector('circle');
    expect(dot?.getAttribute('cx')).toMatch(/^[0-9.]+$/);
    expect(dot?.getAttribute('cy')).toMatch(/^[0-9.]+$/);
  });

  it('includes targetValue in min/max scaling to avoid clipping', () => {
    const { container } = render(<Sparkline data={[10, 10]} targetValue={100} />);
    const line = container.querySelector('line');
    expect(line).toBeTruthy();
    const y = Number(line?.getAttribute('y1'));
    expect(Number.isFinite(y)).toBe(true);
  });

  it('applies custom width/height to svg', () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} width={140} height={50} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('140');
    expect(svg?.getAttribute('height')).toBe('50');
  });
});
