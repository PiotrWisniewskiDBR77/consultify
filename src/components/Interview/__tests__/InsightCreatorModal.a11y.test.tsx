/**
 * @vitest-environment jsdom
 *
 * CB-01 / RV-014 — the AI Insight Creator overlay must be a named dialog,
 * take focus on the Title input, close on Escape, and return focus to the
 * trigger; the Title input must be labelled and required. PL/EN tests use
 * the REAL shipped `public/locales/{lang}/translation.json` (via
 * `createRealT`) so a PL assertion fails if the Polish string is actually
 * missing or wrong.
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

const mountAndOpen = async (lang: 'en' | 'pl', onCloseSpy: () => void = vi.fn()) => {
  vi.resetModules();
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
  it('keeps the legacy chrome and performs no generation request when Creator Shell is OFF', async () => {
    await mountAndOpen('en');

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

  it('exposes a dialog named "AI Insight Creator"', async () => {
    await mountAndOpen('en');

    expect(screen.getByRole('dialog')).toHaveAccessibleName('AI Insight Creator');
  });

  it('names the close action "Close"', async () => {
    await mountAndOpen('en');

    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('labels the Title input "Insight Title", requires it, and focuses it on open', async () => {
    await mountAndOpen('en');

    // The visible label appends a literal " *" required marker after the
    // translated text, so the accessible name is "Insight Title *".
    const titleInput = screen.getByLabelText(/^Insight Title \*$/);
    expect(titleInput).toBeRequired();
    await waitFor(() => expect(titleInput).toHaveFocus());
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    vi.resetModules();
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

  it('clicking the named close button also closes the dialog', async () => {
    const onCloseSpy = vi.fn();
    await mountAndOpen('en', onCloseSpy);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onCloseSpy).toHaveBeenCalledTimes(1);
  });
});

describe('InsightCreatorModal — dialog accessible contract (PL)', () => {
  it('exposes a dialog named in real Polish, not English fallback', async () => {
    await mountAndOpen('pl');

    // Real PL string: interview.insightCreatorModal.aiInsightCreator = "Kreator Wniosków AI"
    expect(screen.getByRole('dialog')).toHaveAccessibleName('Kreator Wniosków AI');
    expect(screen.queryByText('AI Insight Creator')).not.toBeInTheDocument();
  });

  it('names the close action in real Polish', async () => {
    await mountAndOpen('pl');

    // Real PL string: interview.insightCreatorModal.close = "Zamknij"
    expect(screen.getByRole('button', { name: 'Zamknij' })).toBeInTheDocument();
  });

  it('labels the Title input in real Polish', async () => {
    await mountAndOpen('pl');

    // Real PL string: interview.insightCreatorModal.insightTitle = "Tytuł
    // wniosków" (+ the same literal " *" required marker as EN).
    const titleInput = screen.getByLabelText(/^Tytuł wniosków \*$/);
    expect(titleInput).toBeRequired();
  });
});
