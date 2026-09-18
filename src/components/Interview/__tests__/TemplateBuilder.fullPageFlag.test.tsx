/**
 * @vitest-environment jsdom
 *
 * DEC-533 (U-07 / IS-3a): the interview template document editor switches
 * between the N-card StandardArtifactShell (flag OFF) and the restored
 * full-page layout (flag ON) inside the SAME component — no file copying.
 * OFF must keep the shell screen; ON must drop the shell and render the
 * full-page header (Back · name · status · Publish + Status/Version/
 * Question-count pills moved out of the right panel).
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import enTranslation from '../../../../public/locales/en/translation.json';

const resolveEnKey = (key: string): string | undefined => {
  const value = key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      enTranslation as unknown
    );
  return typeof value === 'string' ? value : undefined;
};

const tEn = (key: string, opt?: unknown): string => {
  const resolved = resolveEnKey(key);
  if (resolved !== undefined) return resolved;
  if (typeof opt === 'string') return opt;
  if (opt && typeof opt === 'object' && 'defaultValue' in (opt as Record<string, unknown>)) {
    return String((opt as { defaultValue: unknown }).defaultValue);
  }
  return key;
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: tEn, i18n: { language: 'en', getFixedT: () => tEn } }),
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }) };
});

const { apiPost, apiGet, apiPatch } = vi.hoisted(() => ({
  apiPost: vi.fn(),
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: {
    post: apiPost,
    get: apiGet,
    patch: apiPatch,
    delete: vi.fn(async () => ({})),
    postMultipart: vi.fn(async () => ({})),
  },
  shouldAllowDemoData: () => false,
}));

vi.mock('@/services/ai/gemini', () => ({ sendMessageToAI: vi.fn(async () => '') }));

// The switch under test reads the rollout flag through this single module.
const { flagState } = vi.hoisted(() => ({ flagState: { enabled: false } }));
vi.mock('@/utils/interviewTemplateFullPageFlag', () => ({
  isInterviewTemplateFullPageEnabled: () => flagState.enabled,
}));

import { TemplateBuilder } from '../TemplateBuilder';

const renderDocument = () =>
  render(
    <TemplateBuilder isOpen presentation="document" onClose={vi.fn()} onSuccess={vi.fn()} />
  );

const makeQuestions = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `q-${index + 1}`,
    category: 'core',
    questionText: `Question ${index + 1}`,
    sortOrder: index + 1,
    answerType: 'open',
    answerOptions: [],
    isRequired: true,
  }));

/** Loads template `tmpl-1` (draft, version 2) with exactly `count` questions. */
const mockLoadedTemplate = (count: number) => {
  apiGet.mockImplementation(async (url: string) => {
    if (typeof url === 'string' && url.endsWith('/questions')) return makeQuestions(count);
    return {
      id: 'tmpl-1',
      name: 'Northwind interview',
      status: 'draft',
      version: 2,
      scope: 'organization',
      areaTags: [],
    };
  });
};

const AI_MENU_ITEMS = ['analizuj', 'uzupelnij-sekcje', 'uzupelnij-dokument'];

const menuPositions = (menu: HTMLElement) =>
  within(menu)
    .getAllByRole('menuitem')
    .map((item) => item.getAttribute('data-pozycja'));

