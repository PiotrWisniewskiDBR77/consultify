/**
 * S1.14b / B1 — "Confirm & create" told the user nothing when the conversion failed.
 *
 * Measured on staging 13.09: the popover closed and nothing happened; the 400 from
 * `POST /api/initiatives` surfaced only as an unhandled promise rejection
 * (PAGEERROR) because `handleConfirm` fired `onConvert` WITHOUT awaiting it and
 * closed the dialog on the next line. The dialog must now wait for the conversion,
 * stay open on failure and show the reason.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const materializeMyWorkSession = vi.fn();
vi.mock('@/services/traceabilityService', () => ({
  materializeMyWorkSession: (...args: unknown[]) => materializeMyWorkSession(...args),
}));
vi.mock('@/services/funnelAnalytics', () => ({ trackFunnelEvent: vi.fn() }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, d?: unknown) =>
      typeof d === 'string' ? d : ((d as { defaultValue?: string })?.defaultValue ?? _k),
  }),
}));

import { ConvertToDialog } from '../ConvertToDialog';

describe('S1.14b/B1 — ConvertToDialog reports a failed conversion', () => {
  beforeEach(() => {
    materializeMyWorkSession.mockReset();
    materializeMyWorkSession.mockResolvedValue({ id: 'session-1' });
  });

  const sources = [{ type: 'idea' as const, id: 'idea-1', title: 'Order-to-Cash' }];

  it('keeps the dialog open and shows the server reason when onConvert rejects', async () => {
    const onClose = vi.fn();
    const onConvert = vi
      .fn()
      .mockRejectedValue(
        new Error('projectId is required — every initiative must belong to a project')
      );

    render(
      <ConvertToDialog
        open
        onClose={onClose}
        sources={sources}
        targetType="initiative"
        onConvert={onConvert}
      />
    );

    await userEvent.click(screen.getByText('Confirm & create'));

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByRole('alert').textContent).toContain('projectId is required');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes the dialog when the conversion succeeds', async () => {
    const onClose = vi.fn();
    const onConvert = vi.fn().mockResolvedValue(undefined);

    render(
      <ConvertToDialog
        open
        onClose={onClose}
        sources={sources}
        targetType="initiative"
        onConvert={onConvert}
      />
    );

    await userEvent.click(screen.getByText('Confirm & create'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
