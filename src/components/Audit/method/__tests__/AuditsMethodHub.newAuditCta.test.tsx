/**
 * "Nowy audyt" CTA (expert panel gap pack, 2026-08-26, item 3): the
 * `StandardModuleBar` in `AuditsMethodHub` had zero action buttons —
 * TRIADA_KANON.md:17 violation. Behind `ff_auditsScaleAndPolish` — see
 * `src/utils/auditsScaleAndPolishFlag.ts`. Default flipped OFF -> ON on
 * 2026-08-27 (owner accept on dev-render screenshots).
 *
 * DEC-417 (06.09, uwaga właściciela 15:29): the CTA is now FROZEN until
 * wave 2 (upload-assumptions procedure + audit question generator do not
 * exist yet) — it stays visible in Menu 2 but is natively `disabled`, with
 * a tooltip explaining why, and never opens `NewAuditModal`.
 *
 * Coverage:
 *   * Flag ON (default, flip po akcepcie właściciela 27.08) → CTA renders,
 *     is `disabled`, carries a tooltip/aria-describedby reason, and a click
 *     never opens the modal.
 *   * Flag OFF (localStorage override) → no CTA, byte-identical to before
 *     this pack — the kill switch still works despite the ON default.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  // flip po akcepcie właściciela 27.08: default was OFF, now ON — the kill
  // switch (localStorage '0') must still be able to disable the CTA.
  it('does not render the CTA when the flag is OFF (localStorage override)', async () => {
    setupApiMocks();
    window.localStorage.setItem('ff.audits_scale_and_polish', '0');
    renderHub(['/audit-programs/method']);
    await waitFor(() => expect(mockedListPacks).toHaveBeenCalled());
    expect(screen.queryByTestId('audits-method-new-audit-cta')).toBeNull();
  });

  it('renders the CTA frozen (DEC-417) when the flag is ON (default): disabled, tooltip, no modal on click', async () => {
    setupApiMocks();
    renderHub(['/audit-programs/method']);
    await waitFor(() => expect(mockedListPacks).toHaveBeenCalled());

    const cta = await screen.findByTestId('audits-method-new-audit-cta');
    expect(cta).toBeDisabled();

    const describedBy = cta.getAttribute('aria-describedby');
    const title = cta.getAttribute('title');
    // At least one of the two a11y explanations must be present (test
    // contract from DEC-417's instruction: "disabled i aria-describedby/title").
    expect(Boolean(describedBy) || Boolean(title)).toBe(true);
    if (describedBy) {
      const reasonNode = document.getElementById(describedBy);
      expect(reasonNode).not.toBeNull();
      expect(reasonNode?.textContent || '').not.toHaveLength(0);
    }

    fireEvent.click(cta);
    expect(screen.queryByTestId('new-audit-modal-pack-select')).toBeNull();
  });
});
