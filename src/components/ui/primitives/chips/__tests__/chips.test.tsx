/**
 * @vitest-environment jsdom
 *
 * Smoke tests for the canonical chip primitives. These assert the public
 * API renders, the right semantic SIGNAL color is applied per tone, and
 * the DueChip risk derivation behaves.
 */
import { render, screen } from '@testing-library/react';
import { Network } from 'lucide-react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import {
  deriveDueRisk,
  DueChip,
  EntityStatusChip,
  MetaChip,
  PriorityChip,
  StatusChip,
  ToolChip,
} from '../index';

describe('canonical chips', () => {
  it('StatusChip renders label with status role', () => {
    render(<StatusChip label="Active" tone="success" />);
    const chip = screen.getByRole('status');
    expect(chip).toHaveTextContent('Active');
  });

  it('StatusChip neutral tone uses no colored dot', () => {
    const { container } = render(<StatusChip label="Idle" tone="neutral" />);
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot).not.toBeNull();
    // neutral → no inline background color (uses the token class instead)
    expect((dot as HTMLElement).style.backgroundColor).toBe('');
  });

  it('StatusChip danger tone paints the dot with the danger var', () => {
    const { container } = render(<StatusChip label="Failed" tone="danger" />);
    const dot = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(dot.style.backgroundColor).toContain('--c-danger');
  });

  it('EntityStatusChip never exposes a missing statusChip i18n key', () => {
    render(<EntityStatusChip status="deprecated" />);
    expect(screen.getByRole('status')).toHaveTextContent('Deprecated');
    expect(screen.queryByText('statusChip.deprecated')).not.toBeInTheDocument();
  });

  it('PriorityChip falls back to a capitalized level label', () => {
    render(<PriorityChip level="high" />);
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('MetaChip renders neutral metadata with an icon', () => {
    render(<MetaChip label="3 nodes" icon={Network} />);
    expect(screen.getByText('3 nodes')).toBeInTheDocument();
  });

  it('ToolChip applies the icon color', () => {
    const { container } = render(
      <ToolChip label="Mind Map" icon={Network} iconColor="var(--c-info)" />
    );
    const svg = container.querySelector('svg') as SVGElement;
    expect(svg.style.color).toContain('--c-info');
  });

  it('DueChip stays neutral when not at risk and signals danger when overdue', () => {
    const { container, rerender } = render(<DueChip label="In 5 days" risk="none" />);
    let dot = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(dot.style.backgroundColor).toBe('');

    rerender(<DueChip label="Overdue" risk="overdue" />);
    dot = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(dot.style.backgroundColor).toContain('--c-danger');
    expect(screen.getByRole('status')).toHaveTextContent('Overdue');
  });

  it('deriveDueRisk classifies past / soon / none', () => {
    const now = Date.UTC(2026, 5, 3, 12, 0, 0);
    const hour = 60 * 60 * 1000;
    expect(deriveDueRisk(now - hour, 2 * 24 * hour, now)).toBe('overdue');
    expect(deriveDueRisk(now + hour, 2 * 24 * hour, now)).toBe('soon');
    expect(deriveDueRisk(now + 10 * 24 * hour, 2 * 24 * hour, now)).toBe('none');
    expect(deriveDueRisk(null, 2 * 24 * hour, now)).toBe('none');
  });
});
