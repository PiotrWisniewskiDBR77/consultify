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
 *  - the retired legacy writer is not exposed as a creation CTA,
 *  - selecting a row opens the per-program dashboard in the preview pane.
 *
 * The auditApi client is mocked so the hub mounts deterministically offline.
 * Mirrors src/components/Initiatives/__tests__/InitiativesHub.smoke.test.tsx.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => {
    const t = (k: string, opts?: any) => {
      if (typeof opts === 'string') return opts;
      if (opts?.defaultValue) return opts.defaultValue;
      if (k === 'audit.noAuditProgramsYet') return 'No audit programs yet.';
      if (k === 'audit.completion') return 'Completion';
      return k;
    };
    return { t, i18n: { language: 'en', getFixedT: () => t } };
  },
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

  it('does not expose the retired legacy program writer as a creation CTA', async () => {
    render(<AuditsHub />);
    await waitFor(() => expect(screen.getByTestId('audits-hub')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'New audit program' })).toBeNull();
    expect(screen.queryByText('Define the objective, what to ask, and who fills it.')).toBeNull();
  });

  it('opens the per-program dashboard in the preview when a row is clicked', async () => {
    render(<AuditsHub />);
    const row = await screen.findByText('ISO 27001 readiness');
    fireEvent.click(row);

    // Preview pane renders the dashboard heading (program name) + a Completion block.
    await waitFor(() => {
      // program name appears in the preview dashboard heading as well
      expect(screen.getAllByText('ISO 27001 readiness').length).toBeGreaterThan(0);
      expect(screen.getByText(/Completion:/)).toBeInTheDocument();
    });
  });
});

describe('AuditsHub — AMD-AUD-RIGHTS-001: legacy ISO 27001 preset launcher is hard-disabled', () => {
  // The i18n mock above returns the raw key when no defaultValue is supplied,
  // so the launcher (if rendered) would show as the literal 'audit.iso27001'.
  const ISO_LAUNCHER_LABEL = 'audit.iso27001';

  afterEach(() => {
    window.localStorage.removeItem('ff.audit_iso27001_preset');
    window.history.pushState({}, '', '/');
  });

  it('does not render the launcher by default', async () => {
    render(<AuditsHub />);
    await waitFor(() => expect(screen.getByTestId('audits-hub')).toBeInTheDocument());
    expect(screen.queryByText(ISO_LAUNCHER_LABEL)).toBeNull();
  });

  it('the historical query override (?ff_auditIso27001Preset=1) does not change the result', async () => {
    window.history.pushState({}, '', '/?ff_auditIso27001Preset=1');
    render(<AuditsHub />);
    await waitFor(() => expect(screen.getByTestId('audits-hub')).toBeInTheDocument());
    expect(screen.queryByText(ISO_LAUNCHER_LABEL)).toBeNull();
  });

  it('the historical localStorage override (ff.audit_iso27001_preset=1) does not change the result', async () => {
    window.localStorage.setItem('ff.audit_iso27001_preset', '1');
    render(<AuditsHub />);
    await waitFor(() => expect(screen.getByTestId('audits-hub')).toBeInTheDocument());
    expect(screen.queryByText(ISO_LAUNCHER_LABEL)).toBeNull();
  });

  it('query AND localStorage together still do not change the result', async () => {
    window.history.pushState({}, '', '/?ff_auditIso27001Preset=1');
    window.localStorage.setItem('ff.audit_iso27001_preset', 'true');
    render(<AuditsHub />);
    await waitFor(() => expect(screen.getByTestId('audits-hub')).toBeInTheDocument());
    expect(screen.queryByText(ISO_LAUNCHER_LABEL)).toBeNull();
  });
});
