/**
 * @vitest-environment jsdom
 *
 * CB-01 / RB-004 — the ROI drawer must be a named dialog, take focus on
 * open, close on Escape, and return focus to the trigger. PL/EN tests use
 * the REAL shipped `public/locales/{lang}/translation.json` (via
 * `createRealUseTranslation`) so a PL assertion fails if the Polish string
 * is actually missing or wrong — not a hand-typed stand-in for it.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRealT } from '@/test-utils/realTranslations';

function mockI18n(lang: 'en' | 'pl') {
  vi.doMock('react-i18next', () => ({
    useTranslation: () => ({
      t: createRealT(lang),
      i18n: { language: lang },
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
  }));
}

vi.mock('@/components/Economics/financeFeatureFlags', () => ({
  isFinanceFlagEnabled: () => false,
}));
vi.mock('@/services/api/v8/results', () => ({
  V8ResultsApi: {
    getRoiInitiativeDetail: vi.fn(async () => ({
      organizationId: 'org-1',
      initiativeId: 'init-1',
      variance: { hasAssumptions: false },
      assumptions: null,
      realized: [],
    })),
  },
  shouldFallbackToLegacyResults: () => false,
}));
vi.mock('@/services/api', () => ({ Api: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('../ROIAssumptionEditor', () => ({ ROIAssumptionEditor: () => null }));

const Harness: React.FC<{ onCloseSpy: () => void }> = ({ onCloseSpy }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open ROI drawer
      </button>
      {open && (
        <ROIDetailDrawerImport.ROIDetailDrawer
          initiativeId="init-1"
          initiativeName="Digital onboarding"
          onClose={() => {
            onCloseSpy();
            setOpen(false);
          }}
        />
      )}
    </div>
  );
};

let ROIDetailDrawerImport: typeof import('../ROIDetailDrawer');

beforeEach(async () => {
  vi.resetModules();
});

describe('ROIDetailDrawer — dialog accessible contract (EN)', () => {
  it('exposes a named dialog role once opened', async () => {
    mockI18n('en');
    ROIDetailDrawerImport = await import('../ROIDetailDrawer');
    render(<Harness onCloseSpy={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open ROI drawer' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('Digital onboarding');
  });

  it('names the close action with the initiative, in English', async () => {
    mockI18n('en');
    ROIDetailDrawerImport = await import('../ROIDetailDrawer');
    render(<Harness onCloseSpy={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open ROI drawer' }));
    await screen.findByRole('dialog');

    expect(
      screen.getByRole('button', { name: 'Close Digital onboarding ROI details' })
    ).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    mockI18n('en');
    ROIDetailDrawerImport = await import('../ROIDetailDrawer');
    render(<Harness onCloseSpy={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Open ROI drawer' });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole('dialog');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('clicking the named close button also closes the drawer', async () => {
    mockI18n('en');
    ROIDetailDrawerImport = await import('../ROIDetailDrawer');
    const onCloseSpy = vi.fn();
    render(<Harness onCloseSpy={onCloseSpy} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open ROI drawer' }));
    await screen.findByRole('dialog');

    fireEvent.click(screen.getByRole('button', { name: 'Close Digital onboarding ROI details' }));

    expect(onCloseSpy).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('ROIDetailDrawer — dialog accessible contract (PL)', () => {
  it('names the close action with the initiative in real Polish, not English fallback', async () => {
    mockI18n('pl');
    ROIDetailDrawerImport = await import('../ROIDetailDrawer');
    render(<Harness onCloseSpy={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open ROI drawer' }));
    await screen.findByRole('dialog');

    // Real PL string from public/locales/pl/translation.json:
    // results.roi.closeFor = "Zamknij szczegóły ROI dla {{name}}"
    const closeButton = screen.getByRole('button', {
      name: 'Zamknij szczegóły ROI dla Digital onboarding',
    });
    expect(closeButton).toBeInTheDocument();
    // Guard against the EN string silently being shown instead (e.g. if the
    // PL key were ever deleted and the component fell back to its inline
    // English default) by asserting the English name is NOT what's exposed.
    expect(
      screen.queryByRole('button', { name: 'Close Digital onboarding ROI details' })
    ).not.toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the trigger in PL', async () => {
    mockI18n('pl');
    ROIDetailDrawerImport = await import('../ROIDetailDrawer');
    render(<Harness onCloseSpy={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Open ROI drawer' });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole('dialog');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
