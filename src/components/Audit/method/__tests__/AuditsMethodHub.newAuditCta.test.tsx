/**
 * "Nowy audyt" CTA (expert panel gap pack, 2026-08-26, item 3): the
 * `StandardModuleBar` in `AuditsMethodHub` had zero action buttons —
 * TRIADA_KANON.md:17 violation. Behind `ff_auditsScaleAndPolish` (default
 * OFF, fail-closed) — see `src/utils/auditsScaleAndPolishFlag.ts`.
 *
 * Coverage:
 *   * Flag OFF (default) → no CTA, byte-identical to before this pack.
 *   * Flag ON (query override) → CTA renders; opening it lists only packs
 *     that pass the same `evaluateStartGate` rule as the Library tab's
 *     per-row "Start audit" (published + has a source) — the draft
 *     "Demonstration Pack" fixture must NOT appear.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string | { defaultValue?: string }) => {
      if (typeof fallback === 'string') return fallback;
      if (fallback && typeof fallback === 'object' && fallback.defaultValue) return fallback.defaultValue;
      return key;
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn(), loading: vi.fn(() => 'toast-id') }) };
});

vi.mock('../auditsMethodApi', async () => {
  const actual = await vi.importActual<typeof import('../auditsMethodApi')>('../auditsMethodApi');
  return {
    ...actual,
    listPacks: vi.fn(),
    listPrograms: vi.fn(),
    listOutputs: vi.fn(),
    listReports: vi.fn(),
    listProposals: vi.fn(),
    createProgram: vi.fn(),
    getPack: vi.fn(),
    getProgram: vi.fn(),
    getProgramCoverage: vi.fn(),
    getProgramLifecycle: vi.fn(),
    listProgramCriteria: vi.fn(),
  };
});

import { AuditsMethodHub } from '../AuditsMethodHub';
import { type AuditPackSummary, type AuditProgramSummary, listOutputs, listPacks, listPrograms, listProposals, listReports } from '../auditsMethodApi';

const mockedListPacks = vi.mocked(listPacks);
const mockedListPrograms = vi.mocked(listPrograms);
const mockedListOutputs = vi.mocked(listOutputs);
const mockedListReports = vi.mocked(listReports);
const mockedListProposals = vi.mocked(listProposals);

const packs: AuditPackSummary[] = [
  {
    id: 'pack-1',
    packKey: 'iso-19011',
    version: 2,
    title: 'ISO 19011 Audit Pack',
    summary: null,
    sourceId: 'src-1',
    sourceTitle: 'ISO 19011:2018',
    sourceVersion: '2018',
    sourceType: 'LICENSED_STANDARD',
    verificationStatus: 'VERIFIED',
    publicationStatus: 'published',
    requiredRoles: [],
    criteriaCount: 42,
    updatedAt: '2026-08-01',
  },
  {
    id: 'pack-3',
    packKey: 'demo-pack',
    version: 1,
    title: 'Demonstration Pack',
    summary: null,
    sourceId: null,
    sourceTitle: null,
    sourceVersion: null,
    sourceType: 'DEMONSTRATION',
    verificationStatus: 'UNVERIFIED',
    publicationStatus: 'draft',
    requiredRoles: [],
    criteriaCount: 3,
    updatedAt: '2026-08-03',
  },
];

const programs: AuditProgramSummary[] = [];

function setupApiMocks() {
  mockedListPacks.mockResolvedValue({ items: packs, total: packs.length });
  mockedListPrograms.mockResolvedValue({ items: programs, total: programs.length });
  mockedListOutputs.mockResolvedValue({ items: [], total: 0 });
  mockedListReports.mockResolvedValue({ items: [], total: 0 });
  mockedListProposals.mockResolvedValue({ items: [], total: 0 });
}

function renderHub(initialEntries: string[]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuditsMethodHub />
    </MemoryRouter>
  );
}

describe('AuditsMethodHub — "Nowy audyt" CTA (ff_auditsScaleAndPolish)', () => {
  afterEach(() => {
    window.localStorage.removeItem('ff.audits_scale_and_polish');
  });

  it('does not render the CTA when the flag is OFF (default)', async () => {
    setupApiMocks();
    renderHub(['/audit-programs/method']);
    await waitFor(() => expect(mockedListPacks).toHaveBeenCalled());
    expect(screen.queryByTestId('audits-method-new-audit-cta')).toBeNull();
  });

  it('renders the CTA and lists only eligible packs when the flag is ON', async () => {
    setupApiMocks();
    // `window.location.search` is what the flag reads (mirrors production
    // query-param bypass); `MemoryRouter`'s `initialEntries` is a separate,
    // in-memory history that never touches `window.location`, so the
    // localStorage override is used here to exercise the same resolved-ON
    // codepath deterministically.
    window.localStorage.setItem('ff.audits_scale_and_polish', '1');
    renderHub(['/audit-programs/method']);
    await waitFor(() => expect(mockedListPacks).toHaveBeenCalled());

    const cta = await screen.findByTestId('audits-method-new-audit-cta');
    fireEvent.click(cta);

    const select = await screen.findByTestId('new-audit-modal-pack-select');
    expect(select).toBeInTheDocument();
    expect(within(select).getByText('ISO 19011 Audit Pack v2')).toBeInTheDocument();
    expect(within(select).queryByText('Demonstration Pack')).toBeNull();
    expect(within(select).getAllByRole('option')).toHaveLength(1);
  });
});
