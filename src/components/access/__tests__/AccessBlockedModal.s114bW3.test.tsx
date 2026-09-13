/**
 * S1.14b / W3 — the trial export block spoke Polish inside an English UI.
 *
 * Measured on staging 13.09 (3/3 for Markdown, DOCX, PDF): the 403 body is
 * `{code:'TRIAL_EXPORT_DISABLED', message:'Ta funkcja jest czasowo wyłączona dla
 * triala.', messageEn:…, cta:{label:'Skontaktuj się z zespołem'}}` and the modal
 * rendered `detail.message` and `detail.cta.label` verbatim — Polish sentence,
 * Polish crimson button, English heading and English "All limits removed…" note
 * around them. The POLICY is deliberate (env flag TRIAL_EXPORT_ENABLED, default
 * off) and is NOT changed here; only which text the user reads.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../../../services/funnelAnalytics', () => ({ trackFunnelEvent: vi.fn() }));

const CATALOG: Record<string, string> = {
  'access.blocked.TRIAL_EXPORT_DISABLED': 'Export is available on paid plans.',
  'access.blocked.default': 'Access to this feature is blocked.',
  'access.cta.contactSales': 'Contact Sales',
  'access.modal.title': 'Access required',
  'access.modal.close': 'Close',
  'access.upgrade.instantUnlock': 'All limits removed instantly after upgrade',
};
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) =>
      CATALOG[key] ?? opts?.defaultValue ?? key,
  }),
}));

import { AccessBlockedModal } from '../AccessBlockedModal';

const blockWith = (detail: Record<string, unknown>) => {
  window.dispatchEvent(new CustomEvent('access:blocked', { detail }));
};

describe('S1.14b/W3 — export block copy', () => {
  it('shows the localized sentence, never the Polish text the API sent', async () => {
    render(<AccessBlockedModal />);
    blockWith({
      code: 'TRIAL_EXPORT_DISABLED',
      message: 'Ta funkcja jest czasowo wyłączona dla triala.',
      cta: { label: 'Skontaktuj się z zespołem', href: '/contact' },
    });

    expect(await screen.findByText('Export is available on paid plans.')).toBeTruthy();
    expect(screen.queryByText('Ta funkcja jest czasowo wyłączona dla triala.')).toBeNull();
  });

  it('shows the localized CTA label, never the Polish label the API sent', async () => {
    render(<AccessBlockedModal />);
    blockWith({
      code: 'TRIAL_EXPORT_DISABLED',
      message: 'Ta funkcja jest czasowo wyłączona dla triala.',
      cta: { label: 'Skontaktuj się z zespołem', href: '/contact' },
    });

    expect(await screen.findByText('Contact Sales')).toBeTruthy();
    expect(screen.queryByText('Skontaktuj się z zespołem')).toBeNull();
  });

  it('still falls back to the backend message for a code the catalog does not know', async () => {
    render(<AccessBlockedModal />);
    blockWith({ code: 'SOME_FUTURE_CODE', message: 'Backend explains this one.' });

    expect(await screen.findByText('Backend explains this one.')).toBeTruthy();
  });
});
