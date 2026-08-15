/**
 * @vitest-environment jsdom
 *
 * Component tests for AuditsHub (Module 12 — Audyty).
 *
 * Covers the §27 FilterableTable migration + the surrounding hub wiring:
 *  - mounts and renders the canonical hub shell + table (not the old <ul>),
 *  - renders one row per audit program returned by listPrograms(),
 *  - server-side search wiring: typing in the search box re-calls
 *    listPrograms({ search }),
 *  - the "New audit program" primary CTA opens the wizard,
 *  - selecting a row opens the per-program dashboard in the preview pane.
 *
 * The auditApi client is mocked so the hub mounts deterministically offline.
 * Mirrors src/components/Initiatives/__tests__/InitiativesHub.smoke.test.tsx.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: any) => {
      if (typeof opts === 'string') return opts;
      if (opts?.defaultValue) return opts.defaultValue;
      const translations: Record<string, string> = {
        'audit.auditPrograms': 'Audit programs',
        'audit.newAuditProgram': 'New audit program',
        'audit.noAuditProgramsYet': 'No audit programs yet.',
        'audit.defineObjectiveWhatToAsk': 'Define the objective, what to ask, and who fills it.',
        'audit.completion': 'Completion',
      };
      return translations[k] ?? k;
    },
    i18n: { language: 'en', getFixedT: () => (key: string) => key },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }) };
});

const { listPrograms, deleteProgram, generateSurveys, getCompletion } = vi.hoisted(() => ({
  listPrograms: vi.fn(),
  deleteProgram: vi.fn(),
  generateSurveys: vi.fn(),
  getCompletion: vi.fn(),
}));

vi.mock('../auditApi', () => ({
  listPrograms,
  deleteProgram,
  generateSurveys,
  getCompletion,
  reopenProgram: vi.fn(),
  updateProgram: vi.fn(),
  listTemplateOptions: vi.fn(async () => []),
  listUserOptions: vi.fn(async () => []),
  createProgram: vi.fn(async () => ({ id: 'new', name: 'New' })),
}));

import { AuditsHub } from '../AuditsHub';

const makeProgram = (over: Record<string, any> = {}) => ({
  id: 'prog-1',
  organizationId: 'org-1',
  name: 'ISO 27001 readiness',
  description: null,
  objective: 'Assess ISMS readiness',
  status: 'draft',
  preset: 'iso27001',
  config: { templateIds: ['t1', 't2'], assigneeIds: ['u1'], surveysGenerated: false },
  createdBy: 'u1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

const okResult = (programs: any[]) => ({
  programs,
  total: programs.length,
  limit: 50,
  offset: 0,
});

beforeEach(() => {
  listPrograms.mockReset();
  deleteProgram.mockReset();
  generateSurveys.mockReset();
  getCompletion.mockReset();
  listPrograms.mockResolvedValue(okResult([makeProgram()]));
  getCompletion.mockResolvedValue({
    generated: false,
    total: 0,
    done: 0,
    percent: 0,
    byStatus: {},
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AuditsHub — §27 list', () => {
  it('mounts the hub shell and renders the program in a table (not a <ul>)', async () => {
    const { container } = render(<AuditsHub />);

    await waitFor(() => {
      expect(screen.getByTestId('audits-hub')).toBeInTheDocument();
    });
    // The program name renders…
    expect(await screen.findByText('ISO 27001 readiness')).toBeInTheDocument();
    // …inside a real <table> (canonical FilterableTable), not the old card list.
    expect(container.querySelector('table')).toBeTruthy();
    expect(container.querySelector('ul.space-y-2')).toBeNull();
  });

  it('renders the honest empty state when there are no programs', async () => {
    listPrograms.mockResolvedValue(okResult([]));
    render(<AuditsHub />);
    expect(await screen.findByText('No audit programs yet.')).toBeInTheDocument();
  });

  it('renders one row per program', async () => {
    listPrograms.mockResolvedValue(
      okResult([
        makeProgram({ id: 'a', name: 'Alpha audit' }),
        makeProgram({ id: 'b', name: 'Beta audit' }),
      ])
    );
    render(<AuditsHub />);
    expect(await screen.findByText('Alpha audit')).toBeInTheDocument();
    expect(screen.getByText('Beta audit')).toBeInTheDocument();
  });

  it('drives server-side search: typing re-calls listPrograms with the search term', async () => {
    render(<AuditsHub />);
    await waitFor(() => expect(listPrograms).toHaveBeenCalled());

    // The search box lives behind a toggle in the canonical ModuleNavBar chrome.
    fireEvent.click(screen.getByTitle('Search'));
    const searchBox = await screen.findByPlaceholderText('Search...');
    fireEvent.change(searchBox, { target: { value: 'iso' } });

    await waitFor(
      () => {
        expect(listPrograms.mock.calls.some(([arg]) => arg && arg.search === 'iso')).toBe(true);
      },
      { timeout: 2000 }
    );
  });

  it('opens the wizard from the "New audit program" primary CTA', async () => {
    render(<AuditsHub />);
    await waitFor(() => expect(screen.getByTestId('audits-hub')).toBeInTheDocument());

    const cta = await screen.findByText('New audit program');
    fireEvent.click(cta);

    // The wizard header reuses the same EN label; assert the wizard chrome appears.
    await waitFor(() => {
      expect(
        screen.getByText('Define the objective, what to ask, and who fills it.')
      ).toBeInTheDocument();
    });
  });

  it('opens the per-program dashboard in the preview when a row is clicked', async () => {
    render(<AuditsHub />);
    const row = await screen.findByText('ISO 27001 readiness');
    fireEvent.click(row);

    // The canonical compact preview renders completion inside its details text.
    await waitFor(() => {
      // program name appears in the preview dashboard heading as well
      expect(screen.getAllByText('ISO 27001 readiness').length).toBeGreaterThan(0);
      expect(document.body).toHaveTextContent('Completion: —');
      expect(getCompletion).not.toHaveBeenCalled();
    });
  });
});
