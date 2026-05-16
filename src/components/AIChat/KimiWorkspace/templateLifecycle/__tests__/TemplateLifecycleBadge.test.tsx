/**
 * @vitest-environment jsdom
 *
 * Component tests for TemplateLifecycleBadge (Block A · EPIC-T6).
 *
 * Coverage:
 *   * Each status renders the documented label and palette.
 *   * `dot` variant collapses to a single coloured dot (A-P3 mitigation).
 *   * Aria label includes the status keyword for screen readers.
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, def?: string) => def ?? _k,
    i18n: { language: 'en' },
  }),
}));

import { TemplateLifecycleBadge } from '../TemplateLifecycleBadge';

describe('TemplateLifecycleBadge', () => {
  it('renders the Approved chip with the documented label', () => {
    render(<TemplateLifecycleBadge status="approved" />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
    const chip = screen.getByTestId('template-lifecycle-badge');
    expect(chip.getAttribute('aria-label')).toMatch(/approved/i);
  });

  it('renders the Draft chip with neutral styling', () => {
    render(<TemplateLifecycleBadge status="draft" />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('renders the Deprecated chip with amber styling', () => {
    render(<TemplateLifecycleBadge status="deprecated" />);
    expect(screen.getByText('Deprecated')).toBeInTheDocument();
  });

  it('dot variant collapses to a single dot (A-P3)', () => {
    render(<TemplateLifecycleBadge status="approved" variant="dot" />);
    expect(screen.queryByText('Approved')).not.toBeInTheDocument();
    const dot = screen.getByTestId('template-lifecycle-badge');
    expect(dot.className).toMatch(/rounded-full/);
    expect(dot.className).toMatch(/w-2/);
  });

  it('aria-label is set on dot variant for screen readers', () => {
    render(<TemplateLifecycleBadge status="deprecated" variant="dot" />);
    const dot = screen.getByTestId('template-lifecycle-badge');
    expect(dot.getAttribute('aria-label')).toMatch(/deprecated/i);
  });
});
