/**
 * @vitest-environment jsdom
 *
 * Component tests for TemplateLifecycleFilter (Block A · EPIC-T6 · A-P1).
 *
 * Coverage:
 *   * All three statuses render in the documented order.
 *   * "All" option is intentionally absent.
 *   * `aria-checked` reflects the current selection.
 *   * Click invokes `onChange` with the picked status.
 *   * `visibleStatuses` lets the host hide statuses (e.g. hide Draft for
 *     non-admins).
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, def?: string) => def ?? _k,
    i18n: { language: 'en' },
  }),
}));

import { TemplateLifecycleFilter } from '../TemplateLifecycleFilter';

describe('TemplateLifecycleFilter', () => {
  it('renders all three statuses by default', () => {
    render(<TemplateLifecycleFilter value="approved" onChange={vi.fn()} />);
    expect(screen.getByTestId('template-lifecycle-filter-approved')).toBeInTheDocument();
    expect(screen.getByTestId('template-lifecycle-filter-draft')).toBeInTheDocument();
    expect(screen.getByTestId('template-lifecycle-filter-deprecated')).toBeInTheDocument();
  });

  it('does not render an "All" option (A-P1: forced opt-in)', () => {
    render(<TemplateLifecycleFilter value="approved" onChange={vi.fn()} />);
    expect(screen.queryByText(/^all$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^wszystkie$/i)).not.toBeInTheDocument();
  });

  it('aria-checked reflects the current selection', () => {
    render(<TemplateLifecycleFilter value="draft" onChange={vi.fn()} />);
    expect(screen.getByTestId('template-lifecycle-filter-draft').getAttribute('aria-checked')).toBe(
      'true'
    );
    expect(
      screen.getByTestId('template-lifecycle-filter-approved').getAttribute('aria-checked')
    ).toBe('false');
  });

  it('invokes onChange with the picked status', () => {
    const onChange = vi.fn();
    render(<TemplateLifecycleFilter value="approved" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('template-lifecycle-filter-deprecated'));
    expect(onChange).toHaveBeenCalledWith('deprecated');
  });

  it('hides statuses listed outside visibleStatuses', () => {
    render(
      <TemplateLifecycleFilter
        value="approved"
        onChange={vi.fn()}
        visibleStatuses={['approved', 'deprecated']}
      />
    );
    expect(screen.getByTestId('template-lifecycle-filter-approved')).toBeInTheDocument();
    expect(screen.getByTestId('template-lifecycle-filter-deprecated')).toBeInTheDocument();
    expect(screen.queryByTestId('template-lifecycle-filter-draft')).not.toBeInTheDocument();
  });

  it('preserves the documented order: approved → draft → deprecated', () => {
    const { container } = render(<TemplateLifecycleFilter value="approved" onChange={vi.fn()} />);
    const buttons = Array.from(
      container.querySelectorAll('[data-testid^="template-lifecycle-filter-"]')
    );
    const order = buttons
      .map((b) => b.getAttribute('data-testid'))
      .filter((id): id is string => !!id && id !== 'template-lifecycle-filter');
    expect(order).toEqual([
      'template-lifecycle-filter-approved',
      'template-lifecycle-filter-draft',
      'template-lifecycle-filter-deprecated',
    ]);
  });
});