beforeEach(() => {
  flagState.enabled = false;
  apiPost.mockReset();
  apiGet.mockReset();
  apiPatch.mockReset();
  apiPost.mockResolvedValue({ id: 'tmpl-new-1' });
  apiGet.mockResolvedValue([]);
  apiPatch.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('TemplateBuilder full-page flag switch (DEC-533 / U-07)', () => {
  it('flag OFF keeps the document editor inside the N-card StandardArtifactShell', () => {
    renderDocument();

    // The shell's NModeToolbar renders the active section label "Template
    // content" — an OFF-only marker (the full-page layout has no toolbar).
    expect(screen.getAllByText('Template content').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('template-builder-fullpage-header')).not.toBeInTheDocument();
  });

  it('flag ON drops the shell and renders the full-page header with Back · Publish · pills', () => {
    flagState.enabled = true;
    renderDocument();

    const header = screen.getByTestId('template-builder-fullpage-header');
    expect(header).toBeInTheDocument();
    // No shell toolbar in full-page mode.
    expect(screen.queryAllByText('Template content')).toHaveLength(0);
    // Back button lives in the header.
    expect(within(header).getByRole('button', { name: /Back/i })).toBeInTheDocument();
    // Publish CTA and the Version pill moved into the header.
    expect(within(header).getByText('Publish')).toBeInTheDocument();
    expect(within(header).getByText(/Version/)).toBeInTheDocument();
  });

  it('keeps the questions counter in the flex flow instead of absolutely centered over the action buttons (overlap defect fix)', () => {
    render(<TemplateBuilder isOpen onClose={vi.fn()} onSuccess={vi.fn()} />);

    const questionsHeader = screen.getByTestId('template-questions-header');
    const counter = screen.getByTestId('template-questions-counter');
    // Counter and buttons share the row via justify-between; the counter is no
    // longer an absolutely-centered overlay that the buttons slide under.
    expect(questionsHeader.className).toContain('justify-between');
    expect(questionsHeader.className).not.toContain('justify-end');
    expect(counter.className).not.toContain('absolute');
  });
});

describe('TemplateBuilder full-page header behaviour (Wpis 103 P1)', () => {
  it('Publish in the full-page header posts to the publish endpoint, not the draft patch', async () => {
    flagState.enabled = true;
    mockLoadedTemplate(3);
    render(
      <TemplateBuilder
        isOpen
        presentation="document"
        templateId="tmpl-1"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const header = await screen.findByTestId('template-builder-fullpage-header');
    await waitFor(() => expect(within(header).getByText('3 questions')).toBeInTheDocument());
    fireEvent.click(within(header).getByText('Publish'));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith(
        '/interview/templates/tmpl-1/publish',
        expect.objectContaining({ expectedVersion: 2 })
      )
    );
    expect(apiPatch).not.toHaveBeenCalledWith('/interview/templates/tmpl-1', expect.anything());
  });

  it('Back in the full-page header calls onClose', async () => {
    flagState.enabled = true;
    mockLoadedTemplate(3);
    const onClose = vi.fn();
    render(
      <TemplateBuilder
        isOpen
        presentation="document"
        templateId="tmpl-1"
        onClose={onClose}
        onSuccess={vi.fn()}
      />
    );

    const header = await screen.findByTestId('template-builder-fullpage-header');
    fireEvent.click(within(header).getByRole('button', { name: /Back/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('the question-count pill follows the loaded question list (6 vs 3)', async () => {
    flagState.enabled = true;

    mockLoadedTemplate(6);
    const first = render(
      <TemplateBuilder
        isOpen
        presentation="document"
        templateId="tmpl-1"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );
    await waitFor(() =>
      expect(
        within(screen.getByTestId('template-builder-fullpage-header')).getByText('6 questions')
      ).toBeInTheDocument()
    );
    first.unmount();

    mockLoadedTemplate(3);
    render(
      <TemplateBuilder
        isOpen
        presentation="document"
        templateId="tmpl-1"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );
    await waitFor(() =>
      expect(
        within(screen.getByTestId('template-builder-fullpage-header')).getByText('3 questions')
      ).toBeInTheDocument()
    );
  });

  it('flag ON with the modal presentation stays out of the full-page layout', async () => {
    flagState.enabled = true;
    mockLoadedTemplate(3);
    render(<TemplateBuilder isOpen templateId="tmpl-1" onClose={vi.fn()} onSuccess={vi.fn()} />);

    await screen.findByText('Question 3');

    expect(screen.queryByTestId('template-builder-fullpage-header')).not.toBeInTheDocument();
  });

  it('full-page mode keeps the "Work with AI" entry in the header and opens the N-card menu', async () => {
    flagState.enabled = true;
    mockLoadedTemplate(3);
    render(
      <TemplateBuilder
        isOpen
        presentation="document"
        templateId="tmpl-1"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const header = await screen.findByTestId('template-builder-fullpage-header');
    fireEvent.click(within(header).getByTestId('pracuj-z-ai'));

    expect(menuPositions(await screen.findByTestId('pracuj-z-ai-menu'))).toEqual(AI_MENU_ITEMS);
  });

  it('flag OFF opens the same AI menu from the shell toolbar (parity with full page)', async () => {
    mockLoadedTemplate(3);
    render(
      <TemplateBuilder
        isOpen
        presentation="document"
        templateId="tmpl-1"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    await screen.findByText('Question 3');
    expect(screen.queryByTestId('template-builder-fullpage-header')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('pracuj-z-ai'));

    expect(menuPositions(await screen.findByTestId('pracuj-z-ai-menu'))).toEqual(AI_MENU_ITEMS);
  });
});
