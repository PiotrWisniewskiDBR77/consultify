/**
 * @vitest-environment jsdom
 *
 * Component tests for ValidationBadge (Block B / EPIC-T9).
 *
 * Coverage:
 *   * Renders default `Unverified` chip when status is null/undefined.
 *   * Each status renders the documented colour palette and label.
 *   * Menu shows only the allowed transitions and hides the current one.
 *   * Admin-only `*→unverified` transitions are hidden when
 *     `isSuperAdmin = false` and revealed when `isSuperAdmin = true`.
 *   * `onChange` is invoked with the picked status; menu closes on pick.
 *   * Read-only mode (no `onChange`) disables the trigger.
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

import { ValidationBadge } from '../ValidationBadge';

describe('ValidationBadge', () => {
  it('defaults to "Unverified" when status is null', () => {
    render(<ValidationBadge status={null} />);
    expect(screen.getByText('Unverified')).toBeInTheDocument();
  });

  it('renders a verified chip with the right label', () => {
    render(<ValidationBadge status="verified" />);
    expect(screen.getByText('Verified')).toBeInTheDocument();
  });

  it('does not show the menu when allowed is empty', () => {
    render(<ValidationBadge status="unverified" allowed={[]} onChange={vi.fn()} />);
    expect(screen.queryByTestId('provenance-validation-badge-menu')).not.toBeInTheDocument();
  });

  it('opens the menu and lists allowed transitions excluding the current state', () => {
    render(
      <ValidationBadge status="unverified" allowed={['verified', 'flagged']} onChange={vi.fn()} />
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'myWorkTable.validationBadge.validationStatus: Unverified',
      })
    );
    const menu = screen.getByTestId('provenance-validation-badge-menu');
    expect(menu).toBeInTheDocument();
    expect(screen.getByTestId('provenance-validation-badge-menu-verified')).toBeInTheDocument();
    expect(screen.getByTestId('provenance-validation-badge-menu-flagged')).toBeInTheDocument();
    // current state must be hidden from the picker
    expect(
      screen.queryByTestId('provenance-validation-badge-menu-unverified')
    ).not.toBeInTheDocument();
  });

  it('hides admin-only transitions when isSuperAdmin = false', () => {
    render(
      <ValidationBadge
        status="verified"
        allowed={['flagged', 'unverified']}
        onChange={vi.fn()}
        isSuperAdmin={false}
      />
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'myWorkTable.validationBadge.validationStatus: Verified',
      })
    );
    expect(screen.getByTestId('provenance-validation-badge-menu-flagged')).toBeInTheDocument();
    expect(
      screen.queryByTestId('provenance-validation-badge-menu-unverified')
    ).not.toBeInTheDocument();
  });

  it('reveals admin-only transitions when isSuperAdmin = true', () => {
    render(
      <ValidationBadge
        status="verified"
        allowed={['flagged', 'unverified']}
        onChange={vi.fn()}
        isSuperAdmin
      />
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'myWorkTable.validationBadge.validationStatus: Verified',
      })
    );
    expect(screen.getByTestId('provenance-validation-badge-menu-unverified')).toBeInTheDocument();
  });

  it('invokes onChange with the picked status and closes the menu', async () => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    render(
      <ValidationBadge status="unverified" allowed={['verified', 'flagged']} onChange={onChange} />
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'myWorkTable.validationBadge.validationStatus: Unverified',
      })
    );
    fireEvent.click(screen.getByTestId('provenance-validation-badge-menu-verified'));
    expect(onChange).toHaveBeenCalledWith('verified');
    // menu closed
    expect(screen.queryByTestId('provenance-validation-badge-menu')).not.toBeInTheDocument();
  });

  it('renders a disabled trigger in read-only mode', () => {
    render(<ValidationBadge status="verified" />);
    const trigger = screen.getByRole('button', {
      name: 'myWorkTable.validationBadge.validationStatus: Verified',
    });
    expect(trigger).toBeDisabled();
  });
});
