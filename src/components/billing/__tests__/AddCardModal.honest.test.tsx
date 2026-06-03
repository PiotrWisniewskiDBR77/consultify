/**
 * @vitest-environment jsdom
 *
 * Honesty guarantees for AddCardModal (Module 08 / decision D8).
 *
 * The legacy modal submitted a fabricated `pm_<timestamp>_mock` payment method
 * and showed a fake success toast. These tests lock in the new contract:
 *
 *   1. With self-serve OFF (default), the modal shows the honest "billing is
 *      handled manually" copy and NEVER calls createSetupIntent /
 *      addPaymentMethod — no fake payment method is ever submitted.
 *   2. With self-serve ON but Stripe NOT configured (createSetupIntent
 *      rejects / returns unusable payload), the modal degrades to the honest
 *      manual state — still no addPaymentMethod call, no fake pm_ id.
 *   3. addPaymentMethod is never invoked in any path exercised here.
 */

import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Components call t(key, 'fallback string'); return the fallback so the
    // honest English copy is asserted deterministically.
    t: (_k: string, fallback?: string) => fallback ?? _k,
    i18n: { language: 'en' },
  }),
}));

const { createSetupIntentMock, addPaymentMethodMock } = vi.hoisted(() => ({
  createSetupIntentMock: vi.fn(),
  addPaymentMethodMock: vi.fn(),
}));

vi.mock('../../../services/api', () => ({
  Api: {
    createSetupIntent: createSetupIntentMock,
    addPaymentMethod: addPaymentMethodMock,
  },
}));

import { BILLING_SELF_SERVE_FLAG_KEYS } from '../../../utils/billingSelfServeFlag';
import { AddCardModal } from '../AddCardModal';

describe('AddCardModal — honest billing state', () => {
  beforeEach(() => {
    window.localStorage.clear();
    createSetupIntentMock.mockReset();
    addPaymentMethodMock.mockReset();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it('shows the manual-billing state and submits NOTHING when self-serve is OFF (default)', async () => {
    render(<AddCardModal onClose={vi.fn()} onSuccess={vi.fn()} />);

    expect(await screen.findByText('Billing is handled manually')).toBeTruthy();

    // No fake payment method, no Stripe probe.
    expect(createSetupIntentMock).not.toHaveBeenCalled();
    expect(addPaymentMethodMock).not.toHaveBeenCalled();
  });

  it('never renders raw card-number inputs (no fake card collection)', () => {
    render(<AddCardModal onClose={vi.fn()} onSuccess={vi.fn()} />);
    // The legacy modal had a "Card Number" input; the honest modal must not.
    expect(screen.queryByPlaceholderText('4242 4242 4242 4242')).toBeNull();
  });

  it('degrades to the manual state (no fake pm_) when self-serve is ON but Stripe is not configured', async () => {
    window.localStorage.setItem(BILLING_SELF_SERVE_FLAG_KEYS.localStorage, '1');
    // Simulate /billing/setup-intent reporting "not configured".
    createSetupIntentMock.mockRejectedValue(new Error('not_configured'));

    render(<AddCardModal onClose={vi.fn()} onSuccess={vi.fn()} />);

    // It probes Stripe (flag ON)…
    await waitFor(() => expect(createSetupIntentMock).toHaveBeenCalledTimes(1));
    // …then falls back to the honest manual copy.
    expect(await screen.findByText('Billing is handled manually')).toBeTruthy();
    // And under no circumstances submits a payment method.
    expect(addPaymentMethodMock).not.toHaveBeenCalled();
  });
});
