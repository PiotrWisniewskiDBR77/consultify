/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { HubWorkAreaLoadError } from '../../../../src/components/shared/ModuleHub/HubWorkAreaLoadError';

describe('HubWorkAreaLoadError', () => {
  it('renders alert semantics and handles retry/dismiss actions', () => {
    const onRetry = vi.fn();
    const onDismiss = vi.fn();
    render(
      <HubWorkAreaLoadError
        title="Failed to load"
        message="Something failed"
        errorCode="ERR_TEST"
        retryLabel="Retry"
        dismissLabel="Dismiss"
        onRetry={onRetry}
        onDismiss={onDismiss}
        className="hub-work-area-load-error--test"
      />
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert.parentElement).toHaveClass('hub-work-area-load-error--test');
    expect(screen.getByText('code: ERR_TEST')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('omits code row when error code is missing', () => {
    const onRetry = vi.fn();
    const onDismiss = vi.fn();
    render(
      <HubWorkAreaLoadError
        title="Failed to load"
        message="Something failed"
        retryLabel="Retry"
        dismissLabel="Dismiss"
        onRetry={onRetry}
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(/code:/)).not.toBeInTheDocument();
  });
});
