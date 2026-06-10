/**
 * @vitest-environment jsdom
 *
 * Smoke tests for the canonical <Banner> surface.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { Banner } from '../Banner';

describe('Banner', () => {
  it('renders title and message with a status role for non-danger variants', () => {
    render(<Banner variant="info" title="Heads up" message="Something happened" />);
    expect(screen.getByText('Heads up')).toBeInTheDocument();
    expect(screen.getByText('Something happened')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('uses an assertive alert role for the danger variant', () => {
    render(<Banner variant="danger" title="Critical" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('fires the action handler when the action button is clicked', () => {
    const onClick = vi.fn();
    render(<Banner variant="warning" title="Warn" action={{ label: 'View all', onClick }} />);
    fireEvent.click(screen.getByRole('button', { name: 'View all' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('dismisses and calls onDismiss when dismissible', () => {
    const onDismiss = vi.fn();
    render(<Banner variant="success" title="Done" dismissible onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
  });
});
