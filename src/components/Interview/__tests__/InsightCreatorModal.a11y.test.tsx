/**
 * @vitest-environment jsdom
 *
 * CB-01 / RV-014 — the AI Insight Creator overlay must be a named dialog,
 * take focus on the Title input, close on Escape, and return focus to the
 * trigger; the Title input must be labelled and required. PL/EN tests use
 * the REAL shipped `public/locales/{lang}/translation.json` (via
 * `createRealT`) so a PL assertion fails if the Polish string is actually
 * missing or wrong.
 *
 * DEC 03.09 wieczór (A4, docs/program/DECYZJE_WLASCICIELA_DO_PODJECIA_20260904.md
 * wiersz A4 — "Kreator wywiadu → ON od razu") flipped `isInterviewCreatorShellEnabled()`
 * to default ON. This file's original assertions described the LEGACY chrome
 * as "the" contract (implicit default = OFF). They now set the local
 * override EXPLICITLY to whichever mode they test, so the suite stays
 * correct regardless of the flag's own default. The legacy-chrome tests
 * below remain real regression coverage of the CLAUDE.md §8 killswitch path
 * (`?ff_interviewCreatorShell=0` / `ff.interview_creator_shell=0`), NOT of
 * today's default. A dedicated a11y contract for the now-default
 * WizardModal/"creator" chrome (dialog accessible name — currently the
 * title AND subtitle concatenated via one shared `aria-labelledby`, Title
 * field location inside step 1, focus order) is the "odbiór 40-punktową
 * listą po włączeniu" the source decision row itself calls out as still
 * owed — out of scope for this flip and tracked separately (see spawned
 * follow-up task), not invented here from guesswork.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createRealT } from '@/test-utils/realTranslations';
import { INTERVIEW_CREATOR_SHELL_FLAG_KEYS } from '@/utils/interviewCreatorShellFlag';

function mockI18n(lang: 'en' | 'pl') {
  const t = createRealT(lang);
  vi.doMock('react-i18next', () => ({
    useTranslation: () => ({
      t,
      i18n: { language: lang, getFixedT: () => t },
    }),
    initReactI18next: { type: '3rdParty', init: vi.fn() },
  }));
}

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock('@/services/api', () => ({
  Api: { get: vi.fn(async () => ({})), post: vi.fn(async () => ({})), delete: vi.fn() },
}));

vi.mock('@/services/api/v8/interview', () => ({
  V8InterviewApi: {
    listInsights: vi.fn(async () => ({ insights: [] })),
    listContextDocuments: vi.fn(async () => ({ documents: [] })),
    checkInsightSimilarity: vi.fn(async () => ({ matches: [] })),
    createInsight: vi.fn(async () => ({ id: 'insight-1' })),
    uploadContextDocument: vi.fn(async () => ({})),
  },
}));

let InsightCreatorModalImport: typeof import('../InsightCreatorModal');

const Harness: React.FC<{ onCloseSpy: () => void }> = ({ onCloseSpy }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open insight creator
      </button>
      <InsightCreatorModalImport.InsightCreatorModal
        isOpen={open}
        onClose={() => {
          onCloseSpy();
          setOpen(false);
        }}
        onSuccess={vi.fn()}
      />
    </div>
  );
};

const mountAndOpen = async (
  lang: 'en' | 'pl',
  onCloseSpy: () => void = vi.fn(),
  // DEC 03.09 wieczór A4 flipped the default to ON — callers below pass the
  // mode they actually mean to test EXPLICITLY instead of relying on
  // whatever the flag's own default happens to be today.
  shellMode: 'legacy' | 'shell' = 'shell'
) => {
  vi.resetModules();
  window.localStorage.setItem(
    INTERVIEW_CREATOR_SHELL_FLAG_KEYS.localStorage,
    shellMode === 'shell' ? '1' : '0'
  );
  mockI18n(lang);
  InsightCreatorModalImport = await import('../InsightCreatorModal');
  render(<Harness onCloseSpy={onCloseSpy} />);
  fireEvent.click(screen.getByRole('button', { name: 'Open insight creator' }));
  await screen.findByRole('dialog');
};

beforeEach(() => {
  vi.resetModules();
  window.localStorage.removeItem(INTERVIEW_CREATOR_SHELL_FLAG_KEYS.localStorage);
});

describe('InsightCreatorModal — dialog accessible contract (EN)', () => {
  it('keeps the legacy chrome and performs no generation request when Creator Shell is explicitly OFF (killswitch, CLAUDE.md §8)', async () => {
    await mountAndOpen('en', vi.fn(), 'legacy');

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('h-[560px]', 'w-[720px]');
    expect(dialog).not.toHaveAttribute('data-creator-shell');

    const { Api } = await import('@/services/api');
    const { V8InterviewApi } = await import('@/services/api/v8/interview');
    expect(Api.post).not.toHaveBeenCalled();
    expect(V8InterviewApi.createInsight).not.toHaveBeenCalled();
  });

  it('uses the shared 1040x840 stepped geometry when Creator Shell is explicitly ON', async () => {
    window.localStorage.setItem(INTERVIEW_CREATOR_SHELL_FLAG_KEYS.localStorage, '1');
    await mountAndOpen('en');

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveClass('creator-shell');
    expect(dialog).toHaveClass(
      'h-[min(840px,calc(100vh-48px))]',
      'w-[min(1040px,calc(100vw-64px))]'
    );
    expect(dialog).not.toHaveClass('h-[560px]', 'w-[720px]');
  });

  it('updates the Creator Shell outcome summary from the real title state', async () => {
    window.localStorage.setItem(INTERVIEW_CREATOR_SHELL_FLAG_KEYS.localStorage, '1');
    await mountAndOpen('en');

    fireEvent.change(screen.getByLabelText(/^Insight Title \(required\)$/), {
      target: { value: 'Warehouse ownership' },
    });
    expect(screen.getByText(/Insight “Warehouse ownership”/)).toBeInTheDocument();
  });

  it('names the step 1 and step 2 footer actions by their result', async () => {
    window.localStorage.setItem(INTERVIEW_CREATOR_SHELL_FLAG_KEYS.localStorage, '1');
    await mountAndOpen('en');

    expect(screen.getByRole('button', { name: 'Next: Material' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^Insight Title \(required\)$/), {
      target: { value: 'Warehouse ownership' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next: Material' }));

    expect(await screen.findByRole('button', { name: 'Run now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next: Refine' })).toBeInTheDocument();
  });

  it('exposes a dialog named "AI Insight Creator" (legacy chrome)', async () => {
    await mountAndOpen('en', vi.fn(), 'legacy');

    expect(screen.getByRole('dialog')).toHaveAccessibleName('AI Insight Creator');
  });

  it('names the close action "Close" (legacy chrome)', async () => {
    await mountAndOpen('en', vi.fn(), 'legacy');

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('labels the Title input "Insight Title", requires it, and focuses it on open (legacy chrome)', async () => {
    await mountAndOpen('en', vi.fn(), 'legacy');

    // The visible label appends a literal " *" required marker after the
    // translated text, so the accessible name is "Insight Title *".
    const titleInput = screen.getByLabelText(/^Insight Title \(required\)$/);
    expect(titleInput).toBeRequired();
    await waitFor(() => expect(titleInput).toHaveFocus());
  });

  it('closes on Escape and returns focus to the trigger (legacy chrome)', async () => {
    vi.resetModules();
    window.localStorage.setItem(INTERVIEW_CREATOR_SHELL_FLAG_KEYS.localStorage, '0');
    mockI18n('en');
    InsightCreatorModalImport = await import('../InsightCreatorModal');
    render(<Harness onCloseSpy={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: 'Open insight creator' });
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole('dialog');

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('clicking the named close button also closes the dialog (legacy chrome)', async () => {
    const onCloseSpy = vi.fn();
    await mountAndOpen('en', onCloseSpy, 'legacy');

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onCloseSpy).toHaveBeenCalledTimes(1);
  });
});

describe('InsightCreatorModal — dialog accessible contract (PL, legacy chrome)', () => {
  it('exposes a dialog named in real Polish, not English fallback', async () => {
    await mountAndOpen('pl', vi.fn(), 'legacy');

    // Real PL string: interview.insightCreatorModal.aiInsightCreator = "Kreator Wniosków AI"
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Kreator Wniosków AI');
    expect(screen.queryByText('AI Insight Creator')).not.toBeInTheDocument();
  });

  it('names the close action in real Polish', async () => {
    await mountAndOpen('pl', vi.fn(), 'legacy');

    // Real PL string: interview.insightCreatorModal.close = "Zamknij"
    expect(screen.getByRole('button', { name: 'Zamknij' })).toBeInTheDocument();
  });

  it('labels the Title input in real Polish', async () => {
    await mountAndOpen('pl', vi.fn(), 'legacy');

    // Real PL string: interview.insightCreatorModal.insightTitle = "Tytuł
    // wniosków" (+ the same literal " *" required marker as EN).
    const titleInput = screen.getByLabelText(/^Tytuł wniosków \(wymagane\)$/);
    expect(titleInput).toBeRequired();
  });
});
